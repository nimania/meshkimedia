/* Full ratings table (reyting/): Total / AB / ABC1, 10-day window, filters.
   Moved here from the homepage. Expects window.DM = { root } and window.DiziMeter loaded. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const T = window.RatingTrends;
  const $ = (s) => document.querySelector(s);
  let data, seriesByKey = {}, activeCat = "total", activeDayIdx = 0, activeFilter = "all", activeNet = "all";
  let trendMode = "total", trendMetric = "rating", trendItems = [], hiddenTrends = new Set();

  function renderTrends() {
    const mode = trendMode, metric = trendMetric;
    $("#trend-modes").innerHTML = T.modes.map((m) => `<button class="trend-button ${mode === m ? "active" : ""}" data-mode="${m}" aria-pressed="${mode === m}">${T.labels[m]}</button>`).join("");
    $("#trend-metric").innerHTML = `<button class="trend-button ${metric === "rating" ? "active" : ""}" data-metric="rating" aria-pressed="${metric === "rating"}">ریتینگ ٪</button><button class="trend-button ${metric === "rank" ? "active" : ""}" data-metric="rank" aria-pressed="${metric === "rank"}">رتبه</button>`;
    $("#trend-modes").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { trendMode = b.dataset.mode; renderTrends(); }));
    $("#trend-metric").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { trendMetric = b.dataset.metric; renderTrends(); }));
    const available = trendItems.filter((x) => x.points.some((p) => Number.isFinite(p.rows[mode]?.[metric])));
    const plottable = available.filter((x) => x.points.filter((p) => Number.isFinite(p.rows[mode]?.[metric])).length >= 2);
    const visible = plottable.filter((x) => !hiddenTrends.has(x.s.slug));
    const lines = visible.map((x) => ({ name: x.s.titleFa, color: x.color,
      points: x.points.map((p, i) => ({ value: p.rows[mode]?.[metric] ?? null,
        label: p.episode ? `قسمت ${p.episode.number}` : `پخش ثبت‌شدهٔ ${i + 1}`, date: p.date })) }));
    $("#trend-chart").innerHTML = plottable.length ? T.chart(lines, { metric,
      aria: `مقایسهٔ ${metric === "rank" ? "رتبه" : "ریتینگ درصد"} ${T.labels[mode]} سریال‌های در حال پخش در محور تاریخ پخش` }) : '<div class="trend-empty">هنوز سریالی با دو پخش دارای داده در این دسته نداریم. مقدارهای تک‌قسمتی در فهرست پایین آمده‌اند.</div>';
    $("#trend-legend").innerHTML = plottable.map((x) => `<button class="trend-legend-item ${hiddenTrends.has(x.s.slug) ? "off" : ""}" style="--trend-color:${x.color}" data-slug="${D.esc(x.s.slug)}" aria-pressed="${!hiddenTrends.has(x.s.slug)}"><i></i>${D.esc(x.s.titleFa)}</button>`).join("");
    $("#trend-legend").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { if (hiddenTrends.has(b.dataset.slug)) hiddenTrends.delete(b.dataset.slug); else hiddenTrends.add(b.dataset.slug); renderTrends(); }));
    const ranked = available.map((x) => ({ ...x, change: T.changes(x.points, mode, metric) })).filter((x) => x.change).sort((a, b) => b.change.delta - a.change.delta);
    const best = ranked[0], worst = ranked[ranked.length - 1];
    $("#trend-note").textContent = `${T.fa(available.length)} سریال داده دارند؛ ${T.fa(plottable.length)} سریال با دست‌کم دو پخش در نمودار آمده‌اند. محور افقی تاریخ واقعی پخش است. ${metric === "rank" ? "رتبهٔ ۱ بالاترین جایگاه است. بالا رفتن خط یعنی بهبود رتبه." : "محور عمودی Rating % است؛ بالا رفتن خط یعنی رشد مخاطب."} روی نقطه مکث کنید تا نام سریال، شمارهٔ قسمت، تاریخ و مقدار را ببینید. پخش‌های بدون داده برآورد نمی‌شوند.`;
    const summary = ranked.length ? `<div class="trend-insight"><small>${best.change.delta > 0 ? "بیشترین رشد" : "بهترین تغییر"} بین دو پخش دارای داده</small><strong>${D.esc(best.s.titleFa)}</strong><b class="${best.change.delta >= 0 ? "up" : "down"}">${best.change.delta > 0 ? "+" : ""}${T.fa(best.change.delta)} ${metric === "rank" ? "پله" : "واحد"}</b></div>${ranked.length > 1 ? `<div class="trend-insight"><small>${worst.change.delta < 0 ? "بیشترین افت" : "کمترین رشد"} بین دو پخش دارای داده</small><strong>${D.esc(worst.s.titleFa)}</strong><b class="${worst.change.delta < 0 ? "down" : "up"}">${worst.change.delta > 0 ? "+" : ""}${T.fa(worst.change.delta)} ${metric === "rank" ? "پله" : "واحد"}</b></div>` : ""}` : "";
    $("#trend-analysis").innerHTML = summary + (ranked.length ? `<div class="trend-change-list"><h3>تغییر آخرین دو پخشِ دارای داده</h3>${ranked.map((x) => `<a href="${D.ROOT}dizi/${x.s.slug}/"><i style="--trend-color:${x.color}"></i><span>${D.esc(x.s.titleFa)}<small>${x.change.firstDate} ← ${x.change.lastDate}</small></span><b class="${x.change.delta >= 0 ? "up" : "down"}">${x.change.delta > 0 ? "+" : ""}${T.fa(x.change.delta)} ${metric === "rank" ? "پله" : "واحد"}</b></a>`).join("")}</div>` : '<div class="trend-empty">برای محاسبهٔ رشد یا افت، دست‌کم دو پخش دارای داده برای یک سریال لازم است. تاریخچه با انتشار داده‌های جدید کامل می‌شود.</div>');
    $("#trend-details").innerHTML = `<h3>جزئیات هر پخش</h3>${available.map((x) => `<details><summary><i style="--trend-color:${x.color}"></i>${D.esc(x.s.titleFa)} <small>${T.fa(x.points.filter((p) => Number.isFinite(p.rows[mode]?.[metric])).length)} پخش دارای داده</small></summary><div class="trend-detail-rows">${x.points.filter((p) => Number.isFinite(p.rows[mode]?.[metric])).map((p, i) => `<a href="${D.ROOT}dizi/${x.s.slug}/${p.episode ? `bolum-${p.episode.number}/` : ""}"><span>${p.episode ? `قسمت ${D.fmtInt(p.episode.number)}` : `پخش ثبت‌شدهٔ ${D.fmtInt(i + 1)}`}</span><time>${D.esc(p.date)}</time><b>${metric === "rank" ? `رتبهٔ ${D.fmtInt(p.rows[mode].rank)}` : `${T.fa(p.rows[mode].rating)}٪`}</b></a>`).join("")}</div></details>`).join("")}${trendItems.filter((x) => !available.includes(x)).length ? `<p class="trend-help">بدون داده در این نما: ${trendItems.filter((x) => !available.includes(x)).map((x) => D.esc(x.s.titleFa)).join("، ")}</p>` : ""}`;
  }

  function classify(row) {
    const key = (row.program || "").toUpperCase().replace(/\s*\(OZET\)\s*/, "").trim();
    const s = seriesByKey[key];
    if (s) return { kind: s.kind === "entertainment" ? "entertainment" : "series", series: s };
    if (/HABER|GUN ORTASI|GUNE BASLARKEN/.test(row.program)) return { kind: "news" };
    if (/MUGE ANLI|ESRA EROL|MASTERCHEF|GELINIM|EVLENECEK/.test(row.program)) return { kind: "entertainment" };
    return { kind: "entertainment" };
  }
  const catLabel = (k) => (k === "news" ? "خبر" : k === "entertainment" ? "سرگرمی" : "سریال");

  function buildKeyMap() {
    Object.values(data.series).forEach((s) => { seriesByKey[(s.ratingKey || "").toUpperCase().trim()] = s; });
  }

  function renderDayTabs() {
    $("#day-tabs").innerHTML = data.ratings.days.slice(0, 10)
      .map((d, i) => `<button class="day-tab ${i === activeDayIdx ? "active" : ""}" data-idx="${i}">${d.date}</button>`)
      .join("");
    $("#day-tabs").querySelectorAll(".day-tab").forEach((b) =>
      b.addEventListener("click", () => { activeDayIdx = Number(b.dataset.idx); renderAll(); })
    );
  }
  function renderCatTabs() {
    const cats = data.ratings.categories;
    $("#cat-tabs").innerHTML = ["total", "ab", "abc1"]
      .map((k) => `<button class="cat-tab ${k === activeCat ? "active" : ""}" data-cat="${k}"><b>${cats[k].label}</b><span>${cats[k].labelFa}</span></button>`)
      .join("");
    $("#cat-tabs").querySelectorAll(".cat-tab").forEach((b) =>
      b.addEventListener("click", () => { activeCat = b.dataset.cat; renderAll(); })
    );
  }
  function renderNetChips() {
    if (!$("#home-nets")) return;
    const nets = Object.values(data.networks);
    $("#home-nets").innerHTML = nets
      .map((n) => `<a class="net-tile" href="${D.ROOT}kanal/${n.slug}/" style="--net-color:${n.color}">
        <img src="${D.ROOT}images/networks/${n.slug}.svg" alt="${n.name}" loading="lazy">
        <div><strong>${n.name}</strong><span>${D.fmtInt(D.seriesForNetwork(data.series, n.slug).length)} سریال</span></div>
      </a>`)
      .join("");
  }

  function currentRows() {
    const day = data.ratings.days[activeDayIdx];
    return { day, rows: (day.categories[activeCat] || []) };
  }

  function renderSummary() {
    const { day, rows } = currentRows();
    $("#fetched-at").textContent = day.date + (day.weekday ? ` · ${day.weekday}` : "");
    $("#summary-count").textContent = D.fmtInt(rows.length);
    $("#summary-date").textContent = day.date;
    $("#summary-top").textContent = rows[0] ? (rows[0].rating != null ? D.fmtScore(rows[0].rating) : `#${D.fmtInt(rows[0].rank)}`) : "—";
    // Leader
    if (rows[0]) {
      const meta = classify(rows[0]);
      const top = rows[0];
      $("#top-program").textContent = meta.series ? meta.series.titleFa : top.program;
      $("#top-program").title = top.program;
      if (meta.series) { $("#top-program").innerHTML = `<a href="${D.ROOT}dizi/${meta.series.slug}/">${meta.series.titleFa}</a>`; }
      $("#top-network").textContent = top.network;
      $("#top-rating").textContent = top.rating != null ? D.fmtScore(top.rating) : `#${D.fmtInt(top.rank)}`;
    }
  }

  function renderList() {
    const { rows } = currentRows();
    let filtered = rows.map((r) => ({ r, meta: classify(r) }));
    if (activeFilter !== "all") filtered = filtered.filter((x) => x.meta.kind === activeFilter);
    if (activeNet !== "all") {
      const keys = (data.networks[activeNet].ratingKeys || []).map((k) => k.toUpperCase());
      filtered = filtered.filter((x) => keys.includes((x.r.network || "").toUpperCase()));
    }
    const el = $("#ratings-list");
    if (!filtered.length) { el.innerHTML = `<div class="notice">در این دسته برنامه‌ای نیست.</div>`; return; }
    el.innerHTML = filtered
      .map(({ r, meta }) => {
        const titleFa = meta.series ? meta.series.titleFa : r.program;
        const titleHtml = meta.series ? `<a href="${D.ROOT}dizi/${meta.series.slug}/">${titleFa}</a>` : `<span>${titleFa}</span>`;
        const val = r.rating != null ? D.fmtScore(r.rating) : `#${D.fmtInt(r.rank)}`;
        const unit = r.rating != null ? "Rating %" : "رتبه";
        return `<article class="rating-card ${meta.kind === "series" ? "is-series" : ""}">
          <b class="rank">${D.fmtInt(r.rank)}</b>
          <div class="rating-main">
            <div class="rating-meta"><span class="tag">${catLabel(meta.kind)}</span><span class="network">${r.network}</span></div>
            <h3 dir="rtl">${titleHtml}</h3>
            <p dir="ltr">${r.program}</p>
          </div>
          <div class="score"><strong>${val}</strong><span>${unit}</span></div>
        </article>`;
      })
      .join("");
  }

  function renderNote() {
    const { day } = currentRows();
    const has = day.hasNumbers && day.hasNumbers[activeCat];
    $("#cat-note").textContent = has
      ? `اعداد Rating % واقعی از ${data.ratings.source.name}.`
      : `برای این تاریخ هنوز مقدار عددی در بایگانی ما ثبت نشده است؛ پس از بازیابی جدول عمومی ${data.ratings.source.name} کامل می‌شود.`;
  }

  function renderAll() {
    renderDayTabs(); renderCatTabs();
    renderSummary(); renderList(); renderNote();
  }

  try {
    const calendarRequest = fetch(`${D.ROOT}data/calendar.json?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null);
    data = await D.loadData();
    const calendar = await calendarRequest;
    buildKeyMap();
    trendItems = T.onAir(data.series).map((s, i) => ({ s, color: T.colors[i % T.colors.length], points: T.broadcasts(data.ratings, s, calendar) }));
    renderTrends();
    renderNetChips();
    // network filter dropdown
    $("#net-filter").innerHTML = `<option value="all">همهٔ شبکه‌ها</option>` +
      Object.values(data.networks).map((n) => `<option value="${n.slug}">${n.name}</option>`).join("");
    $("#net-filter").addEventListener("change", (e) => { activeNet = e.target.value; renderList(); });
    document.querySelectorAll(".filter").forEach((b) =>
      b.addEventListener("click", () => {
        document.querySelectorAll(".filter").forEach((x) => x.classList.remove("active"));
        b.classList.add("active"); activeFilter = b.dataset.filter; renderList();
      })
    );
    $("#loading").hidden = true;
    $("#ratings-list").hidden = false;
    renderAll();
  } catch (e) {
    console.error(e);
    $("#loading").hidden = true;
    $("#error").hidden = false;
  }
})();
