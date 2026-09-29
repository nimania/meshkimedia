// Generates the whole static site (pages + SEO + sitemap + search index) from JSON.
// Data-driven: edit github-pages/data/*.json and re-run.
import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const PAGES = new URL("../github-pages/", import.meta.url);
const p = (rel) => new URL(rel, PAGES);
const BASE = "https://nimania.github.io/meshkimedia";
const LOGO = "/images/meshki-media-logo.png";

const networks = JSON.parse(await readFile(p("data/networks.json"), "utf8"));
const series = JSON.parse(await readFile(p("data/series.json"), "utf8"));
const profiles = JSON.parse(await readFile(p("data/people.json"), "utf8"));
const works = JSON.parse(await readFile(p("data/works.json"), "utf8"));
const calendar = JSON.parse(await readFile(p("data/calendar.json"), "utf8"));
const ratings = JSON.parse(await readFile(p("data/ratings.json"), "utf8"));
const newsData = existsSync(p("data/news.json")) ? JSON.parse(await readFile(p("data/news.json"), "utf8")) : { items: [] };
const bios = existsSync(p("data/bios.json")) ? JSON.parse(await readFile(p("data/bios.json"), "utf8")) : {};
const seriesArr = Object.values(series);

// ---- slug (MUST match github-pages/dizimeter.js) ---------------------------
function slugify(s) {
  s = (s || "").toString();
  const m = { "İ": "i", "I": "i", "ı": "i", "Ş": "s", "ş": "s", "Ğ": "g", "ğ": "g", "Ü": "u", "ü": "u", "Ö": "o", "ö": "o", "Ç": "c", "ç": "c" };
  s = s.replace(/[İIıŞşĞğÜüÖöÇç]/g, (c) => m[c]);
  s = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "x";
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- derive people & characters --------------------------------------------
const people = Object.fromEntries(Object.entries(profiles).map(([slug, profile]) => [slug, { slug, ...profile, credits: [] }]));
const characters = {};
for (const s of seriesArr) {
  for (const c of s.cast || []) {
    if (c.name) {
      const slug = c.personSlug || slugify(c.name);
      const pr = (people[slug] = people[slug] || { slug, name: c.name, nameFa: "", photo: "", credits: [] });
      if (!pr.nameFa && c.nameFa) pr.nameFa = c.nameFa;
      if (!pr.photo && c.image) pr.photo = c.image;
      pr.credits.push({ kind: "series", seriesSlug: s.slug, titleFa: s.titleFa, titleTr: s.titleTr, year: s.year, character: c.role || "", characterFa: c.roleFa || "" });
    }
    if (c.role) {
      const slug = slugify(s.slug + "-" + c.role);
      characters[slug] = { slug, name: c.role, nameFa: c.roleFa || "", description: c.description || "", seriesSlug: s.slug, seriesTitleFa: s.titleFa, personName: c.name || "", personNameFa: c.nameFa || "", personSlug: c.name ? (c.personSlug || slugify(c.name)) : "", image: c.roleImage || c.image || "" };
    }
  }
}
for (const w of Object.values(works)) for (const c of w.cast || []) {
  if (!people[c.personSlug]) throw new Error(`Unknown actor ${c.personSlug} in work ${w.slug}`);
  people[c.personSlug].credits.push({ kind: w.kind, workSlug: w.slug, titleFa: w.titleFa, titleTr: w.titleTr, year: w.year, character: c.role || "", characterFa: c.roleFa || "" });
}
for (const pr of Object.values(people)) pr.credits.sort((a, b) => (b.year || 0) - (a.year || 0));

// ---- shared HTML shell with full SEO ---------------------------------------
const SITE_NAV = (root, active) => {
  const items = [
    ["", "خانه"], ["diziler/", "سریال‌ها"], ["haber/", "اخبار"], ["takvim/", "تقویم"], ["ozetler/", "خلاصه‌ها"], ["fragmanlar/", "فراگمان‌ها"],
    ["reyting/", "ریتینگ"], ["oyuncular/", "بازیگران"], ["karakterler/", "کاراکترها"], ["kanal/", "شبکه‌ها"], ["ara/", "جستجو"],
  ];
  return `<nav class="site-nav" aria-label="بخش‌ها">${items.map(([h, t]) => `<a href="${root}${h}"${active === h ? ' class="on"' : ""}>${t}</a>`).join("")}</nav>`;
};

function head(root, { title, desc, path, ogImage, jsonld, ogType = "website", version = "20260930news" }) {
  const canonical = `${BASE}/${path}`;
  const img = ogImage ? (ogImage.startsWith("http") ? ogImage : BASE + ogImage) : BASE + LOGO;
  const ld = jsonld ? `\n<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : "";
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}"><meta property="og:site_name" content="مشکی مدیا">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}"><meta property="og:image" content="${img}"><meta property="og:locale" content="fa_IR">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${img}">
<link rel="icon" href="${root}images/meshki-media-logo.png" type="image/png"><link rel="apple-touch-icon" href="${root}images/meshki-media-logo.png">
<link rel="preload" href="${root}vazirmatn.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}styles.css?v=${version}">
<script>try{var t=localStorage.getItem("dizimeter-theme");if(!t&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)t="dark";if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>${ld}
</head>
<body>
<header class="app-header"><a class="brand" href="${root}"><img class="brand-logo" src="${root}images/meshki-media-logo.png" alt="مشکی مدیا" width="34" height="34"><span class="brand-text"><strong>مشکی مدیا</strong><span>دنیای سریال‌های ترکی</span></span></a><div class="header-actions"><button id="theme-toggle" class="icon-button" aria-label="روشن یا تیره">◐</button><a class="icon-button" href="${root}ara/" aria-label="جستجو">⌕</a></div></header>
${SITE_NAV(root, path.split("/")[0] === "" ? "" : (path.split("/").slice(0, 1)[0] + "/"))}`;
}
const boot = (root, obj, scripts, version = "20260928fa") => `<script>window.DM=${JSON.stringify(Object.assign({ root }, obj))};</script>
<script src="${root}dizimeter.js?v=${version}" defer></script>
${scripts.map((s) => `<script src="${root}${s}?v=${version}" defer></script>`).join("\n")}
</body></html>
`;
const BOTTOM = (root, items) => `<nav class="bottom-nav">${items.map(([h, b, t, on]) => `<a href="${root}${h}"${on ? ' class="active"' : ""}><b>${b}</b><span>${t}</span></a>`).join("")}</nav>`;

// ---- network SVG mark ------------------------------------------------------
function networkSvg(net) {
  const label = (net.abbr || net.name).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const w = Math.max(96, 30 + label.length * 15);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 40" width="${w}" height="40" role="img" aria-label="${esc(net.name.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]))}">
