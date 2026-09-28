/* Search page (ara/). Reads data/search-index.json; filters via #q (or ?q=). */
(async function () {
  "use strict";
  const D = window.DiziMeter;
  const { root } = window.DM;
  const el = document.querySelector("#list");
  const q = document.querySelector("#q");
  const TYPE = { series: "سریال", episode: "قسمت", actor: "بازیگر", character: "نقش", work: "اثر", network: "شبکه" };
  try {
    const index = await fetch(`${root}data/search-index.json?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
    const render = (v) => {
      v = D.asciiDigits((v || "").trim().toLowerCase());
      if (!v) { el.innerHTML = `<div class="notice">نام سریال، فیلم، بازیگر، نقش یا قسمت را بنویس…</div>`; return; }
      const hits = index.filter((r) => (r.titleFa + " " + (r.titleTr || "") + " " + (r.sub || "")).toLowerCase().includes(v)).slice(0, 60);
      if (!hits.length) { el.innerHTML = `<div class="notice">چیزی پیدا نشد.</div>`; return; }
      el.innerHTML = hits.map((r) => `<a class="result-row" href="${root}${r.url}"><span class="result-type t-${r.t}">${TYPE[r.t] || r.t}</span><div class="result-copy"><strong>${D.esc(r.titleFa)}</strong>${r.titleTr ? `<span dir="ltr">${D.esc(r.titleTr)}</span>` : ""}${r.sub ? `<em>${D.esc(r.sub)}</em>` : ""}</div></a>`).join("");
    };
    const params = new URLSearchParams(location.search);
    const initial = params.get("q") || "";
    if (q) { q.value = initial; q.addEventListener("input", () => render(q.value)); q.focus(); }
    render(initial);
  } catch (e) { console.error(e); el.innerHTML = `<div class="notice error">جستجو در دسترس نیست.</div>`; }
})();
