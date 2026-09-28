/* Renders a single episode (قسمت) profile page. Expects window.DM = { root, slug, epNumber }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const T = window.RatingTrends;
  const { slug, epNumber } = window.DM;
  const $ = (s) => document.querySelector(s);

  try {
    const [base, calendar] = await Promise.all([
      D.loadData(),
      fetch(`${D.ROOT}data/calendar.json?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    const { networks, series, ratings } = base;
    const s = series[slug];
    if (!s) throw new Error("series not found");
    const eps = D.scheduledEpisodes(s, calendar);
    const idx = eps.findIndex((e) => String(e.number) === String(epNumber));
    const ep = eps[idx];
    if (!ep) throw new Error("episode not found");
    const net = networks[s.network];

    document.title = `${s.titleFa} — قسمت ${D.fmtInt(ep.number)} | مشکی مدیا`;

    // Breadcrumb + title
    $("#crumb-series").textContent = s.titleFa;
    $("#crumb-series").href = `${D.ROOT}dizi/${s.slug}/`;
    $("#ep-badge").innerHTML = D.netBadge(networks, s.network);
    $("#ep-kicker").textContent = `${s.titleTr} · قسمت ${D.fmtInt(ep.number)}`;
    $("#ep-title").textContent = ep.title && ep.title.trim() ? ep.title : `قسمت ${D.fmtInt(ep.number)}`;
    $("#ep-facts").innerHTML = [
      ep.date ? `<span>📅 ${D.isoToFa(ep.date)}</span>` : "",
      `<span>قسمت ${D.fmtInt(ep.number)}</span>`,
      net ? D.networkMark(networks, s.network) : "",
    ].join("");

    // Hero image = first photo or series hero
    const heroImg = ep.image || (ep.images && ep.images[0]) || s.hero || "";
    if (heroImg) $(".ep-hero-image").src = heroImg;
    else $("#ep-hero").classList.add("no-image");

    // Ratings (Total / AB / ABC1)
    const modes = D.ratingModesFor(ratings, s.ratingKey, ep.date);
    const anyRating = modes.total || modes.ab || modes.abc1;
    const isScheduled = Boolean(ep.scheduled);
    const reportExists = ratings.days.some((day) => day.date === D.isoToTiak(ep.date));
    $("#ep-ratings").innerHTML = D.ratingPills(modes, ratings);
    $("#ratings-note").textContent = anyRating
      ? `منبع: ${ratings.source.name} · تاریخ ${modes.total ? modes.total.date : (modes.ab ? modes.ab.date : modes.abc1.date)}`
      : reportExists ? "این قسمت در جدول عمومی ۱۰تایی TİAK ثبت نشده است؛ مقدار آن از این جدول معلوم نیست. ریتینگ قسمت‌های پیشین را پایین ببینید."
        : isScheduled ? "ریتینگ این قسمت هنوز اعلام نشده است. ریتینگ قسمت‌های پیشین را در نمودار و فهرست پایین ببینید."
          : "برای این تاریخ در بایگانی ما داده‌ای موجود نیست؛ ریتینگ را صفر فرض نکنید.";

    const points = eps.map((item) => ({ item, modes: D.ratingModesFor(ratings, s.ratingKey, item.date) }));
    const present = points.some((p) => T.modes.some((mode) => p.modes[mode]));
    if (present) {
      const lines = T.modes.map((mode, i) => ({ name: T.labels[mode], color: T.colors[i],
        points: points.map(({ item, modes }) => ({ value: modes[mode]?.rank ?? null,
          label: `قسمت ${item.number}`, date: item.date, current: item.number === ep.number })) }));
      const graph = T.chart(lines, { metric: "rank", xCount: eps.length,
        aria: `روند رتبهٔ Total، AB و ABC1 سریال ${s.titleFa} در قسمت‌های ثبت‌شده` });
      const numericLines = T.modes.map((mode, i) => ({ name: T.labels[mode], color: T.colors[i],
        points: points.map(({ item, modes }) => ({ value: modes[mode]?.rating ?? null,
          label: `قسمت ${item.number}`, date: item.date, current: item.number === ep.number })) }));
      const numericGraph = T.chart(numericLines, { metric: "rating", xCount: eps.length,
        aria: `روند ریتینگ درصد Total، AB و ABC1 سریال ${s.titleFa} در قسمت‌های ثبت‌شده` });
      const legend = lines.map((line, i) => `<span class="trend-legend-item"><i style="--trend-color:${line.color}"></i>${line.name}</span>`).join("");
      const seriesRows = T.broadcasts(ratings, s);
      const current = seriesRows.find((p) => p.date === ep.date);
      const previous = current ? seriesRows.filter((p) => p.date < ep.date && p.rows.total?.rating != null).at(-1) : null;
      let delta = "";
      if (current?.rows.total?.rating != null && previous) {
        const diff = current.rows.total.rating - previous.rows.total.rating;
        delta = `<p class="trend-delta ${diff >= 0 ? "up" : "down"}">Total این پخش: ${diff >= 0 ? "افزایش" : "کاهش"} ${T.fa(Math.abs(diff))} واحد ریتینگ نسبت به پخش ثبت‌شدهٔ قبلی</p>`;
      }
      const chartEl = $("#ep-trend");
      chartEl.innerHTML = `<div class="trend-switch" role="group" aria-label="سنجهٔ نمودار قسمت"><button class="trend-button active" data-ep-metric="rank" aria-pressed="true">رتبهٔ سه دسته</button><button class="trend-button" data-ep-metric="rating" aria-pressed="false">ریتینگ ٪ سه دسته</button></div><div id="ep-trend-graph">${graph}</div><div class="trend-legend" id="ep-trend-legend">${legend}</div><div class="trend-episodes">${points.map(({ item, modes }) => `<a class="trend-episode ${item.number === ep.number ? "current" : ""}" href="${D.ROOT}dizi/${s.slug}/bolum-${item.number}/" title="${D.esc(item.date || "")}">قسمت ${D.fmtInt(item.number)}<small>${T.modes.map((mode) => modes[mode] ? `${T.labels[mode]} ${modes[mode].rating != null ? D.fmtScore(modes[mode].rating) + "٪" : "#" + D.fmtInt(modes[mode].rank)}` : "").filter(Boolean).join(" · ") || (ratings.days.some((day) => day.date === D.isoToTiak(item.date)) ? "خارج از جدول عمومی" : item.scheduled ? "هنوز اعلام نشده" : "داده در بایگانی نیست")}</small></a>`).join("")}</div>${delta}`;
      chartEl.querySelectorAll("[data-ep-metric]").forEach((button) => button.addEventListener("click", () => {
        const numeric = button.dataset.epMetric === "rating";
        chartEl.querySelector("#ep-trend-graph").innerHTML = numeric ? numericGraph : graph;
        chartEl.querySelectorAll("[data-ep-metric]").forEach((b) => { b.classList.toggle("active", b === button); b.setAttribute("aria-pressed", String(b === button)); });
      }));
    } else {
      $("#ep-trend").innerHTML = '<div class="trend-empty">هنوز برای قسمت‌های ثبت‌شدهٔ این سریال ریتینگی در تاریخچه نداریم. نمودار پس از ثبت داده نمایش داده می‌شود.</div>';
    }

    // Photos gallery
    const gallery = [...new Set((ep.images && ep.images.length ? ep.images : (ep.image ? [ep.image] : []))
      .filter((url) => /^https:\/\//.test(url)))];
    if (gallery.length) {
      $("#ep-gallery").innerHTML = gallery
        .map((src, index) => `<a class="shot" href="${D.esc(src)}" target="_blank" rel="noopener noreferrer" aria-label="عکس ${D.fmtInt(index + 1)} از قسمت ${D.fmtInt(ep.number)}"><img src="${D.esc(src)}" alt="${D.esc(s.titleFa)}، قسمت ${D.fmtInt(ep.number)}؛ عکس ${D.fmtInt(index + 1)}" loading="lazy" referrerpolicy="no-referrer"></a>`)
        .join("");
      if (ep.photosSource && /^https:\/\//.test(ep.photosSource)) {
        $("#ep-gallery-source").href = ep.photosSource;
        $("#ep-gallery-source").hidden = false;
      }
    } else {
      $("#gallery-section").hidden = true;
    }

    // An official preview is not an after-airing recap.
    if (ep.preview) {
      $("#ep-summary").parentElement.querySelector(".kicker").textContent = isScheduled ? "برنامهٔ پخش" : "معرفی رسمی قسمت";
      $("#ep-summary").parentElement.querySelector("h2").textContent = isScheduled ? "قسمت پیش رو" : "در این قسمت چه می‌شود؟";
    }
    // Summary
    $("#ep-summary").textContent = ep.summary && ep.summary.trim()
      ? ep.summary
      : isScheduled ? `طبق تقویم، قسمت ${D.fmtInt(ep.number)} از فصل ${D.fmtInt(ep.season)} برای ${D.isoToFa(ep.date)} ثبت شده است. خلاصه و تصاویر آن پس از انتشار اطلاعات رسمی اضافه می‌شوند.` : "خلاصهٔ این قسمت به‌زودی از منبع رسمی افزوده می‌شود.";

    // Links: fragman + official source
    const links = [];
    const fragman = ep.fragman || s.fragman;
    if (ep.watchUrl) links.push(`<a class="btn-primary" href="${D.esc(ep.watchUrl)}" target="_blank" rel="noopener noreferrer">▶ تماشای قسمت در شبکه</a>`);
    else if (s.official && s.official.episodes) links.push(`<a class="btn-primary" href="${D.esc(s.official.episodes)}" target="_blank" rel="noopener noreferrer">قسمت‌ها در شبکه ↗</a>`);
    if (fragman) links.push(`<a class="btn-ghost" href="${D.esc(fragman)}" target="_blank" rel="noopener noreferrer">${ep.fragman ? '▶ تماشای تیزر قسمت' : 'فراگمان‌های سریال ↗'}</a>`);
    if (ep.source && ep.source !== ep.watchUrl) links.push(`<a class="btn-ghost" href="${D.esc(ep.source)}" target="_blank" rel="noopener noreferrer">${ep.preview ? "منبع معرفی قسمت" : "منبع خلاصه"} ↗</a>`);
    $("#ep-links").innerHTML = links.join("");

    // Prev / next episode nav
    const prev = eps[idx - 1];
    const next = eps[idx + 1];
    const navHtml = [];
    if (prev) navHtml.push(`<a class="ep-nav-btn" href="${D.ROOT}dizi/${s.slug}/bolum-${prev.number}/"><span>قسمت قبلی</span><b>قسمت ${D.fmtInt(prev.number)} →</b></a>`);
    else navHtml.push(`<span></span>`);
    if (next) navHtml.push(`<a class="ep-nav-btn left" href="${D.ROOT}dizi/${s.slug}/bolum-${next.number}/"><span>قسمت بعدی</span><b>← قسمت ${D.fmtInt(next.number)}</b></a>`);
    $("#ep-nav").innerHTML = navHtml.join("");
  } catch (e) {
    console.error(e);
    $("#ep-summary").textContent = "اطلاعات این قسمت موقتاً در دسترس نیست.";
  }
})();
