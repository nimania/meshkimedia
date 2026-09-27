/* Renders a network (kanal) page. Expects window.DM = { root, slug }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { slug } = window.DM;
  const $ = (s) => document.querySelector(s);

  try {
    const { networks, series, ratings } = await D.loadData();
    const net = networks[slug];
    if (!net) throw new Error("network not found");

    document.title = `${net.name} | مشکی مدیا`;
    $("#net-name").textContent = net.name;
    $("#net-name-fa").textContent = net.nameFa || "";
    $("#net-logo").src = `${D.ROOT}images/networks/${net.slug}.svg`;
    $("#net-logo").alt = net.name;
    document.querySelector(".net-hero").style.setProperty("--net-color", net.color);
    if (net.site) $("#net-site").href = net.site;

    const list = D.seriesForNetwork(series, slug).sort((a, b) => (a.dayIndex ?? 9) - (b.dayIndex ?? 9));
    $("#net-count").textContent = D.fmtInt(list.length);

    if (list.length) {
      $("#net-series").innerHTML = list
        .map((s) => {
          const head = D.seriesHeadlineRating(ratings, s);
          const ratingLine = head && head.modes.total
            ? `<span class="mini-rating">Total ${D.fmtScore(head.modes.total.rating)}</span>`
            : (head ? `<span class="mini-rating">رتبهٔ Total #${D.fmtRank((head.modes.total || head.modes.ab || head.modes.abc1).rank)}</span>` : `<span class="mini-rating muted">—</span>`);
          const img = s.hero || "";
          return `<a class="series-card" href="${D.ROOT}dizi/${s.slug}/">
            <div class="series-thumb ${img ? "" : "no-image"}">${img ? `<img src="${D.esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('no-image')">` : ""}</div>
            <div class="series-body">
              <div class="series-top"><span class="day-chip">${s.airing || s.day || ""}</span><span class="status-chip">${s.status}</span></div>
              <h3>${s.titleFa}</h3>
              <p dir="ltr">${s.titleTr}</p>
              ${ratingLine}
            </div>
          </a>`;
        })
        .join("");
    } else {
      $("#net-series").innerHTML = `<div class="notice">سریالی برای این شبکه ثبت نشده است.</div>`;
    }

    // This network's programs in the latest ratings day
    const day = D.latestDay(ratings);
    if (day) {
      const keys = (net.ratingKeys || [net.name]).map((k) => k.toUpperCase());
      const rows = day.categories.total.filter((r) => keys.includes((r.network || "").toUpperCase()));
      $("#net-day-date").textContent = day.date;
      $("#net-ratings").innerHTML = rows.length
        ? rows.map((r) => `<div class="net-rating-row"><b>#${D.fmtInt(r.rank)}</b><span>${r.program}</span><strong>${D.fmtScore(r.rating)}</strong></div>`).join("")
        : `<div class="notice">برنامه‌ای از این شبکه در Top جدول اخیر نیست.</div>`;
    } else {
      $("#net-ratings-section").hidden = true;
    }
  } catch (e) {
    console.error(e);
    $("#net-series").innerHTML = `<div class="notice error">اطلاعات این شبکه در دسترس نیست.</div>`;
  }
})();
