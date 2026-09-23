/* Full ratings table (reyting/): Total / AB / ABC1, 10-day window, filters.
   Moved here from the homepage. Expects window.DM = { root } and window.DiziMeter loaded. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const $ = (s) => document.querySelector(s);
  let data, seriesByKey = {}, activeCat = "total", activeDayIdx = 0, activeFilter = "all", activeNet = "all";

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
    $("#day-tabs").innerHTML = data.ratings.days
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
      : `برای این دسته/روز فقط رتبه‌بندی رسمی موجود است؛ اعداد دقیق AB/ABC1 نیازمند دادهٔ عضویت ${data.ratings.source.name} است.`;
  }

  function renderAll() {
    renderDayTabs(); renderCatTabs();
    renderSummary(); renderList(); renderNote();
  }

  try {
    data = await D.loadData();
    buildKeyMap();
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
