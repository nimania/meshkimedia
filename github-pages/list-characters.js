/* Characters list (karakterler/). Fills #list, filters via #q. window.DM = { root }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { root } = window.DM;
  const el = document.querySelector("#list");
  const q = document.querySelector("#q");
  try {
    const { series } = await D.loadData();
    const chars = Object.values(D.buildCharacters(series)).sort((a, b) => a.name.localeCompare(b.name));
    if (!chars.length) { el.innerHTML = `<div class="notice">هنوز کاراکتری ثبت نشده است.</div>`; return; }
    el.innerHTML = chars.map((ch) => {
      const disp = ch.nameFa || ch.name;
      const person = ch.personNameFa || ch.personName;
      return `<a class="person-card" href="${root}karakter/${ch.slug}/" data-k="${D.esc((ch.name + " " + (ch.nameFa || "") + " " + ch.personName).toLowerCase())}">
      <div class="person-thumb ${ch.image ? "" : "no-image"}">${ch.image ? `<img src="${D.esc(ch.image)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.classList.add('no-image')">` : ""}<span class="avatar-initial">${D.esc(disp.slice(0, 1))}</span></div>
      <strong>${D.esc(disp)}</strong><span>${D.esc(ch.seriesTitleFa)}${person ? " · " + person : ""}</span></a>`;
    }).join("");
    if (q) q.addEventListener("input", () => { const v = q.value.trim().toLowerCase(); el.querySelectorAll(".person-card").forEach((c) => { c.style.display = !v || c.dataset.k.includes(v) ? "" : "none"; }); });
  } catch (e) { console.error(e); el.innerHTML = `<div class="notice error">فهرست کاراکترها در دسترس نیست.</div>`; }
})();
