// Verify one owner-provided private channel without exposing its ID or invite.
// Does not consume updates, alter webhooks, create links, or send messages.
import {readFile,writeFile} from 'node:fs/promises';
import {readPrivateDestinations,sealDestination,matchingChannelPosts,resolveTelegramDestination} from './telegram-destination.mjs';
const slug=process.argv.find(x=>x.startsWith('--series='))?.slice(9);
if(!/^[a-z0-9-]+$/.test(slug||''))throw new Error('A valid --series is required');
const cfg=JSON.parse(await readFile(new URL('telegram-series.json',import.meta.url),'utf8')).channels.find(c=>c.seriesSlug===slug&&c.privateChannel);
if(!cfg)throw new Error('Private series configuration missing');
const token=(process.env.SERIES_TELEGRAM_BOT_TOKEN||'').trim();
if(!token){console.log('SETUP: bot secret is not configured');process.exit(0);}
async function api(method,body={}){
 let result;
 try{
  const response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  result=await response.json();
 }catch{throw new Error('Telegram connection unavailable');}
 if(!result.ok)throw new Error('Telegram '+method+' did not succeed (code '+(result.error_code||'unknown')+')');
 return result.result;
}
const me=await api('getMe');
console.log('PUBLISHING_BOT: @'+me.username);
const bindings=await readPrivateDestinations();
if(bindings[slug]){
 const destination=resolveTelegramDestination(cfg,{bindings});
 const member=await api('getChatMember',{chat_id:destination.chatId,user_id:me.id});
 console.log(member.status==='administrator'&&member.can_post_messages?'SETUP: verified private destination is already connected':'SETUP: bot needs permission to post');
 process.exit(0);
}
const webhook=await api('getWebhookInfo');
if(webhook.url){console.log('SETUP: existing webhook preserved; channel verification requires the existing update receiver');process.exit(0);}
// Omitting offset leaves the queue unacknowledged; omitting allowed_updates
// preserves its existing subscription. No unrelated message content is logged.
const updates=await api('getUpdates',{timeout:0,limit:100});
const posts=matchingChannelPosts(updates,cfg);
const candidates=[...new Map(posts.map(p=>[String(p.chat.id),p.chat])).values()];
if(candidates.length!==1){console.log(candidates.length?'SETUP: ambiguous destination; nothing connected':'SETUP: waiting for the bot to be added as administrator and the supplied invite link to be posted in that channel');process.exit(0);}
const chat=candidates[0];
const current=await api('getChat',{chat_id:chat.id});
const member=await api('getChatMember',{chat_id:chat.id,user_id:me.id});
if(current.type!=='channel'||current.title!==cfg.expectedChannelTitle||member.status!=='administrator'||!member.can_post_messages){console.log('SETUP: channel identity or posting permission could not be verified');process.exit(0);}
if(!/^@[a-zA-Z0-9_]{5,}$/.test(cfg.ownerReferenceChannel||''))throw new Error('An existing owner reference channel is required');
const referenceAdmins=await api('getChatAdministrators',{chat_id:cfg.ownerReferenceChannel});
const targetAdmins=await api('getChatAdministrators',{chat_id:chat.id});
const referenceOwner=referenceAdmins.find(a=>a.status==='creator')?.user?.id;
const targetOwner=targetAdmins.find(a=>a.status==='creator')?.user?.id;
if(!referenceOwner||referenceOwner!==targetOwner){console.log('SETUP: owner does not match the existing series channel; manual review required');process.exit(0);}
bindings[slug]=sealDestination({chatId:String(chat.id),inviteFingerprint:cfg.inviteFingerprint,verifiedAt:new Date().toISOString()},token,slug);
if(process.env.GITHUB_ACTIONS==='true'){
 // Persist before any publisher can use the destination. Use the contents API
 // so this does not depend on the repository's failing generated-file git push.
 const repository=process.env.GITHUB_REPOSITORY;
 const auth=process.env.GITHUB_TOKEN;
 if(!repository||!auth)throw new Error('Binding persistence credentials missing');
 const url='https://api.github.com/repos/'+repository+'/contents/automation/telegram-private-destinations.json';
 const headers={authorization:'Bearer '+auth,accept:'application/vnd.github+json','content-type':'application/json'};
 const existing=await fetch(url+'?ref=main',{headers});
 let sha;
 if(existing.ok){const previous=await existing.json();sha=previous.sha;
  const remote=JSON.parse(Buffer.from(previous.content,'base64').toString('utf8'));
  if(remote[slug])throw new Error('Destination changed concurrently; review the current binding');
  Object.assign(bindings,remote);
 }else if(existing.status!==404)throw new Error('Could not read existing private bindings');
 const response=await fetch(url,{method:'PUT',headers,body:JSON.stringify({message:'Connect verified private series destination [skip ci]',content:Buffer.from(JSON.stringify(bindings,null,2)+'\n').toString('base64'),branch:'main',...(sha?{sha}:{})})});
 if(!response.ok)throw new Error('Could not persist verified private destination');
}
await writeFile(new URL('telegram-private-destinations.json',import.meta.url),JSON.stringify(bindings,null,2)+'\n');
console.log('SETUP: verified private destination saved; first publisher run will initialize its archive without bulk posting');
