/* Meshki Media homepage — series first. Expects window.DM = { root: "" } and window.DiziMeter.
   The full TİAK ratings table lives on reyting/ (ratings.js). */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const T = window.RatingTrends;
  const R = D.ROOT;
  const esc = D.esc;
  const $ = (s) => document.querySelector(s);
  let data, calendar;

  // ---- time helpers -----------------------------------------------------------
  const trToday = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = (type) => parts.find((part) => part.type === type).value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  };
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
  function renderSpotlight(s, when, scheduledEp, scheduledEntry) {
    const net = netOf(s);
    const t = airTime(s);
    const ep = scheduledEp || latestEp(s);
    const kicker = when
      ? `<i></i>${when}${net ? " از " + D.networkMark(data.networks, s.network) : ""}${t ? ` · ساعت ${t.ir} به وقت ایران` : ""}`
      : `سریال ویژه${net ? " · " + esc(net.name) : ""}`;
    const actions = [`<a class="btn btn-red" href="${R}dizi/${s.slug}/">صفحهٔ سریال</a>`];
    if (ep && (scheduledEp || ep.summary)) actions.push(`<a class="btn btn-glass" href="${R}dizi/${s.slug}/bolum-${ep.number}/">${scheduledEp ? "پخشِ" : ep.preview ? "معرفی" : "خلاصهٔ"} قسمت ${D.fmtInt(ep.number)}</a>`);
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

  function renderTonight(date, today) {
    const el = $("#tonight-list");
    if (!calendar) {
      $("#tonight-title").textContent = "برنامهٔ پخش";
      el.innerHTML = '<div class="notice">دادهٔ تقویم موقتاً در دسترس نیست.</div>';
      return;
    }
    $("#tonight-source").textContent = calendar.source?.checkedAt
      ? `آخرین بررسی: ${D.isoToFa(calendar.source.checkedAt)}` : "برنامهٔ ثبت‌شده در تقویم";
    if (!date) {
      $("#tonight-title").textContent = "برنامهٔ پخش آینده";
      el.innerHTML = '<div class="notice">برنامهٔ روزهای آینده هنوز در تقویم ثبت نشده است.</div>';
      return;
    }
    const when = date === today ? "امشب" : `روز ${faWeekday(date)} ${faDayMonth(date)}`;
    $("#tonight-title").textContent = `${when} از تلویزیون ترکیه`;
    el.innerHTML = calendar.days[date].map((entry) => {
      const s = data.series[entry.slug] || calendar.shows?.[entry.slug];
      if (!s) return "";
      const show = { ...s, slug: entry.slug, titleFa: s.titleFa || s.titleTr };
      const net = netOf(show);
      const known = Boolean(data.series[entry.slug]);
      const episode = known ? D.scheduledEpisodes(show, calendar).find((e) => e.date === date) : null;
      const href = known ? `${R}dizi/${show.slug}/${episode ? `bolum-${episode.number}/` : ""}` : calendar.source.url;
      // Page links and labels use the continuous episode number (series.json); the calendar counts inside a season.
      const epNo = episode?.number || entry.episode;
      const note = `فصل ${D.fmtInt(entry.season)} · قسمت ${D.fmtInt(epNo)}`;
      return `<a class="tonight-item" href="${esc(href)}"${known ? "" : ' target="_blank" rel="noopener noreferrer"'}>${art(show, { title: false })}`
        + `<span class="tonight-copy"><strong>${esc(show.titleFa)}</strong>${s.titleFa ? `<span dir="ltr">${esc(s.titleTr)}</span>` : ""}<em>${note}${entry.premiere === "series" ? " · شروع سریال" : ""}</em></span>`
        + `<span class="tonight-time"><b>${D.fmtInt(epNo)}</b><small>${net ? D.networkMark(data.networks, show.network) : "قسمت"}</small></span></a>`;
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
        + `<span class="top-info"><strong>${esc(s.titleFa)}</strong><span class="top-meta">${net ? D.networkMark(data.networks, s.network) : ""}${esc(faWeekday(iso))} ${esc(faDayMonth(iso))}</span>`
        + (w ? `<span class="top-bar"><i style="width:${w}%"></i></span>` : "")
        + `</span><span class="top-score"><b>${hasNum ? D.fmtScore(row.rating) : "#" + D.fmtInt(row.rank)}</b><small>${hasNum ? "ریتینگ" : "رتبه"}</small></span></a></li>`;
    }).join("");
  }

  function renderHomeTrends() {
    const items = T.onAir(data.series).map((s, i) => ({ s, color: T.colors[i % T.colors.length], points: T.broadcasts(data.ratings, s, calendar) }))
      .filter((x) => x.points.some((p) => p.rows.total?.rating != null));
    const changed = items.map((x) => ({ ...x, change: T.changes(x.points, "total", "rating") })).filter((x) => x.change)
      .sort((a, b) => b.change.delta - a.change.delta);
    if (!items.length) { $("#home-trends-content").innerHTML = '<div class="notice">هنوز ریتینگ عددی برای سریال‌های در حال پخش ثبت نشده است.</div>'; return; }
    const latest = (x, mode) => x.points.filter((p) => Number.isFinite(p.rows[mode]?.rating)).at(-1);
    const ordered = [...items].sort((a, b) => latest(b, "total").rows.total.rating - latest(a, "total").rows.total.rating);
    const highest = ordered[0], runnerUp = ordered[1];
    const growth = changed.find((x) => x.change.delta > 0);
    const decline = [...changed].reverse().find((x) => x.change.delta < 0);
    const freshest = [...items].filter((x) => ![growth?.s.slug, highest?.s.slug, runnerUp?.s.slug].includes(x.s.slug))
      .sort((a, b) => latest(b, "total").date.localeCompare(latest(a, "total").date)
        || latest(b, "total").rows.total.rating - latest(a, "total").rows.total.rating)[0];
    const facts = [
      growth && { x: growth, heading: "بیشترین رشد در دو پخش", value: `+${T.fa(growth.change.delta)} واحد`, detail: "ریتینگ Total نسبت به پخش قبلی", point: latest(growth, "total"), type: "up" },
      decline ? { x: decline, heading: "بیشترین افت در دو پخش", value: `${T.fa(decline.change.delta)} واحد`, detail: "ریتینگ Total نسبت به پخش قبلی", point: latest(decline, "total"), type: "down" }
        : runnerUp && { x: runnerUp, heading: "دومین ریتینگ Total", value: `${D.fmtScore(latest(runnerUp, "total").rows.total.rating)}٪`, detail: "آخرین پخشِ دارای دادهٔ این سریال", point: latest(runnerUp, "total") },
      highest && { x: highest, heading: "بالاترین Total ثبت‌شده", value: `${D.fmtScore(latest(highest, "total").rows.total.rating)}٪`, detail: "آخرین پخشِ دارای ریتینگ این سریال", point: latest(highest, "total") },
      freshest && { x: freshest, heading: "یک نتیجهٔ دیگر از سریال‌ها", value: `${D.fmtScore(latest(freshest, "total").rows.total.rating)}٪`, detail: "ریتینگ Total آخرین پخشِ دارای داده", point: latest(freshest, "total") },
    ].filter(Boolean);
    const cards = facts.map(({ x, heading, value, detail, point, type }) => {
      const href = `${R}dizi/${x.s.slug}/${point.episode ? `bolum-${point.episode.number}/` : ""}`;
      const date = point.date ? D.isoToFa(point.date) : "";
      return `<a class="home-insight" href="${href}" style="--trend-color:${x.color}"><small>${heading}</small><strong>${esc(x.s.titleFa)}</strong><b class="${type || ""}">${value}</b><span>${detail}</span><em>${point.episode ? `قسمت ${D.fmtInt(point.episode.number)} · ` : ""}${date}</em></a>`;
    }).join("");
    const newest = tiakToIso(data.ratings.days[0]?.date);
    $("#home-trends-content").innerHTML = `<div class="home-insights">${cards}</div><div class="home-insights-foot"><span>آخرین دادهٔ ثبت‌شده: ${newest ? D.isoToFa(newest) : "نامشخص"}</span><a class="home-insights-more" href="${R}reyting/#trends">نمودارها و مقایسهٔ همهٔ سریال‌ها ←</a></div>`;
  }

  function renderFresh() {
    const rows = [];
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    Object.values(data.series).forEach((s) => D.allEpisodes(s).forEach((e) => {
      if (!e.preview && e.summary && e.summary.trim() && e.date && e.date <= today) rows.push({ s, e });
    }));
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
    const upcoming = new Map();
    Object.keys(calendar?.days || {}).sort().filter((date) => date >= today).forEach((date) =>
      calendar.days[date].forEach((entry) => { if (!upcoming.has(entry.slug)) upcoming.set(entry.slug, date); }));
    const order = (s) => upcoming.get(s.slug) || "9999-99-99";
    const all = Object.values(data.series).slice().sort((a, b) =>
      order(a).localeCompare(order(b)) || a.titleFa.localeCompare(b.titleFa, "fa"));
    $("#poster-grid").innerHTML = all.map((s) => {
      const net = netOf(s);
      const badge = order(s) === today ? '<span class="art-badge hot">امشب</span>' : !isOnAir(s) ? `<span class="art-badge">${esc(s.status)}</span>` : "";
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
    const calendarRequest = fetch(`${R}data/calendar.json?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`Calendar HTTP ${response.status}`); return response.json(); })
      .catch((error) => { console.error("Calendar unavailable", error); return null; });
    data = await D.loadData();
    calendar = await calendarRequest;
    const all = Object.values(data.series);
    const today = trToday();
    const nextDate = Object.keys(calendar?.days || {}).sort().find((date) => date >= today);
    const scheduled = nextDate ? calendar.days[nextDate].map((entry) => data.series[entry.slug]).filter(Boolean) : [];

    const rated = seriesLatestRatings().map((x) => x.s);
    const spot = scheduled.find((s) => seriesImage(s) && isOnAir(s)) || scheduled.find((s) => s.synopsis && isOnAir(s))
      || all.find((s) => seriesImage(s) && s.synopsis) || rated[0] || all[0];
    const spotlightEntry = calendar?.days?.[nextDate]?.find((entry) => entry.slug === spot?.slug);
    const spotlightEpisode = spotlightEntry && D.scheduledEpisodes(spot, calendar).find((ep) => ep.date === nextDate);
    if (spot) renderSpotlight(spot, nextDate === today && spotlightEntry ? "امشب" : "", spotlightEpisode, spotlightEntry);

    renderTonight(nextDate, today);
    renderTop();
    renderHomeTrends();
    renderFresh();
    renderPosters(today);
    renderNets();
  } catch (e) {
    console.error(e);
    $("#spotlight").hidden = true;
    $("#error").hidden = false;
  }
})();