<rect width="${w}" height="40" rx="8" fill="${net.color}"/>
<text x="${w / 2}" y="27" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="18" letter-spacing="0.5" fill="#ffffff">${esc(label)}</text>
</svg>
`;
}

const firstEpImage = (s) => { for (const se of s.seasons || []) for (const e of se.episodes || []) if (e.image) return e.image; return ""; };

// ---- Series page -----------------------------------------------------------
function seriesPage(s) {
  const root = "../../";
  const net = networks[s.network];
  const img = s.hero || firstEpImage(s);
  const jsonld = { "@context": "https://schema.org", "@type": s.kind === "entertainment" ? "TVSeries" : "TVSeries", name: s.titleTr, alternateName: s.titleFa, url: `${BASE}/dizi/${s.slug}/`, inLanguage: "tr", genre: s.genre || [], countryOfOrigin: { "@type": "Country", name: "Turkey" } };
  if (img) jsonld.image = img;
  if (net) jsonld.productionCompany = net.name;
  const h = head(root, { title: `${s.titleFa} (${s.titleTr}) | مشکی مدیا`, desc: (s.synopsis || `پروفایل، بازیگران و ری‌کپ قسمت‌های ${s.titleFa}`).slice(0, 180), path: `dizi/${s.slug}/`, ogImage: img, ogType: "video.tv_show", jsonld, version: "20260930news" });
  const body = `
<main class="profile-shell">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a href="${root}diziler/">سریال‌ها</a><span>/</span><span id="net-badge"></span></div>
<section id="profile-hero" class="profile-hero"><img class="hero-cover" alt="" referrerpolicy="no-referrer"><div class="profile-title">
<div class="profile-tags"><span id="kind-tag">سریال</span><span id="status"></span></div>
<h1 id="title-fa">${esc(s.titleFa)}</h1><p id="title-tr" dir="ltr">${esc(s.titleTr)}</p>
<div class="profile-facts"><span id="network"></span><span id="airing"></span><span id="studio"></span></div>
<div id="genre" class="genre-chips"></div></div></section>
<nav class="profile-tabs" aria-label="بخش‌های صفحه"><a href="#about">داستان</a><a href="#cast-section">بازیگران</a><a href="#news">اخبار</a><a href="#trend">ریتینگ</a><a href="#eps">قسمت‌ها</a></nav>
<section id="about" class="profile-section"><div class="section-kicker">داستان</div><p id="synopsis" class="synopsis"></p><a id="synopsis-source" class="gallery-source" target="_blank" rel="noopener noreferrer" hidden>منبع داستان ↗</a><div id="official-links" class="official-links"></div></section>
<section id="series-gallery-section" class="profile-section" hidden><div class="section-headline"><div><span>تصاویر رسمی</span><h2>عکس‌های سریال</h2></div><a id="series-gallery-source" class="gallery-source" target="_blank" rel="noopener noreferrer" hidden>منبع عکس‌ها ↗</a></div><div id="series-gallery" class="gallery"></div></section>
<section id="cast-section" class="profile-section"><div class="section-headline"><div><span>بازیگران و نقش‌ها</span><h2>چه کسی چه نقشی دارد؟</h2></div><small>روی نام بازیگر یا نقش بزنید</small></div><div id="cast" class="cast-grid"></div><p id="cast-empty" class="notice" hidden>فهرست تأییدشدهٔ بازیگران این سریال هنوز تکمیل نشده است.</p></section>
<section id="news" class="profile-section"><div class="section-headline"><div><span>اخبار</span><h2>آخرین خبرهای ${esc(s.titleFa)}</h2></div><a class="gallery-source" href="${root}haber/">همهٔ اخبار ↗</a></div><div id="series-news" class="news-feed"><div class="notice">در حال بارگذاری اخبار…</div></div></section>
<section id="trend" class="profile-section"><div class="section-headline"><div><span>ریتینگ</span><h2>روند ریتینگ پخش به پخش</h2></div><small>Total · AB · ABC1</small></div><div id="series-trend"></div></section>
<section id="eps" class="profile-section"><div class="section-headline"><div><span>قسمت‌ها</span><h2>ری‌کپ و ریتینگ قسمت‌ها</h2></div><small>Total · AB · ABC1</small></div><div id="episodes" class="episodes"></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], [`dizi/${s.slug}/#episodes`, "☰", "قسمت‌ها", true], [`dizi/${s.slug}/#cast`, "◉", "بازیگران"], [net ? `kanal/${net.slug}/` : "", "▦", "شبکه"]])}`;
  return h + body + boot(root, { slug: s.slug }, ["rating-trends.js", "series-page.js", "gallery.js", "news.js"], "20260930news");
}

// ---- Episode page ----------------------------------------------------------
function episodePage(s, ep) {
  const root = "../../../";
  const net = networks[s.network];
  const img = ep.image || (ep.images && ep.images[0]) || s.hero || "";
  const jsonld = { "@context": "https://schema.org", "@type": "TVEpisode", name: ep.title || `قسمت ${ep.number}`, episodeNumber: ep.number, url: `${BASE}/dizi/${s.slug}/bolum-${ep.number}/`, partOfSeries: { "@type": "TVSeries", name: s.titleTr, url: `${BASE}/dizi/${s.slug}/` } };
  if (ep.date && !ep.scheduled) jsonld.datePublished = ep.date;
  if (img) jsonld.image = img;
  if (ep.summary) jsonld.description = ep.summary.slice(0, 300);
  const h = head(root, { title: `${s.titleFa} — قسمت ${ep.number}${ep.title ? "؛ " + ep.title : ""} | مشکی مدیا`, desc: (ep.summary || `ریتینگ و وضعیت قسمت ${ep.number} سریال ${s.titleFa}`).slice(0, 180), path: `dizi/${s.slug}/bolum-${ep.number}/`, ogImage: img, ogType: "video.episode", jsonld, version: "20260928episode3" });
  const body = `
