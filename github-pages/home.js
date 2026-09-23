/* Meshki Media homepage — series first. Expects window.DM = { root: "" } and window.DiziMeter.
   The full TİAK ratings table lives on reyting/ (ratings.js). */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const R = D.ROOT;
  const esc = D.esc;
  const $ = (s) => document.querySelector(s);
  const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // same scale as series.dayIndex (0 = Monday)
  let data;

  // ---- time helpers -----------------------------------------------------------
  const trWeekday = (addDays = 0) =>
    WEEK.indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(new Date(Date.now() + addDays * 864e5)));
  const tiakToIso = (d) => { const [dd, mm, yy] = String(d || "").split("."); return yy ? `${yy}-${mm}-${dd}` : ""; };
  const faFmt = (iso, opts) => (iso ? new Intl.DateTimeFormat("fa-IR", opts).format(new Date(iso + "T12:00:00")) : "");
  const faWeekday = (iso) => faFmt(iso, { weekday: "long" });
  const faDayMonth = (iso) => faFmt(iso, { day: "numeric", month: "long" });
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  function agoFa(iso) {
    if (!iso) return "";
    const days = Math.floor((Date.now() - new Date(iso + "T20:00:00+03:00").getTime()) / 864e5);
    return days >= 0 && days < 7 ? rtf.format(-days, "day") : faDayMonth(iso);
  }
  function airTime(s) {
    if (!s.time) return null; // never guess an air time
    const t = D.calendarTimes(s.dayIndex, s.time);
    return t ? { ir: t.ir, tr: t.tr } : null;
  }

  // ---- series helpers ---------------------------------------------------------
  const netOf = (s) => data.networks[s.network];
  const isOnAir = (s) => !s.status || s.status === "در حال پخش";
  function seriesImage(s) {
    if (s.hero) return s.hero;
    const eps = D.allEpisodes(s);
    for (let i = eps.length - 1; i >= 0; i--) { const img = eps[i].image || (eps[i].images && eps[i].images[0]); if (img) return img; }
    return "";
  }
  const epImage = (s, e) => e.image || (e.images && e.images[0]) || seriesImage(s);
  const latestEp = (s) => { const eps = D.allEpisodes(s); return eps[eps.length - 1] || null; };
  const monoWord = (t) => String(t || "").replace(/[ً-ٰٟ]/g, "").trim().split(/\s+/)[0] || "";

  // Poster / still. The real photo when there is one; otherwise (or if the photo fails to load)
  // a designed card in the network's colour with the series name.
  function art(s, { img = seriesImage(s), cls = "", title = true, badge = "" } = {}) {
    const net = netOf(s);
    return `<div class="art ${cls}" style="--net:${net ? net.color : "#d10a1e"}">`
      + `<span class="art-mono" aria-hidden="true">${esc(monoWord(s.titleFa))}</span>`
      + (img ? `<img class="art-img" src="${esc(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : "")
      + (net ? `<img class="art-net" src="${R}images/networks/${net.slug}.svg" alt="${esc(net.name)}" loading="lazy">` : "")
      + badge
      + (title ? `<div class="art-title"><b>${esc(s.titleFa)}</b><small dir="ltr">${esc(s.titleTr)}</small></div>` : "")
      + `</div>`;
  }

  // Each series' most recent Total row in the 10-day window (main broadcast, not the "(OZET)" recap).
  function seriesLatestRatings() {
    const days = (data.ratings && data.ratings.days) || [];
    const out = [];
    Object.values(data.series).forEach((s) => {
      if (s.kind !== "series" || !s.ratingKey) return;
      const key = s.ratingKey.toUpperCase().trim();
      for (const day of days) {
        const row = ((day.categories && day.categories.total) || []).find((r) => String(r.program || "").toUpperCase().trim() === key);
        if (row) { out.push({ s, row, iso: tiakToIso(day.date) }); break; }
      }
    });
    return out.sort((a, b) => (b.row.rating ?? -1) - (a.row.rating ?? -1) || a.row.rank - b.row.rank);
  }

  // ---- sections -----------------------------------------------------------------
  function renderSpotlight(s, when) {
    const net = netOf(s);
    const t = airTime(s);
    const ep = latestEp(s);
    const kicker = when
      ? `<i></i>${when}${net ? " از " + esc(net.name) : ""}${t ? ` · ساعت ${t.ir} به وقت ایران` : ""}`
      : `سریال ویژه${net ? " · " + esc(net.name) : ""}`;
    const actions = [`<a class="btn btn-red" href="${R}dizi/${s.slug}/">صفحهٔ سریال</a>`];
    if (ep && ep.summary) actions.push(`<a class="btn btn-glass" href="${R}dizi/${s.slug}/bolum-${ep.number}/">خلاصهٔ قسمت ${D.fmtInt(ep.number)}</a>`);
    const fr = (ep && ep.fragman) || s.fragman;
    if (fr) actions.push(`<a class="btn btn-glass" href="${esc(fr)}" target="_blank" rel="noreferrer">▶ فراگمان</a>`);
    const el = $("#spotlight");
    el.innerHTML = art(s, { title: false })
      + `<div class="spot-copy"><span class="spot-kicker">${kicker}</span>`
      + `<h2><a href="${R}dizi/${s.slug}/">${esc(s.titleFa)}</a></h2><p class="spot-tr" dir="ltr">${esc(s.titleTr)}</p>`
      + (s.synopsis ? `<p class="spot-syn">${esc(s.synopsis)}</p>` : "")
      + ((s.genre || []).length ? `<div class="spot-genres">${s.genre.map((g) => `<span>${esc(g)}</span>`).join("")}</div>` : "")
      + `<div class="spot-actions">${actions.join("")}</div></div>`;
    el.classList.remove("is-loading");
  }

  function renderTonight(list, when, offset) {
    $("#tonight-title").textContent = `${when} از تلویزیون ترکیه`;
    const el = $("#tonight-list");
    if (!list.length) { el.innerHTML = `<div class="notice">برنامهٔ پخش این هفته هنوز ثبت نشده است.</div>`; return; }
    el.innerHTML = list.map((s) => {
      const t = airTime(s);
      const net = netOf(s);
      const time = t
        ? `<span class="tonight-time"><b>${t.ir}</b><small>به وقت ایران</small></span>`
        : `<span class="tonight-time"><b>${offset === 0 ? "امشب" : offset === 1 ? "فردا" : esc(when)}</b><small>${net ? esc(net.name) : ""}</small></span>`;
      const note = isOnAir(s) ? (t ? `ترکیه ${t.tr}` : "") : esc(s.status);
      return `<a class="tonight-item" href="${R}dizi/${s.slug}/">${art(s, { title: false })}`
        + `<span class="tonight-copy"><strong>${esc(s.titleFa)}</strong><span dir="ltr">${esc(s.titleTr)}</span>${note ? `<em>${note}</em>` : ""}</span>`
        + `${time}</a>`;
    }).join("");
  }

  function renderTop() {
    const items = seriesLatestRatings().slice(0, 5);
    const el = $("#top-list");
    if (!items.length) { el.innerHTML = `<li class="notice">هنوز ریتینگی برای سریال‌ها ثبت نشده است.</li>`; return; }
    const max = Math.max(...items.map((x) => x.row.rating || 0)) || 1;
    el.innerHTML = items.map(({ s, row, iso }, i) => {
      const net = netOf(s);
      const hasNum = row.rating != null;
      const w = hasNum ? Math.max(6, Math.round((row.rating / max) * 100)) : 0;
      return `<li class="top-item"><a href="${R}dizi/${s.slug}/">`
        + `<span class="top-rank">${D.fmtInt(i + 1)}</span>`
        + art(s, { title: false, cls: "art-sm" })
        + `<span class="top-info"><strong>${esc(s.titleFa)}</strong><span>${net ? esc(net.name) + " · " : ""}${esc(faWeekday(iso))} ${esc(faDayMonth(iso))}</span>`
        + (w ? `<span class="top-bar"><i style="width:${w}%"></i></span>` : "")
        + `</span><span class="top-score"><b>${hasNum ? D.fmtScore(row.rating) : "#" + D.fmtInt(row.rank)}</b><small>${hasNum ? "ریتینگ" : "رتبه"}</small></span></a></li>`;
    }).join("");
  }

  function renderFresh() {
    const rows = [];
    Object.values(data.series).forEach((s) => D.allEpisodes(s).forEach((e) => rows.push({ s, e })));
    rows.sort((a, b) => (b.e.date || "").localeCompare(a.e.date || "")
      || ((b.e.summary ? 2 : 0) + (epImage(b.s, b.e) ? 1 : 0)) - ((a.e.summary ? 2 : 0) + (epImage(a.s, a.e) ? 1 : 0)));
    const el = $("#fresh-row");
    if (!rows.length) { el.innerHTML = `<div class="notice">هنوز قسمتی ثبت نشده است.</div>`; return; }
    el.innerHTML = rows.slice(0, 6).map(({ s, e }) => {
      const badge = `<span class="art-badge">قسمت ${D.fmtInt(e.number)}</span>`;
      return `<a class="ep-card" href="${R}dizi/${s.slug}/bolum-${e.number}/">${art(s, { img: epImage(s, e), badge })}`
        + `<span class="ep-card-copy"><span class="ep-when">${esc(agoFa(e.date))}</span>`
        + (e.title ? `<strong>${esc(e.title)}</strong>` : "")
        + (e.summary ? `<p>${esc(e.summary)}</p>` : "")
        + `</span></a>`;
    }).join("");
  }

  function renderPosters(today) {
    const order = (s) => (s.dayIndex == null || s.dayIndex < 0 || s.dayIndex > 6 ? 99 : (s.dayIndex - today + 7) % 7);
    const all = Object.values(data.series).slice().sort((a, b) =>
      (isOnAir(b) ? 1 : 0) - (isOnAir(a) ? 1 : 0) || order(a) - order(b) || a.titleFa.localeCompare(b.titleFa, "fa"));
    $("#poster-grid").innerHTML = all.map((s) => {
      const net = netOf(s);
      const badge = isOnAir(s) ? (order(s) === 0 ? `<span class="art-badge hot">امشب</span>` : "") : `<span class="art-badge">${esc(s.status)}</span>`;
      const sub = s.airing || (net ? net.name : "");
      return `<a class="poster" href="${R}dizi/${s.slug}/">${art(s, { badge })}<span class="poster-sub">${esc(sub)}</span></a>`;
    }).join("");
  }

  function renderNets() {
    $("#home-nets").innerHTML = Object.values(data.networks).map((n) => `<a class="net-tile" href="${R}kanal/${n.slug}/" style="--net-color:${n.color}">
        <img src="${R}images/networks/${n.slug}.svg" alt="${esc(n.name)}" loading="lazy">
        <div><strong>${esc(n.name)}</strong><span>${D.fmtInt(D.seriesForNetwork(data.series, n.slug).length)} سریال</span></div>
      </a>`).join("");
  }

  // ---- boot ---------------------------------------------------------------------
  try {
    data = await D.loadData();
    const all = Object.values(data.series);
    const today = trWeekday();

    // Tonight in Turkey; if nothing is scheduled today, the next day that has something.
    let offset = 0, tonight = [];
    for (; offset < 7; offset++) {
      const idx = (today + offset) % 7;
      tonight = all.filter((s) => s.kind === "series" && s.dayIndex === idx);
      if (tonight.length) break;
    }
    if (!tonight.length) offset = 0;
    tonight.sort((a, b) => (isOnAir(b) ? 1 : 0) - (isOnAir(a) ? 1 : 0) || (a.time || "99").localeCompare(b.time || "99"));
    const when = offset === 0 ? "امشب" : offset === 1 ? "فردا شب" : `${D.WEEKDAYS_FA[(today + offset) % 7]} شب`;

    const rated = seriesLatestRatings().map((x) => x.s);
    const spot = tonight.find((s) => seriesImage(s) && isOnAir(s)) || tonight.find((s) => s.synopsis && isOnAir(s))
      || all.find((s) => seriesImage(s) && s.synopsis) || rated[0] || all[0];
    if (spot) renderSpotlight(spot, tonight.includes(spot) ? when : "");

    renderTonight(tonight, when, offset);
    renderTop();
    renderFresh();
    renderPosters(today);
    renderNets();
  } catch (e) {
    console.error(e);
    $("#spotlight").hidden = true;
    $("#error").hidden = false;
  }
})();
