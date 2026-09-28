// Retrieve recent @dizilah rating posts through Meta's authorized Business Discovery API.
// OCR is deliberately a review queue: a wrong digit must never silently reach the site.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const token = process.env.INSTAGRAM_GRAPH_TOKEN;
const account = process.env.INSTAGRAM_USER_ID;
if (!token || !account) {
  console.error("Configure INSTAGRAM_GRAPH_TOKEN and INSTAGRAM_USER_ID for the connected Professional account.");
  process.exit(2);
}

const out = process.env.INSTAGRAM_REVIEW_DIR || "instagram-review";
const graphVersion = process.env.INSTAGRAM_GRAPH_VERSION || "v23.0";
const fields = "business_discovery.username(dizilah){username,media.limit(30){id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url}}}";
const url = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(account)}`);
url.searchParams.set("fields", fields);
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
const payload = await response.json();
if (!response.ok || payload.error) throw new Error(`Meta Business Discovery: ${payload.error?.message || response.status}`);
const media = payload.business_discovery?.media?.data;
if (!Array.isArray(media)) throw new Error("Meta returned no Dizilah media; verify professional account and permissions.");
await mkdir(out, { recursive: true });

const cutoff = Date.now() - 5 * 86400000;
const posts = media.filter((post) => /ratings?|reyting/i.test(post.caption || "") && Date.parse(post.timestamp) >= cutoff);
const results = [];
for (const post of posts) {
  const images = (post.children?.data || [post]).filter((item) => item.media_type === "IMAGE" && item.media_url);
  const scanned = [];
  for (const [index, item] of images.entries()) {
    // Public media URLs returned by Meta can expire, so capture only a short-lived review artifact.
    const photo = await fetch(item.media_url, { signal: AbortSignal.timeout(20000) });
    if (!photo.ok) { scanned.push({ image: index + 1, error: `Image HTTP ${photo.status}` }); continue; }
    const file = join(out, `${post.id}-${index + 1}.jpg`);
    await writeFile(file, Buffer.from(await photo.arrayBuffer()));
    const ocr = spawnSync("tesseract", [file, "stdout", "-l", "eng+tur"], { encoding: "utf8", timeout: 30000 });
    scanned.push({ image: index + 1, file, text: ocr.status === 0 ? ocr.stdout.trim() : "", error: ocr.status === 0 ? undefined : ocr.stderr?.trim() });
  }
  results.push({ id: post.id, published: post.timestamp, link: post.permalink, caption: post.caption, scanned });
}
await writeFile(join(out, "candidates.json"), `${JSON.stringify({ checkedAt: new Date().toISOString(), posts: results }, null, 2)}\n`);
const markdown = ["# پست‌های تازهٔ ریتینگ دیزیلا", "", `بررسی: ${new Date().toISOString()} · ${results.length} پست مرتبط در پنج روز اخیر`, "",
  "این خروجی فقط برای بررسی است. اعداد OCR ممکن است خطا داشته باشند و بدون تطبیق با تصویر و تاریخ به جدول یا کارت منتشر نمی‌شوند.", "",
  ...results.flatMap((p) => [
    `## ${p.published} · ${p.link || "بدون لینک"}`, "", p.caption || "", "",
    ...p.scanned.flatMap((s) => [`### تصویر ${s.image}`, "", "```", s.text || s.error || "متن قابل تشخیص نیست", "```", ""]),
  ])].join("\n");
await writeFile(join(out, "review.md"), markdown);
console.log(`Found ${results.length} candidate posts. Review ${join(out, "review.md")} before importing ratings.`);
