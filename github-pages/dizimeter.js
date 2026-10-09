/* Meshki Media shared client library. Loaded on every page.
   window.DM = { root, slug?, epNumber? } is set inline by each page. */
(function () {
  "use strict";
  const DM = (window.DM = window.DM || {});
  const ROOT = DM.root || "";

  // ---- Formatting -----------------------------------------------------------
  const faInt = new Intl.NumberFormat("fa-IR");
  const faScore = new Intl.NumberFormat("fa-IR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const faDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "UTC" });
  const faNumericDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" });
  const fmtInt = (n) => faInt.format(n);
  const fmtScore = (n) => (n == null || Number.isNaN(n) ? "—" : faScore.format(n));
  const fmtRank = (n) => (n == null ? "—" : faInt.format(n));
  const faDigits = (value) => String(value ?? "").replace(/[0-9٠-٩]/g, (digit) =>
    "۰۱۲۳۴۵۶۷۸۹"[digit.charCodeAt(0) <= 57 ? digit.charCodeAt(0) - 48 : digit.charCodeAt(0) - 0x660]);
  const asciiDigits = (value) => String(value ?? "").replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660)));
  const isoToFa = (iso) => (iso ? faDate.format(new Date(iso.slice(0, 10) + "T12:00:00Z")) : "");
  const isoToFaNumeric = (iso) => (iso ? faNumericDate.format(new Date(iso.slice(0, 10) + "T12:00:00Z")) : "");
  const tiakToFa = (value, numeric = false) => { const [d, m, y] = String(value || "").split("."); return y ? (numeric ? isoToFaNumeric : isoToFa)(`${y}-${m}-${d}`) : ""; };
  const isoToTiak = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---- Slug (MUST match automation/build-site.mjs) --------------------------
  function slugify(s) {
    s = (s || "").toString();
    const m = { "İ": "i", "I": "i", "ı": "i", "Ş": "s", "ş": "s", "Ğ": "g", "ğ": "g", "Ü": "u", "ü": "u", "Ö": "o", "ö": "o", "Ç": "c", "ç": "c" };
    s = s.replace(/[İIıŞşĞğÜüÖöÇç]/g, (c) => m[c]);
    s = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "x";
  }

  // ---- Data loading ---------------------------------------------------------
  let _cache = null;
  async function loadData() {
    if (_cache) return _cache;
    const v = Date.now();
    const [networks, series, ratings, profiles, works, social] = await Promise.all([
      fetch(`${ROOT}data/networks.json?v=${v}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${ROOT}data/series.json?v=${v}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${ROOT}data/ratings.json?v=${v}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${ROOT}data/people.json?v=${v}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${ROOT}data/works.json?v=${v}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${ROOT}data/social-ratings.json?v=${v}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : { entries: [] }).catch(() => ({ entries: [] })),
    ]);
    // A social post can supply a series result before the full official table
    // is public. Preserve official rows when both sources cover the same show.
    for (const item of social.entries || []) {
      if (!series[item.slug]?.ratingKey || !/^\d{2}\.\d{2}\.\d{4}$/.test(item.date || "")) continue;
      let day = ratings.days.find((d) => d.date === item.date);
      if (!day) {
        day = { date: item.date, weekday: "", partial: true, source: { name: "Dizilah", url: item.source.url },
          hasNumbers: { total: true, ab: true, abc1: true }, categories: { total: [], ab: [], abc1: [] } };
        ratings.days.push(day);
      }
      for (const mode of ["total", "ab", "abc1"]) {
        const r = item.categories?.[mode];
        if (!r || day.categories[mode].some((row) => row.program.toUpperCase() === item.program.toUpperCase())) continue;
        day.categories[mode].push({ ...r, program: item.program, network: item.network,
          source: item.source, episode: item.episode });
        day.categories[mode].sort((a, b) => a.rank - b.rank);
      }
    }
    ratings.days.sort((a, b) => b.date.split(".").reverse().join("").localeCompare(a.date.split(".").reverse().join("")));
    _cache = { networks, series, ratings, profiles, works };
    return _cache;
  }

  const seriesList = (series) => Object.values(series);
  const seriesForNetwork = (series, netSlug) => seriesList(series).filter((s) => s.network === netSlug);

  function allEpisodes(s) {
    const out = [];
    (s.seasons || []).forEach((season) => (season.episodes || []).forEach((ep) => out.push(Object.assign({ season: season.number }, ep))));
    // Continuous broadcaster episode numbers are the canonical archive order.
    // Metadata-only backfills can lack dates, so sorting by date would scramble seasons.
    return out.sort((a, b) => Number(a.number) - Number(b.number));
  }

  // Calendar entries can precede editorial episode pages. They carry only
  // a confirmed broadcast date/number, never a fabricated recap or rating.
  function scheduledEpisodes(s, calendar) {
    const episodes = allEpisodes(s);
    for (const [date, entries] of Object.entries(calendar?.days || {})) {
      for (const entry of entries) {
        if (entry.slug !== s.slug || !Number.isInteger(Number(entry.episode)) || Number(entry.episode) < 1) continue;
        const season = (s.seasons || []).find(x => Number(x.number) === Number(entry.season));
        // Calendar numbering is *within a season*. Only translate when the
        // season offset has been documented; never guess a broadcast number.
        if (!season || !Number.isInteger(Number(season.firstEpisode))) continue;
        const number = Number(season.firstEpisode) + Number(entry.episode) - 1;
        if (!episodes.some(ep => Number(ep.number) === number || ep.date === date)) {
          episodes.push({ number, season: Number(entry.season), date, scheduled: true, preview: true });
        }
      }
    }
    return episodes.sort((a, b) => Number(a.number) - Number(b.number));
  }

  // ---- People & characters derived from series cast -------------------------
  function buildPeople(series, profiles = {}, works = {}) {
    const people = {};
    for (const [slug, profile] of Object.entries(profiles)) {
      people[slug] = { slug, ...profile, credits: [] };
    }
    seriesList(series).forEach((s) => {
      (s.cast || []).forEach((c) => {
        if (!c.name) return;
        const slug = c.personSlug || slugify(c.name);
        const p = (people[slug] = people[slug] || { slug, name: c.name, nameFa: "", photo: "", credits: [] });
        if (!p.nameFa && c.nameFa) p.nameFa = c.nameFa;
        if (!p.photo && c.image) p.photo = c.image;
        p.credits.push({ kind: "series", seriesSlug: s.slug, titleFa: s.titleFa, titleTr: s.titleTr, year: s.year, image: s.hero, character: c.role || "", characterFa: c.roleFa || "", charSlug: c.role ? slugify(s.slug + "-" + c.role) : "" });
      });
    });
    for (const w of Object.values(works)) for (const c of w.cast || []) {
      const p = people[c.personSlug];
      if (!p) continue;
      p.credits.push({ kind: w.kind, workSlug: w.slug, titleFa: w.titleFa, titleTr: w.titleTr, year: w.year, image: w.image, character: c.role || "", characterFa: c.roleFa || "" });
    }
    for (const p of Object.values(people)) p.credits.sort((a, b) => (b.year || 0) - (a.year || 0));
    return people;
  }
  function buildCharacters(series) {
    const chars = {};
    seriesList(series).forEach((s) => {
      (s.cast || []).forEach((c) => {
        if (!c.role) return;
        const slug = slugify(s.slug + "-" + c.role);
        chars[slug] = { slug, name: c.role, nameFa: c.roleFa || "", description: c.description || "", source: c.source || "", seriesSlug: s.slug, seriesTitleFa: s.titleFa, seriesTitleTr: s.titleTr, personSlug: c.name ? (c.personSlug || slugify(c.name)) : "", personName: c.name || "", personNameFa: c.nameFa || "", image: c.roleImage || c.image || "" };
      });
    });
    return chars;
  }

  // ---- Ratings lookup -------------------------------------------------------
  function ratingFor(ratings, ratingKey, iso, category) {
    if (!ratings || !ratings.days) return null;
    const day = ratings.days.find((d) => d.date === isoToTiak(iso));
    if (!day || !day.categories || !day.categories[category]) return null;
    const key = (ratingKey || "").toUpperCase().trim();
    const row = day.categories[category].find((r) => (r.program || "").toUpperCase().trim() === key);
    return row ? { rank: row.rank, rating: row.rating, network: row.network, date: day.date } : null;
  }
  const ratingModesFor = (ratings, ratingKey, iso) => ({
    total: ratingFor(ratings, ratingKey, iso, "total"),
    ab: ratingFor(ratings, ratingKey, iso, "ab"),
    abc1: ratingFor(ratings, ratingKey, iso, "abc1"),
  });
  function seriesHeadlineRating(ratings, s) {
    for (const ep of allEpisodes(s).slice().reverse()) {
      const m = ratingModesFor(ratings, s.ratingKey, ep.date);
      if (m.total || m.ab || m.abc1) return { ep, modes: m };
    }
    return null;
  }
  const latestDay = (ratings) => (ratings && ratings.days && ratings.days[0]) || null;

  // ---- Timezones (calendar) -------------------------------------------------
  const WEEKDAYS_FA = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"]; // index 0=Mon
  function calendarTimes(dayIndex, time) {
    if (dayIndex == null || dayIndex < 0 || dayIndex > 6) return null;
    const jsDay = (dayIndex + 1) % 7; // 0=Sun..6=Sat
    const now = new Date();
    let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    for (let i = 0; i < 7; i++) { if (d.getUTCDay() === jsDay) break; d.setUTCDate(d.getUTCDate() + 1); }
    const [H, M] = (time || "20:00").split(":").map(Number);
    const baseUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), H - 3, M || 0)); // Istanbul = UTC+3 (fixed)
    const f = (tz) => new Intl.DateTimeFormat("fa-IR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(baseUTC);
    const wd = (tz) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(baseUTC);
    return { tr: f("Europe/Istanbul"), ir: f("Asia/Tehran"), us: f("America/Los_Angeles"), usDay: wd("America/Los_Angeles"), trDay: wd("Europe/Istanbul") };
  }

  // ---- UI fragments ---------------------------------------------------------
  function netBadge(networks, netSlug, opts = {}) {
    const n = networks[netSlug];
    if (!n) return "";
    const img = `<img class="net-logo" src="${ROOT}images/networks/${n.slug}.svg" alt="${esc(n.name)}" loading="lazy">`;
    return opts.link === false ? `<span class="net-chip">${img}</span>` : `<a class="net-chip" href="${ROOT}kanal/${n.slug}/" title="${esc(n.name)}">${img}</a>`;
  }
  // Compact network marks retain a readable name for screen readers and hover.
  // Source tables sometimes spell a broadcaster differently from its catalogue key.
  function networkMark(networks, key, opts = {}) {
    const n = networks[key] || Object.values(networks).find((item) =>
      item.name.toUpperCase() === String(key || "").toUpperCase() ||
      (item.ratingKeys || []).some((alias) => alias.toUpperCase() === String(key || "").toUpperCase()));
    if (!n) return `<span class="network-mark-fallback">${esc(key || "")}</span>`;
    const img = `<img src="${ROOT}images/networks/${n.slug}.svg" alt="${esc(n.name)}" loading="lazy">`;
    return opts.link ? `<a class="network-mark" href="${ROOT}kanal/${n.slug}/" title="${esc(n.name)}">${img}</a>`
      : `<span class="network-mark" title="${esc(n.name)}">${img}</span>`;
  }

  // Localize display text, including dynamically inserted cards and SVG chart labels.
  // URLs, data keys, dates used for comparison, input values and JSON-LD are untouched.
  function localizeVisibleDigits(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest("script,style,code,pre,textarea")) return;
      const next = faDigits(root.nodeValue);
      if (next !== root.nodeValue) root.nodeValue = next;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches("script,style,code,pre,textarea")) return;
    for (const attr of ["aria-label", "title", "alt", "placeholder"]) {
      if (root.hasAttribute(attr)) {
        const old = root.getAttribute(attr), next = faDigits(old);
        if (next !== old) root.setAttribute(attr, next);
      }
    }
    for (const child of root.childNodes) localizeVisibleDigits(child);
  }
  function initPersianDigits() {
    localizeVisibleDigits(document.body);
    document.title = faDigits(document.title);
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") localizeVisibleDigits(record.target);
        else for (const node of record.addedNodes) localizeVisibleDigits(node);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }
  function ratingPills(modes, ratings) {
    const cat = (ratings && ratings.categories) || {};
    const cell = (m, meta) => {
      if (!m) return `<div class="rp"><span class="rp-k">${meta.label}</span><b class="rp-v muted">—</b></div>`;
      const val = m.rating != null ? fmtScore(m.rating) : `<span class="rp-rank">#${fmtRank(m.rank)}</span>`;
      return `<div class="rp"><span class="rp-k">${meta.label}</span><b class="rp-v">${val}</b><span class="rp-r">رتبه ${fmtRank(m.rank)}</span></div>`;
    };
    return `<div class="rating-pills">${cell(modes.total, cat.total || { label: "Total" })}${cell(modes.ab, cat.ab || { label: "AB" })}${cell(modes.abc1, cat.abc1 || { label: "ABC1" })}</div>`;
  }

  function initTheme() {
    try { const s = localStorage.getItem("dizimeter-theme"); if (s) document.documentElement.dataset.theme = s; } catch (e) {}
    const btn = document.querySelector("#theme-toggle");
    if (btn) btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("dizimeter-theme", next); } catch (e) {}
    });
  }

  window.DiziMeter = {
    ROOT, esc, slugify,
    fmtInt, fmtScore, fmtRank, faDigits, asciiDigits, isoToFa, isoToFaNumeric, tiakToFa, isoToTiak,
    loadData, seriesList, seriesForNetwork, allEpisodes, scheduledEpisodes,
    buildPeople, buildCharacters,
    ratingFor, ratingModesFor, seriesHeadlineRating, latestDay,
    calendarTimes, WEEKDAYS_FA,
    netBadge, networkMark, ratingPills, initTheme,
  };
  document.addEventListener("DOMContentLoaded", initTheme);
  document.addEventListener("DOMContentLoaded", initPersianDigits);
})();