<main class="profile-shell">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a id="crumb-series" href="#">سریال</a><span>/</span><span>قسمت ${ep.number}</span></div>
<section id="ep-hero" class="ep-hero"><img class="ep-hero-image" alt="" referrerpolicy="no-referrer"><span id="ep-badge" class="net-chip"></span><div class="ep-hero-copy"><p class="ep-kicker" id="ep-kicker"></p><h1 id="ep-title">قسمت ${ep.number}</h1><div class="ep-facts" id="ep-facts"></div></div></section>
<section class="ep-block ratings-big"><span class="kicker">ریتینگ این قسمت</span><h2>Total · AB · ABC1</h2><div id="ep-ratings"></div><p class="ratings-note" id="ratings-note"></p></section>
<section class="ep-block" id="ep-trend-section"><span class="kicker">مسیر سریال</span><h2>جایگاه این قسمت در روند ریتینگ</h2><p class="trend-help">در نمای رتبه، عدد کمتر بهتر است و بالا رفتن خط یعنی بهبود جایگاه. نقطهٔ پررنگ قسمت فعلی است.</p><div id="ep-trend"></div><a class="trend-more" href="${root}reyting/#trends">مقایسه با سریال‌های دیگر ←</a></section>
<section id="gallery-section" class="ep-block"><span class="kicker">تصاویر قسمت</span><h2>گالری</h2><div id="ep-gallery" class="gallery"></div><a id="ep-gallery-source" class="gallery-source" target="_blank" rel="noopener noreferrer" hidden>منبع عکس‌ها در شبکهٔ پخش ↗</a></section>
<section class="ep-block"><span class="kicker">خلاصهٔ قسمت (ری‌کپ)</span><h2>چه گذشت؟</h2><p id="ep-summary" class="ep-summary"></p><div id="ep-links" class="ep-links"></div></section>
<div id="ep-nav" class="ep-nav"></div>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], [`dizi/${s.slug}/`, "☰", "سریال"], [`dizi/${s.slug}/bolum-${ep.number}/#ep-ratings`, "⌁", "ریتینگ", true], [net ? `kanal/${net.slug}/` : "", "▦", "شبکه"]])}`;
  return h + body + boot(root, { slug: s.slug, epNumber: ep.number }, ["rating-trends.js", "episode-page.js", "gallery.js"], "20260928episode3");
}

// ---- Network page ----------------------------------------------------------
function networkPage(net) {
  const root = "../../";
  const jsonld = { "@context": "https://schema.org", "@type": "Organization", name: net.name, url: `${BASE}/kanal/${net.slug}/`, logo: `${BASE}/images/networks/${net.slug}.svg` };
  const h = head(root, { title: `${net.name} — سریال‌ها و ریتینگ | مشکی مدیا`, desc: `همهٔ سریال‌های در حال پخش شبکهٔ ${net.name} و جایگاه‌شان در جدول ریتینگ تیاک.`, path: `kanal/${net.slug}/`, jsonld });
  const body = `
<main class="app-shell">
<section class="net-hero" style="--net-color:${net.color}"><div class="net-hero-top"><img id="net-logo" src="${root}images/networks/${net.slug}.svg" alt="${esc(net.name)}"><div><h1 id="net-name">${esc(net.name)}</h1><div class="net-fa" id="net-name-fa"></div></div></div><div class="net-meta"><span><b id="net-count">۰</b> سریال</span><a id="net-site" href="${net.site || "#"}" target="_blank" rel="noreferrer">سایت رسمی ↗</a></div></section>
<section class="feed-section"><div class="feed-label"><span>سریال‌های این شبکه</span><i></i></div><div id="net-series" class="series-grid"></div></section>
<section id="net-news-section" class="feed-section"><div class="feed-label"><span>اخبار این شبکه</span><i></i></div><div id="network-news" class="news-feed"></div></section>
<section id="net-ratings-section" class="feed-section"><div class="feed-label"><span>در جدول اخیر (<span id="net-day-date"></span>)</span><i></i></div><div id="net-ratings"></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["kanal/", "▦", "شبکه‌ها", true], ["diziler/", "☰", "سریال‌ها"], ["#net-series", "⌁", "ریتینگ"]])}`;
  return h + body + boot(root, { slug: net.slug }, ["network-page.js", "news.js"], "20260930news");
}

// ---- Actor page ------------------------------------------------------------
function actorPage(pr) {
  const root = "../../";
  const jsonld = { "@context": "https://schema.org", "@type": "Person", name: pr.name, url: `${BASE}/oyuncu/${pr.slug}/` };
  if (pr.photo) jsonld.image = pr.photo;
  if (pr.nameFa) jsonld.alternateName = pr.nameFa;
  const disp = pr.nameFa || pr.name;
  const roles = pr.credits.map((c) => c.characterFa || c.character).filter(Boolean).slice(0, 3).join("، ");
  const bioText = pr.bio || bios[pr.slug]?.fa?.text || "";
  if (bioText) jsonld.description = bioText;
  if (pr.socials) jsonld.sameAs = Object.values(pr.socials).filter((u) => /^https:\/\//.test(u));
  const h = head(root, { title: `${disp} — بازیگر | مشکی مدیا`, desc: (bioText || `${disp} (${pr.name})، بازیگر؛ ${roles}. فیلم‌ها و سریال‌ها در مشکی مدیا.`).slice(0, 180), path: `oyuncu/${pr.slug}/`, ogImage: pr.photo, ogType: "profile", jsonld });
  const body = `
<main class="profile-shell">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a href="${root}oyuncular/">بازیگران</a><span>/</span><span>${esc(disp)}</span></div>
<section class="person-hero actor-hero"><div class="person-photo ${pr.photo ? "" : "no-image"}">${pr.photo ? `<img src="${esc(pr.photo)}" alt="" onerror="this.remove();this.parentElement.classList.add('no-image')">` : ""}<span class="avatar-initial">${esc(disp.slice(0, 1))}</span></div><div><span class="kicker">بازیگر</span><h1>${esc(disp)}</h1><p class="muted-line" dir="ltr">${esc(pr.name)}</p><p class="muted-line">${esc(roles || "")}</p></div></section>
<section class="profile-section"><div class="section-headline"><div><span>دربارهٔ بازیگر</span><h2>معرفی</h2></div></div><p id="actor-bio" class="synopsis"></p><p id="actor-bio-credit" class="bio-credit" hidden></p><div id="actor-socials" class="official-links" aria-label="شبکه‌های اجتماعی بازیگر" hidden></div><div class="profile-sources"><a id="actor-source" class="gallery-source" target="_blank" rel="noopener noreferrer" hidden>منبع معرفی ↗</a>${pr.photoSource ? `<a class="gallery-source" href="${esc(pr.photoSource)}" target="_blank" rel="noopener noreferrer">منبع عکس ↗</a>` : ""}</div></section>
<section class="profile-section"><div class="section-headline"><div><span>کارنامهٔ پیوسته</span><h2>فیلم‌ها و سریال‌ها</h2></div><small id="credit-count"></small></div><div id="credits" class="credits-grid"></div></section>
<section id="news" class="profile-section"><div class="section-headline"><div><span>اخبار</span><h2>آخرین خبرهای ${esc(disp)}</h2></div><a class="gallery-source" href="${root}haber/">همهٔ اخبار ↗</a></div><div id="actor-news" class="news-feed"><div class="notice">در حال بارگذاری اخبار…</div></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["oyuncular/", "◉", "بازیگران", true], ["diziler/", "☰", "سریال‌ها"], ["ara/", "⌕", "جستجو"]])}`;
  return h + body + boot(root, { slug: pr.slug }, ["actor-page.js", "news.js"], "20260930news");
}

// ---- Character page --------------------------------------------------------
function characterPage(ch) {
  const root = "../../";
  const disp = ch.nameFa || ch.name;
  const jsonld = { "@context": "https://schema.org", "@type": "Person", name: ch.name, url: `${BASE}/karakter/${ch.slug}/`, description: `کاراکتر سریال ${ch.seriesTitleFa}` };
  if (ch.nameFa) jsonld.alternateName = ch.nameFa;
  if (ch.description) jsonld.description = ch.description;
  const h = head(root, { title: `${disp} — کاراکتر ${ch.seriesTitleFa} | مشکی مدیا`, desc: (ch.description || `${disp}، کاراکتر سریال ${ch.seriesTitleFa}${ch.personNameFa || ch.personName ? "، با بازیِ " + (ch.personNameFa || ch.personName) : ""}.`).slice(0, 180), path: `karakter/${ch.slug}/`, ogImage: ch.image, ogType: "profile", jsonld });
  const body = `
