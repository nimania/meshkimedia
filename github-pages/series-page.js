/* Series (dizi) profile. window.DM = { root, slug }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { slug, root } = window.DM;
  const $ = (s) => document.querySelector(s);
  try {
    const { networks, series, ratings } = await D.loadData();
    const d = series[slug];
    if (!d) throw new Error("not found");
    const net = networks[d.network];
    document.title = `${d.titleFa} (${d.titleTr}) | مشکی مدیا`;
    $("#status").textContent = d.status;
    $("#kind-tag").textContent = d.kind === "entertainment" ? "برنامه" : "سریال";
    $("#network").innerHTML = net ? `<a href="${root}kanal/${net.slug}/">${net.name}</a>` : "";
    $("#airing").textContent = d.airing || "";
    $("#studio").textContent = d.studio || "";
    $("#net-badge").innerHTML = D.netBadge(networks, d.network);
    if (d.hero) $(".hero-cover").style.backgroundImage = `url('${d.hero}')`;
    $("#synopsis").textContent = d.synopsis && d.synopsis.trim() ? d.synopsis : "خلاصهٔ داستان به‌زودی افزوده می‌شود.";
    $("#genre").innerHTML = (d.genre || []).map((g) => `<span class="genre-chip">${g}</span>`).join("");

    const off = d.official || {}; const links = [];
    if (off.website) links.push(`<a href="${off.website}" target="_blank" rel="noreferrer">صفحهٔ رسمی ↗</a>`);
    if (off.episodes) links.push(`<a href="${off.episodes}" target="_blank" rel="noreferrer">قسمت‌ها در شبکه ↗</a>`);
    if (d.fragman) links.push(`<a href="${d.fragman}" target="_blank" rel="noreferrer">فراگمان ↗</a>`);
    if (off.youtube) links.push(`<a href="${off.youtube}" target="_blank" rel="noreferrer">یوتیوب رسمی ↗</a>`);
    $("#official-links").innerHTML = links.join("");

    if (d.cast && d.cast.length) {
      $("#cast").innerHTML = d.cast.map((c) => {
        const actorUrl = c.name ? `${root}oyuncu/${D.slugify(c.name)}/` : null;
        const charUrl = c.role ? `${root}karakter/${D.slugify(d.slug + "-" + c.role)}/` : null;
        const photo = c.image ? `style="background-image:url('${c.image}')"` : "";
        const aName = c.nameFa || c.name;
        const cName = c.roleFa || c.role || "";
        // No link wraps the whole card: the role link inside it would be a nested <a>, which the
        // browser splits into two grid cells. Photo + name go to the actor, the role to the character.
        const photoEl = `${c.image ? "" : D.esc((aName || "?").slice(0, 1))}`;
        const inner = (actorUrl ? `<a class="cast-photo" href="${actorUrl}" ${photo}>${photoEl}</a>` : `<div class="cast-photo" ${photo}>${photoEl}</div>`)
          + `<div>${actorUrl ? `<a href="${actorUrl}"><strong>${D.esc(aName)}</strong></a>` : `<strong>${D.esc(aName)}</strong>`}${charUrl ? `<a class="role-link" href="${charUrl}">${D.esc(cName)}</a>` : `<span>${D.esc(cName)}</span>`}</div>`;
        return `<article class="cast-card">${inner}</article>`;
      }).join("");
    } else { $("#cast-section").hidden = true; }

    const eps = D.allEpisodes(d);
    if (eps.length) {
      $("#episodes").innerHTML = eps.slice().reverse().map((e) => {
        const modes = D.ratingModesFor(ratings, d.ratingKey, e.date);
        const href = `${root}dizi/${d.slug}/bolum-${e.number}/`;
        const img = e.image || (e.images && e.images[0]) || "";
        const title = e.title && e.title.trim() ? e.title : `قسمت ${D.fmtInt(e.number)}`;
        const summary = e.summary && e.summary.trim() ? e.summary : "خلاصه به‌زودی افزوده می‌شود.";
        return `<article class="episode-card"><a class="episode-image ${img ? "" : "no-image"}" href="${href}" ${img ? `style="background-image:url('${img}')"` : ""}>${img ? "" : "<span>بدون تصویر</span>"}</a><div class="episode-copy"><div class="episode-meta"><span>قسمت ${D.fmtInt(e.number)}</span><span>${D.isoToFa(e.date)}</span></div><h3><a href="${href}">${title}</a></h3><p>${summary}</p>${D.ratingPills(modes, ratings)}<a class="ep-open" href="${href}">صفحهٔ کامل قسمت ←</a></div></article>`;
      }).join("");
    } else { $("#episodes").innerHTML = `<div class="notice">قسمت‌های این ${d.kind === "entertainment" ? "برنامه" : "سریال"} به‌زودی ثبت می‌شوند.</div>`; }
  } catch (e) { console.error(e); const el = $("#synopsis"); if (el) el.textContent = "اطلاعات این سریال موقتاً در دسترس نیست."; }
})();
