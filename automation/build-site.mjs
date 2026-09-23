// Generates the whole static site (pages + SEO + sitemap + search index) from JSON.
// Data-driven: edit github-pages/data/*.json and re-run.
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const PAGES = new URL("../github-pages/", import.meta.url);
const p = (rel) => new URL(rel, PAGES);
const BASE = "https://nimania.github.io/meshkimedia";
const LOGO = "/images/meshki-media-logo.png";

const networks = JSON.parse(await readFile(p("data/networks.json"), "utf8"));
const series = JSON.parse(await readFile(p("data/series.json"), "utf8"));
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
const people = {};
const characters = {};
for (const s of seriesArr) {
  for (const c of s.cast || []) {
    if (c.name) {
      const slug = slugify(c.name);
      const pr = (people[slug] = people[slug] || { slug, name: c.name, nameFa: "", photo: "", credits: [] });
      if (!pr.nameFa && c.nameFa) pr.nameFa = c.nameFa;
      if (!pr.photo && c.image) pr.photo = c.image;
      pr.credits.push({ seriesSlug: s.slug, seriesTitleFa: s.titleFa, character: c.role || "", characterFa: c.roleFa || "" });
    }
    if (c.role) {
      const slug = slugify(s.slug + "-" + c.role);
      characters[slug] = { slug, name: c.role, nameFa: c.roleFa || "", seriesSlug: s.slug, seriesTitleFa: s.titleFa, personName: c.name || "", personNameFa: c.nameFa || "", personSlug: c.name ? slugify(c.name) : "", image: c.image || "" };
    }
  }
}

// ---- shared HTML shell with full SEO ---------------------------------------
const SITE_NAV = (root, active) => {
  const items = [
    ["", "خانه"], ["diziler/", "سریال‌ها"], ["takvim/", "تقویم"], ["ozetler/", "خلاصه‌ها"], ["fragmanlar/", "فراگمان‌ها"],
    ["reyting/", "ریتینگ"], ["oyuncular/", "بازیگران"], ["karakterler/", "کاراکترها"], ["kanal/", "شبکه‌ها"], ["ara/", "جستجو"],
  ];
  return `<nav class="site-nav" aria-label="بخش‌ها">${items.map(([h, t]) => `<a href="${root}${h}"${active === h ? ' class="on"' : ""}>${t}</a>`).join("")}</nav>`;
};