<main class="profile-shell">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a href="${root}karakterler/">کاراکترها</a><span>/</span><span>${esc(disp)}</span></div>
<section class="person-hero"><div class="person-photo ${ch.image ? "" : "no-image"}">${ch.image ? `<img src="${esc(ch.image)}" alt="" onerror="this.remove();this.parentElement.classList.add('no-image')">` : ""}<span class="avatar-initial">${esc(disp.slice(0, 1))}</span></div><div><span class="kicker">کاراکتر</span><h1>${esc(disp)}</h1><p class="muted-line" dir="ltr">${esc(ch.name)}</p><p class="muted-line" id="char-sub"></p></div></section>
<section class="profile-section"><div class="section-headline"><div><span>داستان نقش</span><h2>دربارهٔ ${esc(disp)}</h2></div></div><p id="char-description" class="synopsis"></p><a id="char-source" class="gallery-source" target="_blank" rel="noopener noreferrer" hidden>منبع نقش ↗</a><div id="char-info" class="char-info"></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["karakterler/", "◈", "کاراکترها", true], ["diziler/", "☰", "سریال‌ها"], ["ara/", "⌕", "جستجو"]])}`;
  return h + body + boot(root, { slug: ch.slug }, ["character-page.js"]);
}

// ---- Other works (films and series outside the main TV catalogue) ----------
function workPage(w) {
  const root = "../../";
  const disp = w.titleFa || w.titleTr;
  const type = w.kind === "film" ? "فیلم" : "سریال";
  const jsonld = { "@context": "https://schema.org", "@type": w.kind === "film" ? "Movie" : "TVSeries", name: w.titleTr, alternateName: w.titleFa, url: `${BASE}/asar/${w.slug}/` };
  if (w.image) jsonld.image = w.image;
  const h = head(root, { title: `${disp} — ${type} | مشکی مدیا`, desc: (w.synopsis || `${type} ${disp}؛ بازیگران و نقش‌های ثبت‌شده.`).slice(0, 180), path: `asar/${w.slug}/`, ogImage: w.image, jsonld });
  const cast = (w.cast || []).map((c) => {
    const pr = people[c.personSlug];
    return `<a class="work-person" href="${root}oyuncu/${esc(c.personSlug)}/"><span class="work-avatar ${pr.photo ? "" : "no-image"}" ${pr.photo ? `style="background-image:url('${esc(pr.photo)}')"` : ""}>${pr.photo ? "" : esc((pr.nameFa || pr.name).slice(0, 1))}</span><span><strong>${esc(pr.nameFa || pr.name)}</strong><small>${esc(c.roleFa || c.role || "بازیگر")}</small></span><b>←</b></a>`;
  }).join("");
  return h + `<main class="profile-shell"><div class="crumbs"><a href="${root}">خانه</a><span>/</span><a href="${root}oyuncular/">بازیگران</a><span>/</span>${esc(disp)}</div><section class="work-hero"><span class="kicker">${type} · ${esc(w.year || "")}</span><h1>${esc(disp)}</h1><p dir="ltr">${esc(w.titleTr)}</p></section><section class="profile-section"><div class="section-headline"><div><span>بازیگران</span><h2>در این اثر</h2></div></div><div class="work-people">${cast}</div>${w.source ? `<a class="gallery-source" href="${esc(w.source)}" target="_blank" rel="noopener noreferrer">منبع اطلاعات ↗</a>` : ""}</section></main>` + boot(root, {}, []);
}

// ---- Generic list page -----------------------------------------------------
function listPage({ path, title, desc, kicker, h1, sub, containerId, script, active }) {
  const root = "../";
  const isCalendar = path === "takvim/";
  const version = isCalendar ? "20260929ep" : "20260927d";
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: `${BASE}/${path}` };
  const h = head(root, { title, desc, path, jsonld, version });
  const search = `<div class="list-search"><input id="q" type="search" placeholder="جستجو…" aria-label="جستجو"></div>`;
  const calendar = `<div class="calendar-tools"><label class="calendar-search-wrap"><span>جستجوی سریال</span><input id="calendar-search" type="search" placeholder="نام سریال…" autocomplete="off"></label><label class="calendar-network-wrap"><span>شبکه</span><select id="calendar-network"><option value="">همهٔ شبکه‌ها</option></select></label><button id="calendar-today" class="calendar-today" type="button">برو به امروز</button></div>
<div class="calendar-meta"><p id="calendar-status" role="status">در حال دریافت برنامه…</p></div>
<p id="calendar-note" class="calendar-stale" hidden></p><nav id="calendar-strip" class="calendar-strip" aria-label="روزهای پخش"></nav><div id="calendar-feed" class="calendar-feed"></div>
<p class="calendar-credit"><a id="calendar-source" href="https://dizilah.com/calendar" target="_blank" rel="noopener noreferrer">قدرت‌گرفته از دیزیلا ↗</a></p>`;
  const body = `
