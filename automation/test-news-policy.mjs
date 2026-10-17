import assert from "node:assert/strict";
import { newsScope, isTelegramNews } from "./news-policy.mjs";
const story = (title, snippet = "", entities = { series: [], people: [], networks: [] }) => ({ title, snippet, entities });
const testCases = [
  ["Election / government news", story("Türkiye'de seçim gündemi", "Bakanlık ekonomi politikası hakkında açıklama yaptı"), "", false],
  ["Sports news", story("Galatasaray maçı ve futbol gündemi", "Takım, hafta sonu karşılaşmasına hazırlanıyor"), "", false],
  ["Music release", story("Yeni şarkı yayınlandı", "Şarkıcı albümünü duyurdu"), "general", false],
  ["Concert", story("İstanbul'da konser", "Ünlü sanatçının canlı performansı"), "general", false],
  ["Theater", story("Yeni tiyatro oyunu", "Sahnede oyuncular buluştu"), "general", false],
  ["Series (untracked)", story("Yeni dizi fragmanı yayınlandı", "Yeni bölüm bu hafta ekranda"), "dizi", true],
  ["Series ratings", story("Maçlar zirveyi kaptı, diziler geride kaldı", "15 Ekim reyting sonuçları"), "dizi", true],
  ["Cast gossip without series mention", story("Yeni aşk iddiası", "Ünlüler gündemde", { series: [], people: ["actor-1"], networks: [] }), "linked", true],
  ["Music with named cast member", story("Oyuncu yeni albüm çıkardı", "", { series: [], people: ["actor-2"], networks: [] }), "linked", true],
  ["Network only does not suffice", story("Türkiye'de yeni vergi", "", { series: [], people: [], networks: ["show-tv"] }), "", false],
  ["Generic 'set' is not a series", story("New set of government reforms", "New policy set announced"), "", false],
];
for (const [label, item, expectedScope, expectedTelegram] of testCases) {
  assert.equal(newsScope(item), expectedScope, label + " scope");
  assert.equal(isTelegramNews(item), expectedTelegram, label + " Telegram");
}
console.log("News scope and Telegram routing: " + testCases.length + " cases passed.");
