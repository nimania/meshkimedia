/* Series (dizi) profile. window.DM = { root, slug }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { slug, root } = window.DM;
  const $ = (s) => document.querySelector(s);
  try {
    const [base, calendar] = await Promise.all([
      D.loadData(), fetch(`${root}data/calendar.json?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    const { networks, series, ratings } = base;
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
    if (d.hero) { $(".hero-cover").src = d.hero; $(".hero-cover").onerror = function () { this.hidden = true; }; }
    $("#synopsis").textContent = d.synopsis && d.synopsis.trim() ? d.synopsis : "خلاصهٔ داستان به‌زودی افزوده می‌شود.";
    if (d.synopsisSource && /^https:\/\//.test(d.synopsisSource)) {
      $("#synopsis-source").href = d.synopsisSource;
      $("#synopsis-source").hidden = false;
    }
    $("#genre").innerHTML = (d.genre || []).map((g) => `<span class="genre-chip">${g}</span>`).join("");

    const off = d.official || {}; const links = [];
    if (off.website) links.push(`<a href="${off.website}" target="_blank" rel="noreferrer">صفحهٔ رسمی ↗</a>`);
    if (d.heroSource && d.heroSource !== off.website) links.push(`<a href="${D.esc(d.heroSource)}" target="_blank" rel="noreferrer">منبع تصویر ↗</a>`);
    if (off.episodes) links.push(`<a href="${off.episodes}" target="_blank" rel="noreferrer">قسمت‌ها در شبکه ↗</a>`);
    if (d.fragman) links.push(`<a href="${D.esc(d.fragman)}" target="_blank" rel="noopener noreferrer">فراگمان‌ها ↗</a>`);
    if (off.youtube) links.push(`<a href="${off.youtube}" target="_blank" rel="noreferrer">یوتیوب رسمی ↗</a>`);
    $("#official-links").innerHTML = links.join("");

    const photos = [...new Set((d.photos || []).filter((url) => /^https:\/\//.test(url)))];
    if (photos.length) {
      $("#series-gallery").innerHTML = photos.map((url, index) =>
        `<a class="shot" href="${D.esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="عکس ${D.fmtInt(index + 1)} از سریال ${D.esc(d.titleFa)}"><img src="${D.esc(url)}" alt="${D.esc(d.titleFa)}؛ عکس ${D.fmtInt(index + 1)}" loading="lazy" referrerpolicy="no-referrer"></a>`
      ).join("");
      $("#series-gallery-section").hidden = false;
      if (d.photosSource && /^https:\/\//.test(d.photosSource)) {
        $("#series-gallery-source").href = d.photosSource;
        $("#series-gallery-source").hidden = false;
      }
    }

    if (d.cast && d.cast.length) {
      $("#cast").innerHTML = d.cast.map((c) => {
        const actorUrl = c.name ? `${root}oyuncu/${c.personSlug || D.slugify(c.name)}/` : null;
        const charUrl = c.role ? `${root}karakter/${D.slugify(d.slug + "-" + c.role)}/` : null;
        const aName = c.nameFa || c.name;
        const cName = c.roleFa || c.role || "";
        // No link wraps the whole card: the role link inside it would be a nested <a>, which the
        // browser splits into two grid cells. Photo + name go to the actor, the role to the character.
        const photoEl = `${c.image ? `<img src="${D.esc(c.image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<span class="avatar-initial">${D.esc((aName || "?").slice(0, 1))}</span>`;
        const inner = (actorUrl ? `<a class="cast-photo" href="${actorUrl}">${photoEl}</a>` : `<div class="cast-photo">${photoEl}</div>`)
          + `<div>${actorUrl ? `<a href="${actorUrl}"><strong>${D.esc(aName)}</strong></a>` : `<strong>${D.esc(aName)}</strong>`}${charUrl ? `<a class="role-link" href="${charUrl}">${D.esc(cName)}</a>` : `<span>${D.esc(cName)}</span>`}</div>`;
        return `<article class="cast-card">${inner}${c.description ? `<p class="cast-teaser">${D.esc(c.description)}</p>` : ""}</article>`;
      }).join("");
    } else { $("#cast-empty").hidden = false; }

    const eps = D.scheduledEpisodes(d, calendar);
    if (eps.length) {
      $("#episodes").innerHTML = eps.slice().reverse().map((e) => {
        const modes = D.ratingModesFor(ratings, d.ratingKey, e.date);
        const href = `${root}dizi/${d.slug}/bolum-${e.number}/`;
        const img = e.image || (e.images && e.images[0]) || "";
        const title = e.title && e.title.trim() ? e.title : `قسمت ${D.fmtInt(e.number)}`;
        const summary = e.summary && e.summary.trim() ? e.summary : e.scheduled ? "این قسمت در تقویم ثبت شده است؛ ریتینگ آن هنوز اعلام نشده. روند قسمت‌های قبلی را ببینید." : "خلاصه به‌زودی افزوده می‌شود.";
        const ext = e.watchUrl || (d.official && d.official.episodes);
        return `<article class="episode-card"><a class="episode-image ${img ? "" : "no-image"}" href="${href}" ${img ? `style="background-image:url('${D.esc(img)}')"` : ""}>${img ? "" : "<span>تصویر پس از انتشار</span>"}</a><div class="episode-copy"><div class="episode-meta"><span>${e.scheduled ? "در تقویم · " : ""}قسمت ${D.fmtInt(e.number)}</span><span>${D.isoToFa(e.date)}</span></div><h3><a href="${href}">${D.esc(title)}</a></h3><p>${D.esc(summary)}</p>${e.scheduled ? '<p class="ratings-note">ریتینگ هنوز اعلام نشده است.</p>' : D.ratingPills(modes, ratings)}<div class="episode-actions"><a class="ep-open" href="${href}">${e.scheduled ? "روند ریتینگ قسمت‌های قبلی ←" : "خلاصه و عکس‌ها ←"}</a>${!e.scheduled && ext ? `<a href="${D.esc(ext)}" target="_blank" rel="noopener noreferrer">${e.watchUrl ? "تماشای قسمت" : "قسمت‌ها در شبکه"} ↗</a>` : ""}${e.fragman ? `<a href="${D.esc(e.fragman)}" target="_blank" rel="noopener noreferrer">تیزر ↗</a>` : ""}</div></div></article>`;
      }).join("");
    } else { $("#episodes").innerHTML = `<div class="notice">قسمت‌های این ${d.kind === "entertainment" ? "برنامه" : "سریال"} به‌زودی ثبت می‌شوند.</div>`; }
  } catch (e) { console.error(e); const el = $("#synopsis"); if (el) el.textContent = "اطلاعات این سریال موقتاً در دسترس نیست."; }
})();
