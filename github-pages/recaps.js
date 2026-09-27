/* Recap archive (ozetler/). Lists episode summaries. window.DM = { root }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { root } = window.DM;
  const el = document.querySelector("#list");
  const q = document.querySelector("#q");
  try {
    const { series } = await D.loadData();
    const rows = [];
    D.seriesList(series).forEach((s) => D.allEpisodes(s).forEach((e) => {
      if (e.summary && e.summary.trim()) rows.push({ s, e });
    }));
    rows.sort((a, b) => (b.e.date || "").localeCompare(a.e.date || ""));
    if (!rows.length) { el.innerHTML = `<div class="notice">هنوز خلاصه‌ای ثبت نشده است.</div>`; return; }
    el.innerHTML = rows.map(({ s, e }) => {
      const href = `${root}dizi/${s.slug}/bolum-${e.number}/`;
      const img = e.image || (e.images && e.images[0]) || "";
      const summary = e.summary && e.summary.trim() ? e.summary : "خلاصه به‌زودی افزوده می‌شود.";
      return `<article class="recap-card" data-k="${D.esc((s.titleFa + " " + s.titleTr + " " + summary).toLowerCase())}">
        <a class="recap-thumb ${img ? "" : "no-image"}" href="${href}" ${img ? `style="background-image:url('${img}')"` : ""}></a>
        <div class="recap-copy"><div class="recap-meta"><a href="${root}dizi/${s.slug}/">${D.esc(s.titleFa)}</a><span>قسمت ${D.fmtInt(e.number)} · ${D.isoToFa(e.date)}</span></div>
        <p>${D.esc(summary)}</p><a class="ep-open" href="${href}">قسمت کامل ←</a></div></article>`;
    }).join("");
    if (q) q.addEventListener("input", () => { const v = q.value.trim().toLowerCase(); el.querySelectorAll(".recap-card").forEach((c) => { c.style.display = !v || c.dataset.k.includes(v) ? "" : "none"; }); });
  } catch (e) { console.error(e); el.innerHTML = `<div class="notice error">آرشیو خلاصه‌ها در دسترس نیست.</div>`; }
})();
