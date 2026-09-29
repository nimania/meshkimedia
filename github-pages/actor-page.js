/* Actor (oyuncu) page. window.DM = { root, slug }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { slug, root } = window.DM;
  const $ = (s) => document.querySelector(s);
  try {
    const { series, profiles, works } = await D.loadData();
    const people = D.buildPeople(series, profiles, works);
    const pr = people[slug];
    if (!pr) throw new Error("actor not found");
    document.title = `${pr.nameFa || pr.name} — بازیگر | مشکی مدیا`;
    // Editorial bio wins; otherwise a short Wikipedia summary (data/bios.json) with its license and source.
    const bios = await fetch(`${root}data/bios.json?v=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const wiki = bios[slug];
    const bioEl = $("#actor-bio");
    const creditEl = $("#actor-bio-credit");
    const wikiText = wiki && (wiki.fa?.text || wiki.text);
    if (pr.bio) bioEl.textContent = pr.bio;
    else if (wikiText) {
      bioEl.textContent = wikiText;
      if (!wiki.fa?.text) { bioEl.lang = wiki.lang || "tr"; bioEl.dir = "ltr"; }
      const src = wiki.fa?.source || wiki.source;
      if (src && /^https:\/\//.test(src.url)) {
        creditEl.innerHTML = `منبع: <a href="${D.esc(src.url)}" target="_blank" rel="noopener noreferrer">${D.esc(src.name)} ↗</a> · مجوز <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fa" target="_blank" rel="noopener noreferrer">${D.esc(src.license || "CC BY-SA 4.0")}</a>${wiki.fa?.machine ? " · ترجمهٔ فارسی خودکار است" : (wiki.fa ? "" : " · متن اصلی، بدون ترجمه")}`;
        creditEl.hidden = false;
      }
    } else bioEl.textContent = "معرفی کامل این بازیگر در حال تکمیل است. نقش‌ها و آثار تأییدشدهٔ ثبت‌شده را در پایین ببینید.";
    if (pr.source && /^https:\/\//.test(pr.source)) {
      $("#actor-source").href = pr.source;
      $("#actor-source").hidden = false;
    }
    const socialLabels = { instagram: "اینستاگرام", x: "ایکس", youtube: "یوتیوب", tiktok: "تیک‌تاک", facebook: "فیسبوک", website: "وب‌سایت" };
    const socials = Object.entries(pr.socials || {}).filter(([key, url]) => socialLabels[key] && /^https:\/\//.test(url));
    if (socials.length) {
      $("#actor-socials").innerHTML = socials.map(([key, url]) => `<a href="${D.esc(url)}" target="_blank" rel="noopener noreferrer">${socialLabels[key]} ↗</a>`).join("");
      $("#actor-socials").hidden = false;
    }
    $("#credit-count").textContent = `${D.fmtInt(pr.credits.length)} اثر ثبت‌شده`;
    $("#credits").innerHTML = pr.credits.map((c) => {
      const s = c.seriesSlug ? series[c.seriesSlug] : works[c.workSlug];
      const charUrl = c.seriesSlug && c.character ? `${root}karakter/${D.slugify(c.seriesSlug + "-" + c.character)}/` : null;
      const cName = c.characterFa || c.character || "";
      const href = c.seriesSlug ? `${root}dizi/${c.seriesSlug}/` : `${root}asar/${c.workSlug}/`;
      const image = s && (s.hero || s.image);
      return `<article class="credit-card">
        <a class="credit-series" href="${href}">
          <div class="credit-thumb ${image ? "" : "no-image"}" ${image ? `style="background-image:url('${D.esc(image)}')"` : ""}><span>${c.kind === "film" ? "فیلم" : "سریال"}${c.year ? ` · ${new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(c.year)}` : ""}</span></div>
          <strong>${D.esc(c.titleFa || c.titleTr)}</strong>
        </a>
        <div class="credit-role">${charUrl ? `نقش: <a href="${charUrl}">${D.esc(cName)}</a>` : (cName ? "نقش: " + D.esc(cName) : "اطلاعات نقش در حال تکمیل")}</div>
      </article>`;
    }).join("") || '<div class="notice">هنوز اثری برای این بازیگر ثبت نشده است.</div>';
  } catch (e) { console.error(e); const el = $("#credits"); if (el) el.innerHTML = `<div class="notice error">اطلاعات این بازیگر در دسترس نیست.</div>`; }
})();