<main class="app-shell${isCalendar ? " calendar-shell" : ""}">
<section class="intro"><span class="kicker">${kicker}</span><h1>${h1}</h1><p>${sub}</p></section>
${isCalendar ? calendar : containerId === "no-search" ? "" : search}
${isCalendar ? "" : `<section class="feed-section"><div id="list" class="${containerId}"></div></section>`}
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["diziler/", "☰", "سریال‌ها", active === "diziler/"], ["takvim/", "▤", "تقویم", active === "takvim/"], ["ara/", "⌕", "جستجو", active === "ara/"]])}`;
  return h + body + boot(root, {}, [script], version);
}

// ---- Ratings page (full TİAK table; moved off the homepage) ----------------
function ratingsPage() {
  const root = "../";
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "ریتینگ تلویزیون ترکیه", url: `${BASE}/reyting/` };
  const h = head(root, { title: "ریتینگ روزانهٔ تلویزیون ترکیه (Total، AB، ABC1) | مشکی مدیا", desc: "جدول ریتینگ روزانه و مقایسهٔ روند سریال‌های در حال پخش در Total، AB و ABC1، با دادهٔ رسمی موجود.", path: "reyting/", jsonld, version: "20260930weekly" });
  const body = `
<main class="app-shell">
<section class="intro"><h1>ریتینگ تلویزیون ترکیه</h1><p>آخرین روز ثبت‌شده: <span id="fetched-at">در حال دریافت…</span> · جدول رسمی TİAK و ریتینگ‌های بازبینی‌شدهٔ دیزیلا با منبع جداگانه</p></section>
<section class="summary-card" aria-label="خلاصه ریتینگ"><div class="summary-number"><strong id="summary-count">—</strong><span>برنامه در جدول</span></div><div class="summary-number"><strong id="summary-date">—</strong><span>تاریخ</span></div><div class="summary-number"><strong id="summary-top">—</strong><span>بالاترین</span></div><div class="spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></section>
<section id="leader" class="leader-card"><div><small>صدرنشین این روز</small><h2 id="top-program">در حال دریافت داده…</h2><span id="top-network">—</span></div><strong id="top-rating">—</strong></section>
<section id="trends" class="trend-section"><div class="feed-label"><span>مقایسهٔ روند سریال‌های در حال پخش</span><i></i></div><h2>هر سریال، پخش‌به‌پخش</h2><p class="trend-help">محور افقی تاریخ واقعی پخش است. هر خط، ریتینگ یا رتبهٔ قسمت‌های یک سریال را نشان می‌دهد. روی نقطه مکث کنید تا نام سریال، شمارهٔ قسمت، تاریخ و مقدار را ببینید؛ سریال‌های تک‌داده‌ای در فهرست پایین هستند.</p><div class="trend-controls"><div id="trend-modes" class="trend-switch" role="group" aria-label="دستهٔ مخاطب"></div><div id="trend-metric" class="trend-switch" role="group" aria-label="نوع سنجه"></div></div><div id="trend-chart"></div><div id="trend-legend" class="trend-legend"></div><p id="trend-note" class="trend-help"></p><div id="trend-analysis" class="trend-analysis"></div><div id="trend-details" class="trend-details"></div></section>
<section id="weekly" class="trend-section"><div class="feed-label"><span>جدول هفتگی</span><i></i></div><h2>سریال‌های برتر هر هفته</h2><div id="weekly-content"><div class="notice">در حال بارگذاری…</div></div></section>
<section id="ratings" class="feed-section">
<div class="feed-label"><span>جدول ریتینگ</span><i></i></div><p class="trend-help"><a href="${root}social/">اتاق انتشار: کارت و کپشن آماده برای اینستاگرام و X ←</a></p>
<div class="cat-tabs" id="cat-tabs" role="group" aria-label="حالت ریتینگ"></div>
<p class="cat-note" id="cat-note"></p>
<div class="day-strip"><span class="day-strip-label">ماه اخیر، تاریخ‌های دارای داده:</span><div class="day-tabs" id="day-tabs"></div></div>
<div class="filter-row" role="group" aria-label="فیلتر برنامه‌ها"><button class="filter active" data-filter="all">همه</button><button class="filter" data-filter="series">سریال‌ها</button><button class="filter" data-filter="entertainment">سرگرمی</button><button class="filter" data-filter="news">خبر</button><select id="net-filter" class="net-filter" aria-label="فیلتر شبکه"></select></div>
<div id="loading" class="notice">در حال بارگذاری آخرین دادهٔ منتشرشده…</div>
<div id="error" class="notice error" hidden>داده موقتاً در دسترس نیست؛ سامانه دوباره تلاش می‌کند.</div>
<div id="ratings-list" class="ratings-list" hidden></div>
</section>
<section id="method" class="method-card"><span>شفافیت داده</span><h2>عدد حدس نمی‌زنیم.</h2><p>رتبه و درصد ریتینگ Total، AB و ABC1 از جدول روزانهٔ عمومی TİAK خوانده می‌شود. این جدول در هر دسته فقط ۱۰ برنامهٔ اول را منتشر می‌کند؛ نبودن یک سریال در فهرست به معنی صفر بودن ریتینگ آن نیست. پخش اصلی با ردیف‌های خلاصه (Özet) یکی نمی‌شود.</p><a href="https://tiak.com.tr/tablolar" target="_blank" rel="noreferrer">مشاهده جدول رسمی ↗</a></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["diziler/", "☰", "سریال‌ها"], ["takvim/", "▤", "تقویم"], ["reyting/", "⌁", "ریتینگ", true]])}`;
  return h + body + boot(root, {}, ["rating-trends.js", "ratings.js"], "20260930weekly");
}

// ---- write all -------------------------------------------------------------
const count = { logos: 0, networks: 0, series: 0, episodes: 0, actors: 0, characters: 0, works: 0, lists: 0 };
const urls = [{ loc: `${BASE}/`, pri: "1.0" }];

await mkdir(p("images/networks/"), { recursive: true });
for (const net of Object.values(networks)) {
  const officialLogo = new URL(`network-logos/${net.slug}.svg`, import.meta.url);
  const logo = existsSync(officialLogo) ? await readFile(officialLogo, "utf8") : networkSvg(net);
  await writeFile(p(`images/networks/${net.slug}.svg`), logo, "utf8"); count.logos++;
  await mkdir(p(`kanal/${net.slug}/`), { recursive: true });
  await writeFile(p(`kanal/${net.slug}/index.html`), networkPage(net), "utf8"); count.networks++;
  urls.push({ loc: `${BASE}/kanal/${net.slug}/`, pri: "0.6" });
}
await mkdir(p("kanal/"), { recursive: true });
await writeFile(p("kanal/index.html"), listPage({ path: "kanal/", title: "شبکه‌ها | مشکی مدیا", desc: "فهرست شبکه‌های تلویزیون ترکیه و سریال‌هایشان در مشکی مدیا.", kicker: "شبکه‌ها", h1: "شبکه‌ها", sub: "سریال‌ها را بر اساس شبکه مرور کنید", containerId: "net-grid no-search", script: "networks-index.js", active: "kanal/" }), "utf8");
urls.push({ loc: `${BASE}/kanal/`, pri: "0.7" });

for (const s of seriesArr) {
  await mkdir(p(`dizi/${s.slug}/`), { recursive: true });
  const episodes = (s.seasons || []).flatMap((season) => season.episodes || []);
  for (const [date, entries] of Object.entries(calendar.days || {})) for (const entry of entries) {
    if (entry.slug === s.slug && Number.isInteger(Number(entry.episode)) && !episodes.some((ep) => ep.date === date || Number(ep.number) === Number(entry.episode))) {
      episodes.push({ number: Number(entry.episode), season: entry.season, date, scheduled: true });
    }
  }
  const validEpisodeDirs = new Set(episodes.map((ep) => `bolum-${ep.number}`));
  for (const entry of await readdir(p(`dizi/${s.slug}/`), { withFileTypes: true })) {
    if (entry.isDirectory() && /^bolum-\d+$/.test(entry.name) && !validEpisodeDirs.has(entry.name)) {
      await rm(p(`dizi/${s.slug}/${entry.name}/`), { recursive: true, force: true });
    }
  }
  await writeFile(p(`dizi/${s.slug}/index.html`), seriesPage(s), "utf8"); count.series++;
  urls.push({ loc: `${BASE}/dizi/${s.slug}/`, pri: "0.8" });
  for (const legacy of ["profile.js", "profile.css"]) { const lp = p(`dizi/${s.slug}/${legacy}`); if (existsSync(lp)) await rm(lp); }
  for (const ep of episodes) {
    await mkdir(p(`dizi/${s.slug}/bolum-${ep.number}/`), { recursive: true });
    await writeFile(p(`dizi/${s.slug}/bolum-${ep.number}/index.html`), episodePage(s, ep), "utf8"); count.episodes++;
    urls.push({ loc: `${BASE}/dizi/${s.slug}/bolum-${ep.number}/`, pri: "0.6" });
  }
}
for (const pr of Object.values(people)) {
  await mkdir(p(`oyuncu/${pr.slug}/`), { recursive: true });
  await writeFile(p(`oyuncu/${pr.slug}/index.html`), actorPage(pr), "utf8"); count.actors++;
  urls.push({ loc: `${BASE}/oyuncu/${pr.slug}/`, pri: "0.5" });
}
for (const ch of Object.values(characters)) {
  await mkdir(p(`karakter/${ch.slug}/`), { recursive: true });
  await writeFile(p(`karakter/${ch.slug}/index.html`), characterPage(ch), "utf8"); count.characters++;
  urls.push({ loc: `${BASE}/karakter/${ch.slug}/`, pri: "0.4" });
}
for (const w of Object.values(works)) {
  await mkdir(p(`asar/${w.slug}/`), { recursive: true });
  await writeFile(p(`asar/${w.slug}/index.html`), workPage(w), "utf8"); count.works++;
  urls.push({ loc: `${BASE}/asar/${w.slug}/`, pri: "0.4" });
}

// ---- News item pages -------------------------------------------------------
const nf = new Intl.NumberFormat("fa-IR", { useGrouping: false });
const faDateLong = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "long", timeZone: "Asia/Tehran" });
const faTime = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
const KIND_FA = { official: "رسمی", media: "گزارش رسانه", rumor: "شایعه / ادعا" };
const newsWithPage = newsData.items.filter((i) => i.titleFa && Array.isArray(i.bodyFa) && i.bodyFa.length && /^https:\/\//.test(i.url || ""));
const pageIds = new Set(newsWithPage.map((i) => i.id));

// Latest published Total rating of a series (TİAK public Top 10), or null.
function latestRating(s) {
  const key = String(s.ratingKey || "").toUpperCase().trim();
  if (!key) return null;
  for (const day of ratings.days || []) {
    const row = (day.categories?.total || []).find((r) => String(r.program || "").toUpperCase().trim() === key);
    if (row) { const [d, m, y] = day.date.split("."); return { rating: row.rating, rank: row.rank, iso: `${y}-${m}-${d}` }; }
  }
  return null;
}

function newsItemPage(item) {
  const root = "../../";
  const ent = item.entities || {};
  const relSeries = (ent.series || []).map((k) => series[k]).filter(Boolean);
  const relPeople = (ent.people || []).map((k) => people[k]).filter(Boolean).slice(0, 6);
  const relNets = (ent.networks || []).map((k) => networks[k]).filter(Boolean);
  const url = `${BASE}/haber/${item.id}/`;
  const when = new Date(item.published);
  const lead = item.summaryFa || item.bodyFa[0];
  const jsonld = { "@context": "https://schema.org", "@type": "NewsArticle", headline: item.titleFa, datePublished: item.published, inLanguage: "fa", url, isBasedOn: item.url,
    author: { "@type": "Organization", name: "مشکی مدیا" }, publisher: { "@type": "Organization", name: "مشکی مدیا", logo: { "@type": "ImageObject", url: BASE + LOGO } } };
  if (item.image) jsonld.image = item.image;
  const h = head(root, { title: `${item.titleFa} | اخبار مشکی مدیا`, desc: lead.slice(0, 180), path: `haber/${item.id}/`, ogImage: item.image || undefined, ogType: "article", jsonld });
  const video = item.video && /^[\w-]{11}$/.test(item.video.id) ? item.video.id : "";
  const ratingCards = relSeries.slice(0, 3).map((s) => {
    const r = latestRating(s);
    if (!r) return "";
    return `<a class="news-rating" href="${root}dizi/${s.slug}/"><span>${esc(s.titleFa)}</span><strong>${nf.format(r.rating)}٪</strong><small>Total · رتبهٔ ${nf.format(r.rank)} · ${esc(faDateLong.format(new Date(r.iso + "T12:00:00Z")))}</small></a>`;
  }).join("");
  const related = newsWithPage.filter((o) => o.id !== item.id && ((o.entities?.series || []).some((k) => (ent.series || []).includes(k)) || (o.entities?.people || []).some((k) => (ent.people || []).includes(k)) || (o.entities?.networks || []).some((k) => (ent.networks || []).includes(k)))).slice(0, 4);
  const more = related.length ? related : newsWithPage.filter((o) => o.id !== item.id && o.scope !== "general").slice(0, 4);
  const shareText = encodeURIComponent(`${item.titleFa} — مشکی مدیا`);
  const shareUrl = encodeURIComponent(url);
  const body = `
