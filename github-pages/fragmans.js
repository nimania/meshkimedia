/* Trailer archive (fragmanlar/). Lists series + episode fragman links. window.DM = { root }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { root } = window.DM;
  const el = document.querySelector("#list");
  const q = document.querySelector("#q");
  try {
    const { networks, series } = await D.loadData();
    const items = [];
    D.seriesList(series).forEach((s) => {
      if (s.fragman) items.push({ k: (s.titleFa + " " + s.titleTr).toLowerCase(), title: s.titleFa, sub: "فراگمان‌های سریال", url: s.fragman, page: `${root}dizi/${s.slug}/`, img: s.hero || "" });
      D.allEpisodes(s).forEach((e) => { if (e.fragman) items.push({ k: (s.titleFa + " قسمت " + e.number).toLowerCase(), title: `${s.titleFa} — قسمت ${e.number}`, sub: "فراگمان قسمت", url: e.fragman, page: `${root}dizi/${s.slug}/bolum-${e.number}/`, img: e.image || (e.images && e.images[0]) || s.hero || "" }); });
    });
    if (!items.length) { el.innerHTML = `<div class="notice">هنوز فراگمانی ثبت نشده است.</div>`; return; }
    el.innerHTML = items.map((it) => `<article class="fragman-card" data-k="${D.esc(it.k)}">
      <a class="fragman-thumb ${it.img ? "" : "no-image"}" href="${it.url}" target="_blank" rel="noreferrer" ${it.img ? `style="background-image:url('${it.img}')"` : ""}><span class="play">▶</span></a>
      <div class="fragman-copy"><strong>${D.esc(it.title)}</strong><span>${it.sub}</span><div class="fragman-links"><a href="${it.url}" target="_blank" rel="noreferrer">تماشا ↗</a><a href="${it.page}">صفحه ←</a></div></div></article>`).join("");
    if (q) q.addEventListener("input", () => { const v = q.value.trim().toLowerCase(); el.querySelectorAll(".fragman-card").forEach((c) => { c.style.display = !v || c.dataset.k.includes(v) ? "" : "none"; }); });
  } catch (e) { console.error(e); el.innerHTML = `<div class="notice error">آرشیو فراگمان‌ها در دسترس نیست.</div>`; }
})();
