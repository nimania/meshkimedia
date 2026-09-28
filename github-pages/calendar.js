/* Dated listings from a sourced snapshot; future episodes are never inferred. */
(async function () {
  "use strict";
  const D = window.DiziMeter, { root } = window.DM;
  const feed = document.querySelector("#calendar-feed");
  const strip = document.querySelector("#calendar-strip");
  const status = document.querySelector("#calendar-status");
  const note = document.querySelector("#calendar-note");
  const search = document.querySelector("#calendar-search");
  const networkSelect = document.querySelector("#calendar-network");
  const todayButton = document.querySelector("#calendar-today");
  const numeral = new Intl.NumberFormat("fa-IR");
  const longDate = new Intl.DateTimeFormat("fa-IR", { timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long" });
  const shortDate = new Intl.DateTimeFormat("fa-IR", { timeZone: "Europe/Istanbul", weekday: "short", day: "numeric", month: "short" });
  const dateObject = (iso) => new Date(iso + "T12:00:00Z");
  const localDay = () => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = (type) => parts.find((p) => p.type === type).value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  };
  const fold = (s) => D.asciiDigits(String(s || "")).toLocaleLowerCase("tr").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replaceAll("ي", "ی").replaceAll("ك", "ک");
  try {
    const [{ networks, series }, response] = await Promise.all([
      D.loadData(),
      fetch(`${root}data/calendar.json?v=${Date.now()}`, { cache: "no-store" }),
    ]);
    if (!response.ok) throw new Error(`Calendar HTTP ${response.status}`);
    const data = await response.json();
    const dates = Object.keys(data.days || {}).sort();
    if (!dates.length) throw new Error("Empty calendar");
    const today = localDay();
    const count = dates.reduce((sum, date) => sum + data.days[date].length, 0);
    const networkIds = [...new Set(dates.flatMap((date) => data.days[date].map((entry) =>
      (series[entry.slug] || data.shows[entry.slug] || {}).network)))].filter(Boolean);
    networkSelect.innerHTML = '<option value="">همهٔ شبکه‌ها</option>' +
      networkIds.map((id) => `<option value="${D.esc(id)}">${D.esc(networks[id]?.name || id)}</option>`).join("");
    status.textContent = `${numeral.format(count)} پخش در ${numeral.format(dates.length)} روز · آخرین بررسی: ${D.isoToFa(data.source.checkedAt)}`;
    const source = document.querySelector("#calendar-source");
    source.href = data.source.url;
    source.textContent = "قدرت‌گرفته از دیزیلا ↗";
    note.hidden = today <= dates.at(-1);
    if (!note.hidden) note.textContent = `آخرین تاریخ تأییدشده ${D.isoToFa(dates.at(-1))} است؛ پخش‌های بعدی هنوز ثبت نشده‌اند.`;
    function render() {
      const term = fold(search.value.trim());
      const network = networkSelect.value;
      const matches = (entry) => {
        const show = series[entry.slug] || data.shows[entry.slug];
        if (!show || (network && show.network !== network)) return false;
        return !term || fold([show.titleFa, show.titleTr, networks[show.network]?.name].join(" ")).includes(term);
      };
      const visible = dates.map((date) => [date, data.days[date].filter(matches)])
        .filter(([, entries]) => entries.length);
      strip.innerHTML = visible.map(([date, entries]) =>
        `<button type="button" class="calendar-date-pill${date === today ? " is-today" : ""}" data-jump="${date}" aria-label="${longDate.format(dateObject(date))}">
          <span>${shortDate.format(dateObject(date))}</span><b>${numeral.format(entries.length)}</b>
        </button>`).join("");
      feed.innerHTML = visible.length ? visible.map(([date, entries]) => `
        <section class="calendar-day${date === today ? " is-today" : ""}" id="day-${date}">
          <div class="calendar-day-heading"><div><span>${date === today ? "امروز · " : ""}${longDate.format(dateObject(date))}</span>
            <small>${D.isoToFaNumeric(date)}</small></div><b>${numeral.format(entries.length)} سریال</b></div>
          <div class="calendar-cards">${entries.map((entry) => {
            const show = series[entry.slug] || data.shows[entry.slug];
            const net = networks[show.network];
            const known = series[entry.slug];
            const existing = known && D.allEpisodes(known).find((ep) => ep.date === date);
            const href = known ? `${root}dizi/${known.slug}/bolum-${existing?.number || entry.episode}/` : data.source.url;
            const image = show.hero ? `<img src="${D.esc(show.hero)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
            return `<a class="calendar-card" href="${D.esc(href)}"${known ? "" : ' target="_blank" rel="noopener noreferrer"'}>
              <span class="calendar-poster">${image}<span class="calendar-poster-letter">${D.esc((show.titleFa || show.titleTr).slice(0, 1))}</span></span>
              <span class="calendar-card-body"><span class="calendar-card-network">${D.networkMark(networks, show.network)}</span>
                <strong>${D.esc(show.titleFa || show.titleTr)}</strong>
                ${show.titleFa ? `<span class="calendar-original" dir="ltr">${D.esc(show.titleTr)}</span>` : ""}
                <span class="calendar-episode">فصل ${numeral.format(entry.season)} · قسمت ${numeral.format(entry.episode)}</span>
                ${entry.premiere === "series" ? '<em class="calendar-premiere">شروع سریال</em>' : ""}
                ${known ? "" : '<span class="calendar-external">جزئیات در مرجع ↗</span>'}
              </span></a>`;
          }).join("")}</div></section>`).join("") : '<div class="notice">برای این جستجو برنامه‌ای پیدا نشد.</div>';
      strip.querySelectorAll("[data-jump]").forEach((button) => button.addEventListener("click", () => {
        document.getElementById(`day-${button.dataset.jump}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }));
    }
    search.addEventListener("input", render);
    networkSelect.addEventListener("change", render);
    todayButton.addEventListener("click", () => document.getElementById(`day-${today}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    todayButton.hidden = !dates.includes(today);
    render();
  } catch (error) {
    console.error(error);
    feed.innerHTML = '<div class="notice error">تقویم موقتاً در دسترس نیست.</div>';
  }
})();
