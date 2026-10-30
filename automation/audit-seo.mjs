#!/usr/bin/env node
/**
 * Verify that every advertised Meshki Media URL is a real, indexable HTML page.
 * GitHub Pages is hosted under /meshkimedia/; URL paths must preserve this base.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const base = 'https://nimania.github.io/meshkimedia/';
const site = process.argv[2] || 'github-pages';
const xml = await readFile(join(site, 'sitemap.xml'), 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const issues = [];
const counts = {};
const seen = new Set();
const add = (url, reason) => { if (issues.length < 50) issues.push({url,reason}); };
for (const url of urls) {
  if (!url.startsWith(base) || url.includes('?') || url.includes('#')) {add(url, 'invalid_base_url');continue;}
  if (seen.has(url)) {add(url, 'duplicate_url');continue;}
  seen.add(url);
  const path = url.slice(base.length);
  if (path && (!path.endsWith('/') || path.includes('..') || /[^\w\-\/]/.test(path))) {add(url, 'unsafe_path');continue;}
  counts[path.split('/')[0] || 'home'] = (counts[path.split('/')[0] || 'home'] || 0) + 1;
  const file = join(site, path, 'index.html');
  let html;
  try { html = await readFile(file, 'utf8'); }
  catch { add(url, 'missing_page');continue; }
  const canonicals = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/gi)].map(m=>m[1]);
  if (canonicals.length !== 1 || canonicals[0] !== url) add(url, 'not_self_canonical');
  if (/<meta\s+name=["'](?:robots|googlebot)["']\s+content=["'][^"']*noindex/i.test(html))
    add(url, 'noindex_in_sitemap');
  if (!/<h1(?:\s|>)/i.test(html)) add(url, 'missing_h1');
  if (path.includes('/bolum-') && !/<p id="ep-summary" class="ep-summary">[^<]{120,}<\/p>/s.test(html))
    add(url, 'episode_lacks_prerendered_summary');
}
const result = {site: base, urls: urls.length, bySection: counts, errors: issues.length, examples: issues};
await writeFile(join(site, 'data/seo-audit.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log('Meshki SEO sitemap audit:', JSON.stringify({urls:result.urls,sections:result.bySection,errors:result.errors}));
if (urls.length < 100 || issues.length) {
  console.error('Invalid URLs in published sitemap:', JSON.stringify(issues.slice(0, 12)));
  process.exit(1);
}
