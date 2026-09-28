// Parse TİAK's public daily Top 10 tables. Reject incomplete or changed markup.
export function foldUpper(value) {
  return String(value).replace(/İ|ı/g, "I").replace(/Ş|ş/g, "S")
    .replace(/Ğ|ğ/g, "G").replace(/Ü|ü/g, "U").replace(/Ö|ö/g, "O")
    .replace(/Ç|ç/g, "C").toUpperCase();
}

function clean(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, " ").trim();
}

export function parseDailyTable(html) {
  const rows = [];
  for (const match of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => clean(m[1]));
    if (!/^\d+$/.test(cells[0] || "")) continue;
    if (cells.length !== 7) throw new Error("TİAK daily row has unexpected columns");
    const rank = Number(cells[0]);
    const rating = Number(cells[5].replace(",", "."));
    const share = Number(cells[6].replace(",", "."));
    if (rank !== rows.length + 1 || !cells[1] || !cells[2] ||
        !Number.isFinite(rating) || rating < 0 || !Number.isFinite(share) || share < 0) {
      throw new Error("TİAK daily row has invalid rank or rating");
    }
    rows.push({ rank, program: foldUpper(cells[1]), network: foldUpper(cells[2]), rating, share });
  }
  if (rows.length !== 10 || rows.some((r, i) => i > 0 && r.rating > rows[i - 1].rating)) {
    throw new Error("TİAK daily Top 10 is missing or not sorted");
  }
  return rows;
}

export function parseLatestDate(html) {
  const section = String(html).match(/<div class="anatablolar">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="altalan">/)?.[1] || html;
  const date = section.match(/<div class="tablobaslik">\s*(\d{2}\.\d{2}\.\d{4})\s*<\/div>/)?.[1];
  if (!date) throw new Error("TİAK latest published date is missing");
  return date;
}