function head(root, { title, desc, path, ogImage, jsonld, ogType = "website" }) {
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
<link rel="stylesheet" href="${root}styles.css?v=20260923a">
<script>try{var t=localStorage.getItem("dizimeter-theme");if(!t&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)t="dark";if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>${ld}
</head>
<body>
<header class="app-header"><a class="brand" href="${root}"><img class="brand-logo" src="${root}images/meshki-media-logo.png" alt="مشکی مدیا" width="34" height="34"><span class="brand-text"><strong>مشکی مدیا</strong><span>دنیای سریال‌های ترکی</span></span></a><div class="header-actions"><button id="theme-toggle" class="icon-button" aria-label="روشن یا تیره">◐</button><a class="icon-button" href="${root}ara/" aria-label="جستجو">⌕</a></div></header>
${SITE_NAV(root, path.split("/")[0] === "" ? "" : (path.split("/").slice(0, 1)[0] + "/"))}`;
}
const boot = (root, obj, scripts) => `<script>window.DM=${JSON.stringify(Object.assign({ root }, obj))};</script>
<script src="${root}dizimeter.js?v=20260923a" defer></script>
${scripts.map((s) => `<script src="${root}${s}?v=20260923a" defer></script>`).join("\n")}
</body></html>
`;
const BOTTOM = (root, items) => `<nav class="bottom-nav">${items.map(([h, b, t, on]) => `<a href="${root}${h}"${on ? ' class="active"' : ""}><b>${b}</b><span>${t}</span></a>`).join("")}</nav>`;

// ---- network SVG mark ------------------------------------------------------
function networkSvg(net) {
  const label = net.abbr || net.name;
  const w = Math.max(96, 30 + label.length * 15);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 40" width="${w}" height="40" role="img" aria-label="${esc(net.name)}">
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
  const h = head(root, { title: `${s.titleFa} (${s.titleTr}) | مشکی مدیا`, desc: (s.synopsis || `پروفایل، بازیگران و ری‌کپ قسمت‌های ${s.titleFa}`).slice(0, 180), path: `dizi/${s.slug}/`, ogImage: img, ogType: "video.tv_show", jsonld });
  const body = `
<main class="profile-shell">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a href="${root}diziler/">سریال‌ها</a><span>/</span><span id="net-badge"></span></div>
<section id="profile-hero" class="profile-hero"><div class="hero-cover"></div><div class="profile-title">
<div class="profile-tags"><span id="kind-tag">سریال</span><span id="status"></span></div>
<h1 id="title-fa">${esc(s.titleFa)}</h1><p id="title-tr" dir="ltr">${esc(s.titleTr)}</p>
<div class="profile-facts"><span id="network"></span><span id="airing"></span><span id="studio"></span></div>
<div id="genre" class="genre-chips"></div></div></section>
<section class="profile-section"><div class="section-kicker">داستان</div><p id="synopsis" class="synopsis"></p><div id="official-links" class="official-links"></div></section>
<section id="cast-section" class="profile-section"><div class="section-headline"><div><span>بازیگران و کاراکترها</span><h2>کست اصلی</h2></div><small>منبع: شبکهٔ پخش</small></div><div id="cast" class="cast-grid"></div></section>
<section class="profile-section"><div class="section-headline"><div><span>قسمت‌ها</span><h2>ری‌کپ و ریتینگ قسمت‌ها</h2></div><small>Total · AB · ABC1</small></div><div id="episodes" class="episodes"></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], [`dizi/${s.slug}/#episodes`, "☰", "قسمت‌ها", true], [`dizi/${s.slug}/#cast`, "◉", "بازیگران"], [net ? `kanal/${net.slug}/` : "", "▦", "شبکه"]])}`;
  return h + body + boot(root, { slug: s.slug }, ["series-page.js"]);
}

// ---- Episode page ----------------------------------------------------------
function episodePage(s, ep) {
  const root = "../../../";
  const net = networks[s.network];
  const img = ep.image || (ep.images && ep.images[0]) || s.hero || "";
  const jsonld = { "@context": "https://schema.org", "@type": "TVEpisode", name: ep.title || `قسمت ${ep.number}`, episodeNumber: ep.number, url: `${BASE}/dizi/${s.slug}/bolum-${ep.number}/`, partOfSeries: { "@type": "TVSeries", name: s.titleTr, url: `${BASE}/dizi/${s.slug}/` } };
  if (ep.date) jsonld.datePublished = ep.date;
  if (img) jsonld.image = img;
  if (ep.summary) jsonld.description = ep.summary.slice(0, 300);
  const h = head(root, { title: `${s.titleFa} — قسمت ${ep.number}${ep.title ? "؛ " + ep.title : ""} | مشکی مدیا`, desc: (ep.summary || `ریتینگ، عکس‌ها و خلاصهٔ قسمت ${ep.number} سریال ${s.titleFa}`).slice(0, 180), path: `dizi/${s.slug}/bolum-${ep.number}/`, ogImage: img, ogType: "video.episode", jsonld });
  const body = `
