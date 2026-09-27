import assert from "node:assert/strict";
import { test } from "node:test";
import { candidateLinks, discover } from "./discover-episodes.mjs";

test("accepts official episode pages and rejects trailers and cross-show links", () => {
  const html = `
    <a href="/ask-ve-taht/4-bolum">4. Bölüm</a>
    <a href="/ask-ve-taht/4-bolum-fragmani">Fragman</a>
    <a href="/ask-ve-taht/ozet/4-bolum-ozeti">Özet</a>
    <a href="/other-show/4-bolum">Other show</a>
    <a href="https://other.example/ask-ve-taht/5-bolum">Other host</a>
    <a href="/ask-ve-taht/3-bolum?ref=listing">3. Bölüm</a>`;
  assert.deepEqual(candidateLinks(html, "https://www.atv.com.tr/ask-ve-taht/bolumler", "ask-ve-taht"), [
    { number: 4, url: "https://www.atv.com.tr/ask-ve-taht/4-bolum" },
    { number: 3, url: "https://www.atv.com.tr/ask-ve-taht/3-bolum" },
  ]);
});

test("separates unregistered candidates from known episodes without publishing", async () => {
  const series = { "ask-ve-taht": { titleFa: "عشق و تخت", kind: "series", status: "در حال پخش", official: {
    website: "https://www.atv.com.tr/ask-ve-taht", episodes: "https://www.atv.com.tr/ask-ve-taht/bolumler",
  }, seasons: [{ episodes: [{ number: 3 }] }] } };
  const results = await discover(series, async () => '<a href="/ask-ve-taht/3-bolum">3</a><a href="/ask-ve-taht/4-bolum">4</a>');
  assert.equal(results[0].discovered, 2);
  assert.deepEqual(results[0].candidates, [{ number: 4, url: "https://www.atv.com.tr/ask-ve-taht/4-bolum" }]);
});

test("recognizes episode URL patterns on other broadcasters", () => {
  const cases = [
    ["https://www.kanald.com.tr/haysiyet/bolumler", "haysiyet", "/haysiyet/bolumler/haysiyet-2-bolum", 2],
    ["https://www.showtv.com.tr/dizi/tanitim/sevdan-bir-ates/3087", "sevdan-bir-ates", "/dizi/tum_bolumler/sevdan-bir-ates-sezon-1-bolum-3-izle/134992", 3],
    ["https://www.nowtv.com.tr/Anne-Yarisi/bolumler", "anne-yarisi", "/Anne-Yarisi/bolum/1", 1],
  ];
  for (const [listing, slug, href, number] of cases) {
    assert.equal(candidateLinks(`<a href="${href}">Episode</a>`, listing, slug)[0]?.number, number);
  }
});