<main class="profile-shell news-article">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a href="${root}haber/">اخبار</a></div>
<article>
<header class="news-article-head">
<div class="news-meta"><span class="news-kind kind-${esc(item.kind)}">${KIND_FA[item.kind] || KIND_FA.media}</span><span>${esc(item.sourceName)}</span><time datetime="${esc(item.published)}">${esc(faDateLong.format(when))} · ${esc(faTime.format(when))}</time></div>
<h1>${esc(item.titleFa)}</h1>
${item.lang === "tr" ? `<p class="news-orig" lang="tr" dir="ltr">${esc(item.title)}</p>` : ""}
</header>
${item.image ? `<figure class="news-hero"><img src="${esc(item.image)}" alt="" referrerpolicy="no-referrer" loading="eager" onerror="this.parentElement.remove()"><figcaption>تصویر: ${esc(item.sourceName)}</figcaption></figure>` : ""}
${item.kind === "rumor" ? `<p class="news-warn">این مطلب تأییدنشده است و فقط گزارش یا ادعای رسانه‌ها را بازگو می‌کند.</p>` : ""}
${lead ? `<p class="news-lead">${esc(lead)}</p>` : ""}
<div class="news-text">${item.bodyFa.filter((x) => x !== lead).map((x) => `<p>${esc(x)}</p>`).join("")}</div>
${video ? `<div class="news-actions"><button type="button" class="news-video-btn" data-video="${video}">▶ پخش ویدئو</button></div><div class="news-video" hidden></div>` : ""}
<p class="news-source"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer nofollow">متن کامل و تصاویر اصلی در ${esc(item.sourceName)} ↗</a></p>
<p class="news-disclaimer">این صفحه خلاصه‌ای مستقل به فارسی از گزارش «${esc(item.sourceName)}» است و با کمک هوش مصنوعی تهیه شده؛ ممکن است در ترجمه یا برداشت خطا داشته باشد. برای متن دقیق به منبع مراجعه کنید.</p>
</article>
${ratingCards ? `<section class="profile-section"><div class="section-headline"><div><span>ریتینگ زنده</span><h2>سریال‌های این خبر در جدول تیاک</h2></div></div><div class="news-ratings">${ratingCards}</div></section>` : ""}
${relSeries.length || relPeople.length || relNets.length ? `<section class="profile-section"><div class="section-headline"><div><span>مرتبط</span><h2>سریال‌ها، بازیگران و شبکه‌های این خبر</h2></div></div>
<div class="news-entities">
${relSeries.map((s) => `<a class="news-entity" href="${root}dizi/${s.slug}/"><span class="ne-photo"${s.hero ? ` style="background-image:url('${esc(s.hero)}')"` : ""}></span><span><strong>${esc(s.titleFa)}</strong><small>سریال</small></span></a>`).join("")}
${relPeople.map((pr) => `<a class="news-entity" href="${root}oyuncu/${pr.slug}/"><span class="ne-photo ne-round"${pr.photo ? ` style="background-image:url('${esc(pr.photo)}')"` : ""}></span><span><strong>${esc(pr.nameFa || pr.name)}</strong><small>بازیگر</small></span></a>`).join("")}
${relNets.map((n) => `<a class="news-entity" href="${root}kanal/${n.slug}/"><span class="ne-photo ne-net" style="background:${esc(n.color)}">${esc((n.abbr || n.name).slice(0, 4))}</span><span><strong>${esc(n.name)}</strong><small>شبکه</small></span></a>`).join("")}
</div></section>` : ""}
<section class="profile-section"><div class="section-headline"><div><span>اشتراک‌گذاری</span><h2>این خبر را بفرستید</h2></div></div>
<div class="news-share"><a href="https://t.me/share/url?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener noreferrer">تلگرام</a><a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener noreferrer">واتس‌اپ</a><a href="https://x.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener noreferrer">ایکس</a><button type="button" data-copy="${esc(url)}">کپی پیوند</button></div></section>
${more.length ? `<section class="profile-section"><div class="section-headline"><div><span>بیشتر بخوانید</span><h2>خبرهای مرتبط</h2></div><a class="gallery-source" href="${root}haber/">همهٔ اخبار ↗</a></div>
<div class="news-feed">${more.map((o) => `<article class="news-card kind-${esc(o.kind)}">${o.image ? `<a class="news-thumb" href="${root}haber/${o.id}/" tabindex="-1" aria-hidden="true"><img src="${esc(o.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></a>` : ""}<div class="news-body"><div class="news-meta"><span class="news-kind">${KIND_FA[o.kind] || KIND_FA.media}</span><span>${esc(o.sourceName)}</span></div><h3><a href="${root}haber/${o.id}/">${esc(o.titleFa)}</a></h3></div></article>`).join("")}</div></section>` : ""}
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["diziler/", "☰", "سریال‌ها"], ["haber/", "✎", "اخبار", true], ["takvim/", "▤", "تقویم"]])}`;
  return h + body + boot(root, {}, ["news.js"], "20260930news2");
}

// ---- News page -------------------------------------------------------------
function newsPage() {
  const root = "../";
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "اخبار سریال‌های ترکی", url: `${BASE}/haber/`, inLanguage: "fa" };
  const h = head(root, { title: "اخبار سریال‌های ترکی و بازیگران | مشکی مدیا", desc: "آخرین خبرهای رسانه‌های ترکیه دربارهٔ سریال‌ها، بازیگران و شبکه‌ها؛ هر خبر با لینک منبع و پیوند به صفحهٔ سریال و بازیگر مرتبط.", path: "haber/", jsonld });
  const body = `
