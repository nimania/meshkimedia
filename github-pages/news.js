/* News: renders linked news cards. Exposes window.DMNews.mount(el, filter, options).
   Used by the news page (haber/), series, actor and network pages. Data: data/news.json (built by automation/news-collect.mjs). */
(function () {
  "use strict";
  const D = window.DiziMeter;
  const root = (window.DM && window.DM.root) || "";
  const KINDS = { official: "رسمی", media: "گزارش رسانه", rumor: "شایعه / ادعا" };
  let cache, outlets = {};

  async function load() {
    if (cache) return cache;
    const v = Date.now();
    const [base, news] = await Promise.all([
      D.loadData(),
      fetch(`${root}data/news-feed.json?v=${v}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
    ]);
    cache = { base, items: news.items || [], updated: news.updated, outlets: news.outlets || {} };
    outlets = cache.outlets;
    return cache;
  }

  const https = (u) => (typeof u === "string" && /^https:\/\//.test(u) ? u : "");
  const ago = (iso) => {
    const min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 60) return `${D.fmtInt(Math.max(min, 1))} دقیقه پیش`;
    const h = Math.round(min / 60);
    if (h < 24) return `${D.fmtInt(h)} ساعت پیش`;
    const d = Math.round(h / 24);
    return d < 7 ? `${D.fmtInt(d)} روز پیش` : D.isoToFa(iso);
  };

  function chips(item, base) {
    const out = [];
    for (const s of item.entities.series || []) if (base.series[s]) out.push(`<a class="news-chip chip-series" href="${root}dizi/${s}/">${D.esc(base.series[s].titleFa)}</a>`);
    for (const p of item.entities.people || []) {
      const pr = base.profiles[p];
      const fromCast = pr || { name: p };
      out.push(`<a class="news-chip chip-person" href="${root}oyuncu/${p}/">${D.esc(fromCast.nameFa || fromCast.name)}</a>`);
    }
    for (const n of item.entities.networks || []) if (base.networks[n]) out.push(`<a class="news-chip chip-network" href="${root}kanal/${n}/">${D.esc(base.networks[n].name)}</a>`);
    return out.join("");
  }

  function badge(id, name) {
    const o = outlets[id] || { name, color: "#333", abbr: name };
    return o.logo ? `<span class="outlet-logo has-img"><img src="${root}${D.esc(o.logo)}" alt="${D.esc(o.name)}" loading="lazy"></span>` : `<span class="outlet-logo" style="background:${D.esc(o.color)}">${D.esc(o.abbr)}</span>`;
  }
  // Outlet logos of a story; each logo opens that outlet's own article.
  function logos(item) {
    const src = (item.sources && item.sources.length ? item.sources : [{ source: item.source, name: item.sourceName, url: item.url }]).filter((x) => https(x.url));
    return `<div class="outlet-row">${src.map((x) => `<a href="${D.esc(x.url)}" target="_blank" rel="noopener noreferrer nofollow" title="${D.esc(x.name)}">${badge(x.source, x.name)}</a>`).join("")}${src.length > 1 ? `<span class="outlet-count">${D.fmtInt(src.length)} منبع</span>` : ""}</div>`;
  }

  function card(item, base) {
    const source = https(item.url);
    if (!source) return "";
    // Items with a Persian page open it; the source link stays on the card and on the page.
    const url = item.page ? `${root}haber/${item.id}/` : source;
    const ext = item.page ? "" : ' target="_blank" rel="noopener noreferrer nofollow"';
    const img = https(item.image);
    const fa = item.titleFa && item.titleFa.trim();
    const title = fa ? `<h3><a href="${D.esc(url)}"${ext}>${D.esc(item.titleFa)}</a></h3>`
      : `<h3 lang="${D.esc(item.lang || "tr")}" dir="ltr"><a href="${D.esc(url)}"${ext}>${D.esc(item.title)}</a></h3>`;
    const video = item.video && item.video.provider === "youtube" && /^[\w-]{11}$/.test(item.video.id) ? item.video.id : "";
    return `<article class="news-card kind-${D.esc(item.kind)}">
      ${img ? `<a class="news-thumb" href="${D.esc(url)}"${ext} tabindex="-1" aria-hidden="true"><img src="${D.esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></a>` : ""}
      <div class="news-body">
        <div class="news-meta"><span class="news-kind">${KINDS[item.kind] || KINDS.media}</span><time datetime="${D.esc(item.published)}">${ago(item.published)}</time></div>
        ${title}
        ${item.summaryFa ? `<p class="news-summary">${D.esc(item.summaryFa)}</p>` : ""}
        ${logos(item)}
        <div class="news-chips">${chips(item, base)}</div>
        <div class="news-actions">
          ${item.page ? `<a href="${D.esc(url)}">خواندن خبر</a>` : `<a href="${D.esc(source)}" target="_blank" rel="noopener noreferrer nofollow">ادامه در ${D.esc(item.sourceName)} ↗</a>`}
          ${video ? `<button type="button" class="news-video-btn" data-video="${video}">▶ پخش ویدئو</button>` : ""}
          ${item.ai ? `<span class="news-ai" title="عنوان و خلاصه با هوش مصنوعی از متن منبع ساخته شده است">ترجمهٔ خودکار</span>` : ""}
        </div>
        <div class="news-video" hidden></div>
      </div>
    </article>`;
  }

  function select(items, f = {}) {
    return items.filter((i) => {
      if (f.series && !(i.entities.series || []).includes(f.series)) return false;
      if (f.person && !(i.entities.people || []).includes(f.person)) return false;
      if (f.network && !(i.entities.networks || []).includes(f.network)) return false;
      if (f.kind && i.kind !== f.kind) return false;
      // scope: "site" = about the site's series/actors or TV series in general; "general" = other entertainment news.
      if (f.scope === "site" && i.scope === "general") return false;
      if (f.scope === "general" && i.scope !== "general") return false;
      if (f.q) {
        const hay = `${i.title} ${i.titleFa || ""} ${i.summaryFa || ""}`.toLowerCase();
        if (!hay.includes(f.q.toLowerCase())) return false;
      }
      return true;
    });
  }

  // One delegated listener for every page: video buttons (click-to-load YouTube) and copy-link buttons.
  document.addEventListener("click", (e) => {
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      const done = () => { const old = copy.textContent; copy.textContent = "کپی شد ✓"; setTimeout(() => (copy.textContent = old), 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).then(done, () => {}); else done();
      return;
    }
    const btn = e.target.closest(".news-video-btn");
    if (!btn) return;
    const slot = btn.closest(".news-body, .news-article").querySelector(".news-video");
    if (!slot.hidden) { slot.hidden = true; slot.innerHTML = ""; btn.textContent = "▶ پخش ویدئو"; return; }
    slot.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${btn.dataset.video}?autoplay=1&rel=0" title="ویدئو" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><a class="news-video-link" href="https://www.youtube.com/watch?v=${btn.dataset.video}" target="_blank" rel="noopener noreferrer">اگر ویدئو پخش نشد، در یوتیوب ببینید ↗</a>`;
    slot.hidden = false;
    btn.textContent = "بستن ویدئو";
  });

  /* mount(el, filter, { limit, empty }) — a fixed-filter list (series/actor/network pages). */
  async function mount(el, filter, opts = {}) {
    if (!el) return;
    try {
      const { base, items } = await load();
      const list = select(items, filter);
      const limit = opts.limit || 6;
      const shown = list.slice(0, limit);
      el.innerHTML = shown.length ? shown.map((i) => card(i, base)).join("") : `<div class="notice">${D.esc(opts.empty || "هنوز خبر تأییدشده‌ای برای این مورد ثبت نشده است.")}</div>`;
      if (list.length > limit) {
        const more = document.createElement("button");
        more.type = "button"; more.className = "news-more";
        more.textContent = `نمایش ${D.fmtInt(list.length - limit)} خبر دیگر`;
        more.addEventListener("click", () => { el.innerHTML = list.map((i) => card(i, base)).join(""); more.remove(); });
        el.after(more);
      }
    } catch (e) { console.error(e); el.innerHTML = '<div class="notice error">اخبار موقتاً در دسترس نیست.</div>'; }
  }

  /* page(el) — the full news page with filters. */
  async function page(el) {
    const { base, items, updated } = await load();
    const state = { kind: "", network: "", q: "", scope: "site", shown: 24 };
    const nets = Object.values(base.networks).filter((n) => items.some((i) => (i.entities.networks || []).includes(n.slug)));
    el.innerHTML = `<div class="news-filters">
        <input type="search" id="news-q" placeholder="جستجو در اخبار…" aria-label="جستجو در اخبار">
        <div class="news-kind-tabs" role="group" aria-label="دسته">
          <button type="button" class="on" data-scope="site">سریال و بازیگران</button>
          <button type="button" data-scope="general">سرگرمی عمومی</button>
          <button type="button" data-scope="">همه</button>
        </div>
        <div class="news-kind-tabs" role="group" aria-label="نوع خبر">
          <button type="button" class="on" data-kind="">همه</button>
          ${Object.entries(KINDS).map(([k, t]) => `<button type="button" data-kind="${k}">${t}</button>`).join("")}
        </div>
        <select id="news-net" aria-label="شبکه"><option value="">همهٔ شبکه‌ها</option>${nets.map((n) => `<option value="${D.esc(n.slug)}">${D.esc(n.name)}</option>`).join("")}</select>
      </div>
      <div id="news-trending" class="news-trending"></div>
      <p class="news-updated">${updated ? `آخرین به‌روزرسانی: ${ago(updated)}` : "هنوز خبری جمع‌آوری نشده است."}</p>
      <div id="news-feed" class="news-feed"></div><button type="button" class="news-more" id="news-more" hidden></button>`;
    // "Most talked about this week": series and actors with the most news in the last 7 days.
    const weekAgo = Date.now() - 7 * 864e5;
    const tally = new Map();
    for (const i of items) {
      if (new Date(i.published) < weekAgo) continue;
      for (const s of i.entities.series || []) if (base.series[s]) tally.set(`s:${s}`, (tally.get(`s:${s}`) || 0) + 1);
      for (const p of i.entities.people || []) tally.set(`p:${p}`, (tally.get(`p:${p}`) || 0) + 1);
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (top.length) {
      el.querySelector("#news-trending").innerHTML = `<h2>بیشترین خبر این هفته</h2><div>${top.map(([k, n]) => {
        const [kind, slug] = [k[0], k.slice(2)];
        const label = kind === "s" ? base.series[slug].titleFa : (base.profiles[slug]?.nameFa || base.profiles[slug]?.name || slug);
        return `<a class="news-chip ${kind === "s" ? "chip-series" : "chip-person"}" href="${root}${kind === "s" ? "dizi" : "oyuncu"}/${slug}/">${D.esc(label)} <b>${D.fmtInt(n)}</b></a>`;
      }).join("")}</div>`;
    }
    const feed = el.querySelector("#news-feed");
    const more = el.querySelector("#news-more");
    const draw = () => {
      const list = select(items, state);
      feed.innerHTML = list.slice(0, state.shown).map((i) => card(i, base)).join("") || '<div class="notice">خبری با این فیلتر پیدا نشد.</div>';
      more.hidden = list.length <= state.shown;
      more.textContent = `نمایش بیشتر (${D.fmtInt(list.length - state.shown)})`;
    };
    el.querySelector("#news-q").addEventListener("input", (e) => { state.q = e.target.value.trim(); state.shown = 24; draw(); });
    el.querySelector("#news-net").addEventListener("change", (e) => { state.network = e.target.value; state.shown = 24; draw(); });
    el.querySelectorAll("[data-scope]").forEach((b) => b.addEventListener("click", () => {
      state.scope = b.dataset.scope; state.shown = 24;
      el.querySelectorAll("[data-scope]").forEach((x) => x.classList.toggle("on", x === b));
      draw();
    }));
    el.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => {
      state.kind = b.dataset.kind; state.shown = 24;
      el.querySelectorAll("[data-kind]").forEach((x) => x.classList.toggle("on", x === b));
      draw();
    }));
    more.addEventListener("click", () => { state.shown += 24; draw(); });
    draw();
  }

  /* home strip: the latest stories about the site's series and actors (falls back to general entertainment). */
  async function home(el) {
    const { base, items } = await load();
    let list = select(items, { scope: "site" });
    if (list.length < 3) list = items;
    list = list.slice(0, 6);
    const sec = el.closest("section");
    if (!list.length) { if (sec) sec.hidden = true; return; }
    el.innerHTML = list.map((i) => card(i, base)).join("");
    if (sec) sec.hidden = false;
  }

  window.DMNews = { mount, page, load, select };
  document.addEventListener("DOMContentLoaded", () => {
    const homeEl = document.getElementById("home-news");
    if (homeEl) home(homeEl).catch((e) => { console.error(e); });
    const pageEl = document.getElementById("news-page");
    if (pageEl) page(pageEl).catch((e) => { console.error(e); pageEl.innerHTML = '<div class="notice error">اخبار موقتاً در دسترس نیست.</div>'; });
    const ctx = window.DM || {};
    const s = document.getElementById("series-news");
    if (s && ctx.slug) mount(s, { series: ctx.slug }, { limit: 5, empty: "هنوز خبری دربارهٔ این سریال ثبت نشده است." });
    const a = document.getElementById("actor-news");
    if (a && ctx.slug) mount(a, { person: ctx.slug }, { limit: 5, empty: "هنوز خبری دربارهٔ این بازیگر ثبت نشده است." });
    const n = document.getElementById("network-news");
    if (n && ctx.slug) mount(n, { network: ctx.slug }, { limit: 6, empty: "هنوز خبری دربارهٔ این شبکه ثبت نشده است." });
  });
})();
