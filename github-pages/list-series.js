/* Series list (diziler/). Fills #list, filters via #q. window.DM = { root }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { root } = window.DM;
  const el = document.querySelector("#list");
  const q = document.querySelector("#q");
  try {
    const { networks, series, ratings } = await D.loadData();
    const all = D.seriesList(series).sort((a, b) => (a.dayIndex ?? 9) - (b.dayIndex ?? 9) || a.titleFa.localeCompare(b.titleFa, "fa"));
    const card = (s) => {
      const net = networks[s.network];
      const head = D.seriesHeadlineRating(ratings, s);
      const rating = head && head.modes.total && head.modes.total.rating != null ? `<span class="mini-rating">Total ${D.fmtScore(head.modes.total.rating)}</span>` : (head ? `<span class="mini-rating">رتبه #${D.fmtRank((head.modes.total || head.modes.ab || head.modes.abc1).rank)}</span>` : `<span class="mini-rating muted">—</span>`);
      return `<a class="series-card" href="${root}dizi/${s.slug}/" data-k="${D.esc((s.titleFa + " " + s.titleTr).toLowerCase())}">
        <div class="series-thumb ${s.hero ? "" : "no-image"}">${s.hero ? `<img src="${D.esc(s.hero)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('no-image')">` : ""}</div>
        <div class="series-body"><div class="series-top"><span class="day-chip">${s.airing || s.day || ""}</span><span class="status-chip">${s.status}</span></div>
        <h3>${D.esc(s.titleFa)}</h3><p dir="ltr">${D.esc(s.titleTr)}</p>
        <div class="row-between">${net ? D.networkMark(networks, s.network) : "<span></span>"}${rating}</div></div></a>`;
    };
    el.innerHTML = all.map(card).join("");
    if (q) q.addEventListener("input", () => {
      const v = D.asciiDigits(q.value.trim().toLowerCase());
      el.querySelectorAll(".series-card").forEach((c) => { c.style.display = !v || c.dataset.k.includes(v) ? "" : "none"; });
    });
  } catch (e) { console.error(e); el.innerHTML = `<div class="notice error">فهرست در دسترس نیست.</div>`; }
})();
