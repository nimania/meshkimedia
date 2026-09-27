/* Shared, source-backed rating trends. Missing rows are never estimated. */
(function (root) {
  "use strict";
  const colors = ["#d10a1e", "#2167c6", "#14846e", "#a55a12", "#8052b0", "#bd3b83", "#237f9c", "#806e16", "#5d6dc6", "#b84635", "#347347", "#704795", "#ca6393", "#497c82", "#8d572b", "#6677a4", "#b33d54", "#639c37"];
  const modes = ["total", "ab", "abc1"];
  const labels = { total: "Total", ab: "AB", abc1: "ABC1" };
  const iso = (date) => { const [d, m, y] = String(date || "").split("."); return y ? `${y}-${m}-${d}` : ""; };
  const fa = (v) => Number(v).toLocaleString("fa-IR", { maximumFractionDigits: 2 });
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function broadcasts(ratings, s) {
    const episodes = (s.seasons || []).flatMap((season) => season.episodes || []);
    const key = (s.ratingKey || "").toUpperCase().trim();
    if (!key) return [];
    return (ratings.days || []).slice().reverse().map((day) => {
      const rows = Object.fromEntries(modes.map((mode) => [mode,
        (day.categories?.[mode] || []).find((r) => String(r.program || "").toUpperCase().trim() === key) || null]));
      const date = iso(day.date);
      return { date, episode: episodes.find((e) => e.date === date) || null, rows };
    }).filter((p) => modes.some((mode) => p.rows[mode]));
  }

  function onAir(series) {
    return Object.values(series).filter((s) => s.kind === "series" && (!s.status || s.status === "در حال پخش") && s.ratingKey);
  }

  function changes(points, mode = "total", metric = "rating") {
    const values = points.filter((p) => Number.isFinite(p.rows[mode]?.[metric]));
    if (values.length < 2) return null;
    const previous = values[values.length - 2].rows[mode][metric];
    const current = values[values.length - 1].rows[mode][metric];
    return { previous, current, delta: metric === "rank" ? previous - current : current - previous,
      firstDate: values[values.length - 2].date, lastDate: values[values.length - 1].date };
  }

  // SVG axes are numeric; for ranks, 1 is drawn at the top of the plot.
  function chart(lines, { metric = "rating", width = 760, height = 260, xCount = 0, aria = "روند ریتینگ" } = {}) {
    const eligible = lines.flatMap((line) => line.points.map((p, i) => ({ ...p, i })).filter((p) => Number.isFinite(p.value)));
    if (!eligible.length) return '<div class="trend-empty">برای این نما هنوز دادهٔ قابل رسم ثبت نشده است.</div>';
    const left = 45, right = 16, top = 22, bottom = 43;
    const w = width - left - right, h = height - top - bottom;
    const maxX = Math.max(xCount - 1, ...eligible.map((p) => p.x ?? p.i), 1);
    const vals = eligible.map((p) => p.value);
    const low = metric === "rank" ? 1 : Math.max(0, Math.floor(Math.min(...vals) - 1));
    const high = metric === "rank" ? Math.max(10, ...vals) : Math.ceil(Math.max(...vals) + 1);
    const x = (p, i) => left + ((p.x ?? i) / maxX) * w;
    const y = (v) => top + (metric === "rank" ? (v - low) / (high - low) : (high - v) / (high - low)) * h;
    const ticks = Array.from({ length: 5 }, (_, i) => metric === "rank" ? Math.round(low + (high - low) * i / 4) : high - (high - low) * i / 4);
    const grids = ticks.map((v) => `<line x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${left - 9}" y="${y(v) + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${fa(v)}</text>`).join("");
    const content = lines.map((line) => {
      let paths = "", last = null;
      const points = line.points.map((p, i) => {
        if (!Number.isFinite(p.value)) { last = null; return ""; }
        const px = x(p, i), py = y(p.value);
        // Do not bridge a missing episode/category; explicit broadcasts remain adjacent.
        if (last && (p.x ?? i) === last.index + 1) paths += `<path d="M${last.x.toFixed(1)},${last.y.toFixed(1)} L${px.toFixed(1)},${py.toFixed(1)}" fill="none" stroke="${line.color}" stroke-width="3" stroke-linecap="round"/>`;
        last = { x: px, y: py, index: p.x ?? i };
        const title = `${line.name} · ${p.label || `پخش ${i + 1}`} · ${p.date || ""} · ${metric === "rank" ? "رتبه" : "ریتینگ"} ${fa(p.value)}${metric === "rating" ? "٪" : ""}`;
        return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${p.current ? 7 : 5}" fill="${line.color}" stroke="var(--surface)" stroke-width="${p.current ? 3 : 2}"><title>${esc(title)}</title></circle>`;
      }).join("");
      return paths + points;
    }).join("");
    const xLabels = [0, Math.floor(maxX / 2), maxX].filter((v, i, a) => a.indexOf(v) === i)
      .map((v) => `<text x="${left + v / maxX * w}" y="${height - 12}" text-anchor="middle" fill="var(--muted)" font-size="11">${fa(v + 1)}</text>`).join("");
    return `<svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(aria)}" preserveAspectRatio="xMidYMid meet"><title>${esc(aria)}</title>${grids}${content}${xLabels}</svg>`;
  }

  root.RatingTrends = { colors, modes, labels, broadcasts, onAir, changes, chart, fa, esc };
})(typeof window !== "undefined" ? window : globalThis);
