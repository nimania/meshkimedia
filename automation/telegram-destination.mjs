// Separate the delivery address from publicly shareable channel links.
import {readFile} from 'node:fs/promises';
import {createCipheriv,createDecipheriv,hkdfSync,randomBytes,createHash} from 'node:crypto';
const handle=/^@[a-zA-Z0-9_]{5,}$/;
const chatId=/^-100[1-9][0-9]{5,15}$/;
const bindingsFile=new URL('telegram-private-destinations.json',import.meta.url);
export async function readPrivateDestinations(){
 try{return JSON.parse(await readFile(bindingsFile,'utf8'));}
 catch(error){if(error.code==='ENOENT')return {};throw error;}
}
export function publicTelegramUrl(cfg){
 if(cfg?.enabled===false)return '';
 // Private invite links never become public merely because delivery is enabled.
 if(cfg?.privateChannel)return '';
 return handle.test(cfg?.channel||'')?'https://t.me/'+cfg.channel.slice(1):'';
}
function key(token,slug){
 if(!token||!/^[a-z0-9-]+$/.test(slug))throw new Error('Private destination credentials unavailable');
 return hkdfSync('sha256',Buffer.from(token),Buffer.from(slug),Buffer.from('meshkimedia-private-destination-v1'),32);
}
export function sealDestination(destination,token,slug){
 if(!chatId.test(String(destination.chatId)))throw new Error('Invalid private channel address');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(token,slug),iv);
 cipher.setAAD(Buffer.from(slug));
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(destination),'utf8'),cipher.final()]);
 return {version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')};
}
export function openDestination(sealed,token,slug){
 try{
  if(sealed?.version!==1)throw new Error();
  const decipher=createDecipheriv('aes-256-gcm',key(token,slug),Buffer.from(sealed.iv,'base64'));
  decipher.setAAD(Buffer.from(slug));decipher.setAuthTag(Buffer.from(sealed.tag,'base64'));
  const value=JSON.parse(Buffer.concat([decipher.update(Buffer.from(sealed.data,'base64')),decipher.final()]).toString('utf8'));
  if(!chatId.test(String(value.chatId)))throw new Error();
  return value;
 }catch{throw new Error('Private destination requires reconnection');}
}
export function resolveTelegramDestination(cfg,{env=process.env,bindings={}}={}){
 if(cfg?.enabled===false)return null;
 let address=cfg?.channelEnv?env[cfg.channelEnv]:cfg?.channel;
 if(cfg?.privateChannel){
  if(!bindings[cfg.seriesSlug])return null;
  const saved=openDestination(bindings[cfg.seriesSlug],env.SERIES_TELEGRAM_BOT_TOKEN,cfg.seriesSlug);
  if(saved.inviteFingerprint!==cfg.inviteFingerprint)throw new Error('Private destination identity changed');
  address=saved.chatId;
 }
 address=String(address||'').trim();
 if(!handle.test(address)&&!chatId.test(address))return null;
 const isPrivate=cfg.privateChannel===true||chatId.test(address);
 return {chatId:address,isPrivate,joinUrl:isPrivate?'':publicTelegramUrl(cfg)};
}
export function publicMessageReceipt(destination,messageId){
 if(destination.isPrivate)return {privateChannel:true,message_id:messageId};
 return {channel:destination.chatId,message_id:messageId,url:destination.joinUrl+'/'+messageId};
}
export function inviteFingerprint(text){
 const match=String(text||'').trim().match(/^https:\/\/t\.me\/(?:\+|joinchat\/)([A-Za-z0-9_-]+)\/?$/);
 return match?createHash('sha256').update(match[1]).digest('hex'):'';
}
export function matchingChannelPosts(updates,cfg){
 // A title alone is insufficient. The owner posts the supplied private invite
 // in the destination after adding the bot; only its hash is kept in this repo.
 return (updates||[]).map(x=>x.channel_post||x.edited_channel_post).filter(p=>
  p?.chat?.type==='channel'&&p.chat.title===cfg.expectedChannelTitle&&
  inviteFingerprint(p.text||p.caption)===cfg.inviteFingerprint);
}
