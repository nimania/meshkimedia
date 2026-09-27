/* Actors list (oyuncular/). Fills #list, filters via #q. window.DM = { root }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { root } = window.DM;
  const el = document.querySelector("#list");
  const q = document.querySelector("#q");
  try {
    const { series, profiles, works } = await D.loadData();
    const people = Object.values(D.buildPeople(series, profiles, works)).sort((a, b) => a.name.localeCompare(b.name));
    if (!people.length) { el.innerHTML = `<div class="notice">هنوز بازیگری ثبت نشده است.</div>`; return; }
    el.innerHTML = people.map((pr) => {
      const disp = pr.nameFa || pr.name;
      const roles = pr.credits.map((c) => c.characterFa || c.character).filter(Boolean).slice(0, 2).join("، ");
      return `<a class="person-card" href="${root}oyuncu/${pr.slug}/" data-k="${D.esc((pr.name + " " + (pr.nameFa || "")).toLowerCase())}">
        <div class="person-thumb ${pr.photo ? "" : "no-image"}">${pr.photo ? `<img src="${D.esc(pr.photo)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.classList.add('no-image')">` : ""}<span class="avatar-initial">${D.esc(disp.slice(0, 1))}</span></div>
        <strong>${D.esc(disp)}</strong><span>${D.esc(roles || (D.fmtInt(pr.credits.length) + " نقش"))}</span></a>`;
    }).join("");
    if (q) q.addEventListener("input", () => { const v = q.value.trim().toLowerCase(); el.querySelectorAll(".person-card").forEach((c) => { c.style.display = !v || c.dataset.k.includes(v) ? "" : "none"; }); });
  } catch (e) { console.error(e); el.innerHTML = `<div class="notice error">فهرست بازیگران در دسترس نیست.</div>`; }
})();