<main class="profile-shell">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a id="crumb-series" href="#">سریال</a><span>/</span><span>قسمت ${ep.number}</span></div>
<section id="ep-hero" class="ep-hero"><span id="ep-badge" class="net-chip"></span><div class="ep-hero-copy"><p class="ep-kicker" id="ep-kicker"></p><h1 id="ep-title">قسمت ${ep.number}</h1><div class="ep-facts" id="ep-facts"></div></div></section>
<section class="ep-block ratings-big"><span class="kicker">ریتینگ این قسمت</span><h2>Total · AB · ABC1</h2><div id="ep-ratings"></div><p class="ratings-note" id="ratings-note"></p></section>
<section id="gallery-section" class="ep-block"><span class="kicker">تصاویر قسمت</span><h2>گالری</h2><div id="ep-gallery" class="gallery"></div></section>
<section class="ep-block"><span class="kicker">خلاصهٔ قسمت (ری‌کپ)</span><h2>چه گذشت؟</h2><p id="ep-summary" class="ep-summary"></p><div id="ep-links" class="ep-links"></div></section>
<div id="ep-nav" class="ep-nav"></div>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], [`dizi/${s.slug}/`, "☰", "سریال"], [`dizi/${s.slug}/bolum-${ep.number}/#ep-ratings`, "⌁", "ریتینگ", true], [net ? `kanal/${net.slug}/` : "", "▦", "شبکه"]])}`;
  return h + body + boot(root, { slug: s.slug, epNumber: ep.number }, ["episode-page.js"]);
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
<section id="net-ratings-section" class="feed-section"><div class="feed-label"><span>در جدول اخیر (<span id="net-day-date"></span>)</span><i></i></div><div id="net-ratings"></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["kanal/", "▦", "شبکه‌ها", true], ["diziler/", "☰", "سریال‌ها"], ["#net-series", "⌁", "ریتینگ"]])}`;
  return h + body + boot(root, { slug: net.slug }, ["network-page.js"]);
}

// ---- Actor page ------------------------------------------------------------
function actorPage(pr) {
  const root = "../../";
  const jsonld = { "@context": "https://schema.org", "@type": "Person", name: pr.name, url: `${BASE}/oyuncu/${pr.slug}/` };
  if (pr.photo) jsonld.image = pr.photo;
  if (pr.nameFa) jsonld.alternateName = pr.nameFa;
  const disp = pr.nameFa || pr.name;
  const roles = pr.credits.map((c) => c.characterFa || c.character).filter(Boolean).slice(0, 3).join("، ");
  const h = head(root, { title: `${disp} — بازیگر | مشکی مدیا`, desc: `${disp} (${pr.name})، بازیگر ترکیه‌ای${roles ? "؛ نقش‌ها: " + roles : ""}. سریال‌ها و کاراکترها در مشکی مدیا.`, path: `oyuncu/${pr.slug}/`, ogImage: pr.photo, ogType: "profile", jsonld });
  const body = `
<main class="profile-shell">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a href="${root}oyuncular/">بازیگران</a><span>/</span><span>${esc(disp)}</span></div>
<section class="person-hero"><div class="person-photo ${pr.photo ? "" : "no-image"}" ${pr.photo ? `style="background-image:url('${esc(pr.photo)}')"` : ""}>${pr.photo ? "" : esc(disp.slice(0, 1))}</div><div><span class="kicker">بازیگر</span><h1>${esc(disp)}</h1><p class="muted-line" dir="ltr">${esc(pr.name)}</p><p class="muted-line">${esc(roles || "")}</p></div></section>
<section class="profile-section"><div class="section-headline"><div><span>کارنامه</span><h2>سریال‌ها و کاراکترها</h2></div></div><div id="credits" class="credits-grid"></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["oyuncular/", "◉", "بازیگران", true], ["diziler/", "☰", "سریال‌ها"], ["ara/", "⌕", "جستجو"]])}`;
  return h + body + boot(root, { slug: pr.slug }, ["actor-page.js"]);
}

