// Shared publication policy: public Turkey news is not Meshki Media news.
// Series / cast / their entertainment gossip -> site + Telegram.
// Music, concerts, cinema and other entertainment -> site only.
// Politics, economy, sports and other general Turkey news -> neither.
const fold = (input) => String(input || "")
  .replace(/İ/g, "i").replace(/[Iı]/g, "i")
  .toLowerCase().replace(/ş/g, "s").replace(/ğ/g, "g")
  .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

const SERIES_CUE = /(?:^| )(?:dizi(?:si|nin|de|ler|leri|lerin|lerden)?|fragman\w*|reyting\w*|bolum\w*|mini dizi\w*|tv series|television series|series premiere|new episode|episodes?|season finale)(?: |$)/;
const ENTERTAINMENT_CUE = /(?:^| )(?:muzik\w*|music\w*|sarki\w*|sarkici\w*|sarkici\w*|konser\w*|concert\w*|album\w*|klip\w*|video klip|sanat\w*|sanatci\w*|sahne\w*|tiyatro\w*|theat\w*|sinema\w*|cinema\w*|film\w*|movie\w*|oyuncu\w*|actor\w*|actress\w*|celebrity\w*|unlu\w*|magazin\w*|festival\w*|sarkilar\w*|rap|pop|rock|dj|komedy\w*|komedi\w*|comed\w*|eglence\w*|eglenc\w*|showbiz|odul\w*|award\w*|kirmizi hali|red carpet|singer\w*|artist\w*|gala|sahnel\w*)(?: |$)/;

export function isSeriesNews(item) {
  return SERIES_CUE.test(fold(`${item.title || ""} ${item.snippet || ""}`));
}

export function isEntertainmentNews(item) {
  return isSeriesNews(item) || ENTERTAINMENT_CUE.test(fold(`${item.title || ""} ${item.snippet || ""}`));
}

export function newsScope(item) {
  if ((item.entities?.series || []).length || (item.entities?.people || []).length) return "linked";
  if (isSeriesNews(item)) return "dizi";
  if (isEntertainmentNews(item)) return "general";
  return "";
}

export function isTelegramNews(item) {
  const scope = newsScope(item);
  return scope === "linked" || scope === "dizi";
}