<main class="app-shell">
<section class="intro"><span class="kicker">اخبار</span><h1>اخبار دنیای سریال‌های ترکی</h1><p>خبرهای رسانه‌های ترکیه دربارهٔ سریال‌ها، بازیگران و شبکه‌ها؛ هر خبر با لینک منبع و پیوند به صفحهٔ مرتبط.</p></section>
<section class="feed-section"><div id="news-page" class="news-page"><div class="notice">در حال بارگذاری اخبار…</div></div>
<p class="news-policy">خبرها از فید رسانه‌های ترکیه گردآوری می‌شوند؛ ما فقط عنوان، خلاصهٔ کوتاه و پیوند منبع را نشان می‌دهیم و متن کامل خبر در سایت منبع است. برچسب «شایعه / ادعا» یعنی خبر تأییدنشده. مطالب دربارهٔ سلامت، اتهام‌های جنایی و کودکان منتشر نمی‌شود.</p></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["diziler/", "☰", "سریال‌ها"], ["haber/", "✎", "اخبار", true], ["takvim/", "▤", "تقویم"]])}`;
  return h + body + boot(root, {}, ["news.js"], "20260930news");
}

// list pages
const lists = [
  { path: "diziler/", title: "همهٔ سریال‌ها | مشکی مدیا", desc: "فهرست کامل سریال‌های در حال پخش تلویزیون ترکیه با شبکه، روز پخش و ریتینگ.", kicker: "فهرست", h1: "سریال‌ها", sub: "همهٔ سریال‌ها و سرگرمی‌های ثبت‌شده", containerId: "series-grid", script: "list-series.js", active: "diziler/" },
  { path: "oyuncular/", title: "بازیگران | مشکی مدیا", desc: "فهرست بازیگران سریال‌های ترکی با نقش‌ها و کارنامه.", kicker: "فهرست", h1: "بازیگران", sub: "بازیگران ثبت‌شده و سریال‌هایشان", containerId: "people-grid", script: "list-actors.js", active: "oyuncular/" },
  { path: "karakterler/", title: "کاراکترها | مشکی مدیا", desc: "فهرست کاراکترهای سریال‌های ترکی و بازیگرانشان.", kicker: "فهرست", h1: "کاراکترها", sub: "کاراکترهای ثبت‌شده", containerId: "people-grid", script: "list-characters.js", active: "karakterler/" },
  { path: "ozetler/", title: "آرشیو خلاصه‌ها (ری‌کپ) | مشکی مدیا", desc: "آرشیو خلاصهٔ داستان (ری‌کپ) قسمت‌های سریال‌های ترکی.", kicker: "آرشیو", h1: "خلاصه‌ها / ری‌کپ", sub: "خلاصهٔ داستان قسمت‌ها", containerId: "recap-list", script: "recaps.js", active: "ozetler/" },
  { path: "fragmanlar/", title: "آرشیو فراگمان‌ها (تیزر) | مشکی مدیا", desc: "آرشیو فراگمان (تیزر) سریال‌ها و قسمت‌های تلویزیون ترکیه.", kicker: "آرشیو", h1: "فراگمان‌ها", sub: "تیزر سریال‌ها و قسمت‌ها", containerId: "fragman-grid", script: "fragmans.js", active: "fragmanlar/" },
  { path: "takvim/", title: "تقویم پخش سریال‌های ترکی | مشکی مدیا", desc: "برنامهٔ پخش روزانهٔ سریال‌های ترکی با نام سریال، شبکه و شمارهٔ فصل و قسمت.", kicker: "برنامهٔ روزانه", h1: "تقویم پخش", sub: "سریال‌ها، شبکه‌ها و شمارهٔ قسمت‌ها به تفکیک روز", containerId: "calendar no-search", script: "calendar.js", active: "takvim/" },
  { path: "ara/", title: "جستجو | مشکی مدیا", desc: "جستجو در سریال‌ها، بازیگران، کاراکترها و قسمت‌های مشکی مدیا.", kicker: "جستجو", h1: "جستجو", sub: "در سریال‌ها، بازیگران، کاراکترها و قسمت‌ها", containerId: "search-results", script: "search.js", active: "ara/" },
];
for (const l of lists) { await mkdir(p(l.path), { recursive: true }); await writeFile(p(l.path + "index.html"), listPage(l), "utf8"); count.lists++; urls.push({ loc: `${BASE}/${l.path}`, pri: "0.7" }); }
for (const item of newsWithPage) {
  await mkdir(p(`haber/${item.id}/`), { recursive: true });
  await writeFile(p(`haber/${item.id}/index.html`), newsItemPage(item), "utf8");
  urls.push({ loc: `${BASE}/haber/${item.id}/`, pri: "0.5" });
}
// Light public feed for the browser (no article text): the full news.json stays the source of truth.
const feedItems = newsData.items.slice(0, 400).map(({ snippet, bodyFa, aiTries, aiFailed, ...rest }) => ({ ...rest, page: pageIds.has(rest.id) }));
await writeFile(p("data/news-feed.json"), JSON.stringify({ updated: newsData.updated || null, items: feedItems }) + "\n", "utf8");
count.newsPages = newsWithPage.length;
await mkdir(p("haber/"), { recursive: true });
await writeFile(p("haber/index.html"), newsPage(), "utf8"); count.lists++;
urls.push({ loc: `${BASE}/haber/`, pri: "0.8" });
await mkdir(p("reyting/"), { recursive: true });
await writeFile(p("reyting/index.html"), ratingsPage(), "utf8"); count.lists++;
urls.push({ loc: `${BASE}/reyting/`, pri: "0.8" });

// ---- search index ----------------------------------------------------------
const searchIndex = [];
for (const s of seriesArr) searchIndex.push({ t: "series", titleFa: s.titleFa, titleTr: s.titleTr, sub: (networks[s.network] || {}).name || "", url: `dizi/${s.slug}/` });
for (const s of seriesArr) for (const se of s.seasons || []) for (const e of se.episodes || []) searchIndex.push({ t: "episode", titleFa: `${s.titleFa} — قسمت ${e.number}`, titleTr: e.title || "", sub: s.titleTr, url: `dizi/${s.slug}/bolum-${e.number}/` });
for (const pr of Object.values(people)) searchIndex.push({ t: "actor", titleFa: pr.nameFa || pr.name, titleTr: pr.name, sub: "بازیگر", url: `oyuncu/${pr.slug}/` });
for (const ch of Object.values(characters)) searchIndex.push({ t: "character", titleFa: ch.nameFa || ch.name, titleTr: ch.name + (ch.personNameFa ? " · " + ch.personNameFa : ""), sub: ch.seriesTitleFa, url: `karakter/${ch.slug}/` });
for (const w of Object.values(works)) searchIndex.push({ t: "work", titleFa: w.titleFa || w.titleTr, titleTr: w.titleTr, sub: w.kind === "film" ? "فیلم" : "سریال", url: `asar/${w.slug}/` });
for (const net of Object.values(networks)) searchIndex.push({ t: "network", titleFa: net.name, titleTr: net.nameFa || "", sub: "شبکه", url: `kanal/${net.slug}/` });
await writeFile(p("data/search-index.json"), JSON.stringify(searchIndex) + "\n", "utf8");

// ---- sitemap.xml + robots.txt ----------------------------------------------
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u.loc}</loc><priority>${u.pri}</priority></url>`).join("\n")}
</urlset>
`;
await writeFile(p("sitemap.xml"), sitemap, "utf8");
await writeFile(p("robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`, "utf8");

console.log(`Built: ${count.logos} logos, ${count.networks} networks, ${count.series} series, ${count.episodes} episodes, ${count.actors} actors, ${count.characters} characters, ${count.works} works, ${count.lists} lists, ${count.newsPages || 0} news pages, ${urls.length} sitemap urls, ${searchIndex.length} search entries.`);