// ---- Character page --------------------------------------------------------
function characterPage(ch) {
  const root = "../../";
  const disp = ch.nameFa || ch.name;
  const jsonld = { "@context": "https://schema.org", "@type": "Person", name: ch.name, url: `${BASE}/karakter/${ch.slug}/`, description: `کاراکتر سریال ${ch.seriesTitleFa}` };
  if (ch.nameFa) jsonld.alternateName = ch.nameFa;
  const h = head(root, { title: `${disp} — کاراکتر ${ch.seriesTitleFa} | مشکی مدیا`, desc: `${disp}، کاراکتر سریال ${ch.seriesTitleFa}${ch.personNameFa || ch.personName ? "، با بازیِ " + (ch.personNameFa || ch.personName) : ""}.`, path: `karakter/${ch.slug}/`, ogImage: ch.image, ogType: "profile", jsonld });
  const body = `
<main class="profile-shell">
<div class="crumbs"><a href="${root}">خانه</a><span>/</span><a href="${root}karakterler/">کاراکترها</a><span>/</span><span>${esc(disp)}</span></div>
<section class="person-hero"><div class="person-photo ${ch.image ? "" : "no-image"}" ${ch.image ? `style="background-image:url('${esc(ch.image)}')"` : ""}>${ch.image ? "" : esc(disp.slice(0, 1))}</div><div><span class="kicker">کاراکتر</span><h1>${esc(disp)}</h1><p class="muted-line" dir="ltr">${esc(ch.name)}</p><p class="muted-line" id="char-sub"></p></div></section>
<section class="profile-section"><div id="char-info" class="char-info"></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["karakterler/", "◈", "کاراکترها", true], ["diziler/", "☰", "سریال‌ها"], ["ara/", "⌕", "جستجو"]])}`;
  return h + body + boot(root, { slug: ch.slug }, ["character-page.js"]);
}

// ---- Generic list page -----------------------------------------------------
function listPage({ path, title, desc, kicker, h1, sub, containerId, script, active }) {
  const root = "../";
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: `${BASE}/${path}` };
  const h = head(root, { title, desc, path, jsonld });
  const search = `<div class="list-search"><input id="q" type="search" placeholder="جستجو…" aria-label="جستجو"></div>`;
  const body = `
<main class="app-shell">
<section class="intro"><span class="kicker">${kicker}</span><h1>${h1}</h1><p>${sub}</p></section>
${containerId === "no-search" ? "" : search}
<section class="feed-section"><div id="list" class="${containerId}"></div></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["diziler/", "☰", "سریال‌ها", active === "diziler/"], ["takvim/", "▤", "تقویم", active === "takvim/"], ["ara/", "⌕", "جستجو", active === "ara/"]])}`;
  return h + body + boot(root, {}, [script]);
}

// ---- Ratings page (full TİAK table; moved off the homepage) ----------------
function ratingsPage() {
  const root = "../";
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "ریتینگ تلویزیون ترکیه", url: `${BASE}/reyting/` };
  const h = head(root, { title: "ریتینگ روزانهٔ تلویزیون ترکیه (Total، AB، ABC1) | مشکی مدیا", desc: "جدول ریتینگ روزانهٔ تلویزیون ترکیه از منبع رسمی TİAK: Total، AB و ABC1 در ده روز اخیر، با فیلتر شبکه و نوع برنامه.", path: "reyting/", jsonld });
  const body = `
<main class="app-shell">
<section class="intro"><h1>ریتینگ تلویزیون ترکیه</h1><p>آخرین روز ثبت‌شده: <span id="fetched-at">در حال دریافت…</span> · منبع رسمی TİAK</p></section>
<section class="summary-card" aria-label="خلاصه ریتینگ"><div class="summary-number"><strong id="summary-count">—</strong><span>برنامه در جدول</span></div><div class="summary-number"><strong id="summary-date">—</strong><span>تاریخ</span></div><div class="summary-number"><strong id="summary-top">—</strong><span>بالاترین</span></div><div class="spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></section>
<section id="leader" class="leader-card"><div><small>صدرنشین این روز</small><h2 id="top-program">در حال دریافت داده…</h2><span id="top-network">—</span></div><strong id="top-rating">—</strong></section>
<section id="ratings" class="feed-section">
<div class="feed-label"><span>جدول ریتینگ</span><i></i></div>
<div class="cat-tabs" id="cat-tabs" role="group" aria-label="حالت ریتینگ"></div>
<p class="cat-note" id="cat-note"></p>
<div class="day-strip"><span class="day-strip-label">۱۰ روز اخیر:</span><div class="day-tabs" id="day-tabs"></div></div>
<div class="filter-row" role="group" aria-label="فیلتر برنامه‌ها"><button class="filter active" data-filter="all">همه</button><button class="filter" data-filter="series">سریال‌ها</button><button class="filter" data-filter="entertainment">سرگرمی</button><button class="filter" data-filter="news">خبر</button><select id="net-filter" class="net-filter" aria-label="فیلتر شبکه"></select></div>
<div id="loading" class="notice">در حال بارگذاری آخرین دادهٔ منتشرشده…</div>
<div id="error" class="notice error" hidden>داده موقتاً در دسترس نیست؛ سامانه دوباره تلاش می‌کند.</div>
<div id="ratings-list" class="ratings-list" hidden></div>
</section>
<section id="method" class="method-card"><span>شفافیت داده</span><h2>عدد حدس نمی‌زنیم.</h2><p>ریتینگ Total مستقیماً از جدول عمومی TİAK خوانده می‌شود. رتبه‌بندی AB و ABC1 از اعلان‌های رسمی روزانه است؛ اعداد دقیق این دو دسته نیازمند دادهٔ عضویت TİAK است و تا آن زمان تنها رتبه نمایش داده می‌شود.</p><a href="https://tiak.com.tr/" target="_blank" rel="noreferrer">مشاهده منبع رسمی ↗</a></section>
</main>
${BOTTOM(root, [["", "⌂", "خانه"], ["diziler/", "☰", "سریال‌ها"], ["takvim/", "▤", "تقویم"], ["reyting/", "⌁", "ریتینگ", true]])}`;
  return h + body + boot(root, {}, ["ratings.js"]);
}

