import { readFile } from "node:fs/promises";
const data = (file) => readFile(new URL(`../github-pages/data/${file}.json`, import.meta.url), "utf8").then(JSON.parse);
const [series, people, works] = await Promise.all([data("series"), data("people"), data("works")]);
const slugify = (s) => (s || "").replace(/[İIı]/g, "i").replace(/[Şş]/g, "s").replace(/[Ğğ]/g, "g").replace(/[Üü]/g, "u").replace(/[Öö]/g, "o").replace(/[Çç]/g, "c").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const errors = [];
const seen = new Set();
for (const s of Object.values(series)) {
  const characterIds = new Set();
  for (const c of s.cast || []) {
    if (!c.name || !c.role) errors.push(`${s.slug}: بازیگر یا نام نقش خالی است`);
    // The role text is optional (some official cast pages have none); its source never is.
    if (!c.source) errors.push(`${s.slug}: منبع نقش ${c.role} خالی است`);
    if (!c.image || !/^https:\/\//.test(c.image)) errors.push(`${s.slug}: عکس بازیگر نقش ${c.role} خالی یا نامعتبر است`);
    const personSlug = c.personSlug || slugify(c.name);
    if (!people[personSlug]) errors.push(`${s.slug}: ${c.name} در people.json ثبت نشده`);
    else if (people[personSlug].name !== c.name) errors.push(`${s.slug}: شناسهٔ ${personSlug} با نام بازیگر نمی‌خواند`);
    const characterSlug = slugify(`${s.slug}-${c.role}`);
    if (characterIds.has(characterSlug)) errors.push(`${s.slug}: نقش تکراری ${characterSlug}`);
    characterIds.add(characterSlug);
    seen.add(personSlug);
  }
}
for (const [id, w] of Object.entries(works)) {
  if (id !== w.slug || !["film", "series"].includes(w.kind)) errors.push(`${id}: شناسه یا نوع اثر نامعتبر است`);
  if (!w.source) errors.push(`${id}: منبع اثر ثبت نشده`);
  for (const c of w.cast || []) {
    if (!people[c.personSlug]) errors.push(`${id}: بازیگر ${c.personSlug} وجود ندارد`);
    seen.add(c.personSlug);
  }
}
for (const [id, person] of Object.entries(people)) {
  if (!seen.has(id)) errors.push(`${id}: پروفایل بدون اثر ثبت‌شده`);
  if (!person.photo || !/^https:\/\//.test(person.photo)) errors.push(`${id}: عکس پروفایل خالی یا نامعتبر است`);
  for (const [platform, url] of Object.entries(person.socials || {})) {
    const hosts = { instagram: ['instagram.com'], x: ['x.com', 'twitter.com'], youtube: ['youtube.com'], tiktok: ['tiktok.com'], facebook: ['facebook.com'], website: [] };
    const host = /^https:\/\//.test(url) ? new URL(url).hostname.replace(/^www\./, '') : '';
    if (!(platform in hosts) || !host || (hosts[platform].length && !hosts[platform].includes(host))) errors.push(`${id}: پیوند ${platform} نامعتبر است`);
  }
}
const filled = Object.values(series).filter((s) => (s.cast || []).length).length;
console.log(`بازیگران: ${Object.keys(people).length} · نقش‌ها: ${Object.values(series).reduce((n,s) => n+(s.cast||[]).length,0)} · آثار مستقل: ${Object.keys(works).length} · سریال‌های دارای کست: ${filled}/${Object.keys(series).length}`);
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
