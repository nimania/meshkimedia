/* Character (karakter) page. window.DM = { root, slug }. */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { slug, root } = window.DM;
  const $ = (s) => document.querySelector(s);
  try {
    const { series } = await D.loadData();
    const chars = D.buildCharacters(series);
    const ch = chars[slug];
    if (!ch) throw new Error("character not found");
    document.title = `${ch.nameFa || ch.name} — کاراکتر ${ch.seriesTitleFa} | مشکی مدیا`;
    $("#char-description").textContent = ch.description || "توضیح این نقش در حال تکمیل است.";
    if (ch.source && /^https:\/\//.test(ch.source)) {
      $("#char-source").href = ch.source;
      $("#char-source").hidden = false;
    }
    $("#char-sub").innerHTML = `از سریال <a href="${root}dizi/${ch.seriesSlug}/">${D.esc(ch.seriesTitleFa)}</a>`;
    const rows = [];
    rows.push(`<a class="info-row" href="${root}dizi/${ch.seriesSlug}/"><span>سریال</span><b>${D.esc(ch.seriesTitleFa)}</b></a>`);
    if (ch.personName) rows.push(`<a class="info-row" href="${root}oyuncu/${ch.personSlug}/"><span>با بازیِ</span><b>${D.esc(ch.personNameFa || ch.personName)} ↗</b></a>`);
    $("#char-info").innerHTML = rows.join("");
  } catch (e) { console.error(e); const el = $("#char-info"); if (el) el.innerHTML = `<div class="notice error">اطلاعات این کاراکتر در دسترس نیست.</div>`; }
})();