// ---- write all -------------------------------------------------------------
const count = { logos: 0, networks: 0, series: 0, episodes: 0, actors: 0, characters: 0, lists: 0 };
const urls = [{ loc: `${BASE}/`, pri: "1.0" }];

await mkdir(p("images/networks/"), { recursive: true });
for (const net of Object.values(networks)) {
  await writeFile(p(`images/networks/${net.slug}.svg`), networkSvg(net), "utf8"); count.logos++;
  await mkdir(p(`kanal/${net.slug}/`), { recursive: true });
  await writeFile(p(`kanal/${net.slug}/index.html`), networkPage(net), "utf8"); count.networks++;
  urls.push({ loc: `${BASE}/kanal/${net.slug}/`, pri: "0.6" });
}
await mkdir(p("kanal/"), { recursive: true });
await writeFile(p("kanal/index.html"), listPage({ path: "kanal/", title: "شبکه‌ها | مشکی مدیا", desc: "فهرست شبکه‌های تلویزیون ترکیه و سریال‌هایشان در مشکی مدیا.", kicker: "شبکه‌ها", h1: "شبکه‌ها", sub: "سریال‌ها را بر اساس شبکه مرور کنید", containerId: "net-grid no-search", script: "networks-index.js", active: "kanal/" }), "utf8");
urls.push({ loc: `${BASE}/kanal/`, pri: "0.7" });

for (const s of seriesArr) {
  await mkdir(p(`dizi/${s.slug}/`), { recursive: true });
  await writeFile(p(`dizi/${s.slug}/index.html`), seriesPage(s), "utf8"); count.series++;
  urls.push({ loc: `${BASE}/dizi/${s.slug}/`, pri: "0.8" });
  for (const legacy of ["profile.js", "profile.css"]) { const lp = p(`dizi/${s.slug}/${legacy}`); if (existsSync(lp)) await rm(lp); }
  for (const season of s.seasons || []) for (const ep of season.episodes || []) {
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

// list pages
const lists = [
  { path: "diziler/", title: "همهٔ سریال‌ها | مشکی مدیا", desc: "فهرست کامل سریال‌های در حال پخش تلویزیون ترکیه با شبکه، روز پخش و ریتینگ.", kicker: "فهرست", h1: "سریال‌ها", sub: "همهٔ سریال‌ها و سرگرمی‌های ثبت‌شده", containerId: "series-grid", script: "list-series.js", active: "diziler/" },
  { path: "oyuncular/", title: "بازیگران | مشکی مدیا", desc: "فهرست بازیگران سریال‌های ترکی با نقش‌ها و کارنامه.", kicker: "فهرست", h1: "بازیگران", sub: "بازیگران ثبت‌شده و سریال‌هایشان", containerId: "people-grid", script: "list-actors.js", active: "oyuncular/" },
  { path: "karakterler/", title: "کاراکترها | مشکی مدیا", desc: "فهرست کاراکترهای سریال‌های ترکی و بازیگرانشان.", kicker: "فهرست", h1: "کاراکترها", sub: "کاراکترهای ثبت‌شده", containerId: "people-grid", script: "list-characters.js", active: "karakterler/" },
  { path: "ozetler/", title: "آرشیو خلاصه‌ها (ری‌کپ) | مشکی مدیا", desc: "آرشیو خلاصهٔ داستان (ری‌کپ) قسمت‌های سریال‌های ترکی.", kicker: "آرشیو", h1: "خلاصه‌ها / ری‌کپ", sub: "خلاصهٔ داستان قسمت‌ها", containerId: "recap-list", script: "recaps.js", active: "ozetler/" },
  { path: "fragmanlar/", title: "آرشیو فراگمان‌ها (تیزر) | مشکی مدیا", desc: "آرشیو فراگمان (تیزر) سریال‌ها و قسمت‌های تلویزیون ترکیه.", kicker: "آرشیو", h1: "فراگمان‌ها", sub: "تیزر سریال‌ها و قسمت‌ها", containerId: "fragman-grid", script: "fragmans.js", active: "fragmanlar/" },
  { path: "takvim/", title: "تقویم پخش | مشکی مدیا", desc: "تقویم پخش سریال‌های ترکی با ساعت ترکیه، ایران و آمریکا (لس‌آنجلس).", kicker: "برنامه", h1: "تقویم پخش", sub: "به وقت ترکیه، ایران و آمریکا (PT)", containerId: "calendar no-search", script: "calendar.js", active: "takvim/" },
  { path: "ara/", title: "جستجو | مشکی مدیا", desc: "جستجو در سریال‌ها، بازیگران، کاراکترها و قسمت‌های مشکی مدیا.", kicker: "جستجو", h1: "جستجو", sub: "در سریال‌ها، بازیگران، کاراکترها و قسمت‌ها", containerId: "search-results", script: "search.js", active: "ara/" },
];
for (const l of lists) { await mkdir(p(l.path), { recursive: true }); await writeFile(p(l.path + "index.html"), listPage(l), "utf8"); count.lists++; urls.push({ loc: `${BASE}/${l.path}`, pri: "0.7" }); }
await mkdir(p("reyting/"), { recursive: true });
await writeFile(p("reyting/index.html"), ratingsPage(), "utf8"); count.lists++;
urls.push({ loc: `${BASE}/reyting/`, pri: "0.8" });

// ---- search index ----------------------------------------------------------
const searchIndex = [];
for (const s of seriesArr) searchIndex.push({ t: "series", titleFa: s.titleFa, titleTr: s.titleTr, sub: (networks[s.network] || {}).name || "", url: `dizi/${s.slug}/` });
for (const s of seriesArr) for (const se of s.seasons || []) for (const e of se.episodes || []) searchIndex.push({ t: "episode", titleFa: `${s.titleFa} — قسمت ${e.number}`, titleTr: e.title || "", sub: s.titleTr, url: `dizi/${s.slug}/bolum-${e.number}/` });
for (const pr of Object.values(people)) searchIndex.push({ t: "actor", titleFa: pr.nameFa || pr.name, titleTr: pr.name, sub: "بازیگر", url: `oyuncu/${pr.slug}/` });
for (const ch of Object.values(characters)) searchIndex.push({ t: "character", titleFa: ch.nameFa || ch.name, titleTr: ch.name + (ch.personNameFa ? " · " + ch.personNameFa : ""), sub: ch.seriesTitleFa, url: `karakter/${ch.slug}/` });
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

console.log(`Built: ${count.logos} logos, ${count.networks} networks, ${count.series} series, ${count.episodes} episodes, ${count.actors} actors, ${count.characters} characters, ${count.lists} lists, ${urls.length} sitemap urls, ${searchIndex.length} search entries.`);
