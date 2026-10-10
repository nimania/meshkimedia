#!/usr/bin/env python3
"""Scheduled subtitle candidate discovery for existing MeshkiMedia fiction episodes.
RSS search finds candidate links, not confirmed transcripts; publication is never automatic.
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "github-pages/data/dubbed.json"
OUTPUT = ROOT / "github-pages/data/pavaraghi-discovery-status.json"
LANGS = ("tr", "fa", "en", "ar", "sr", "bs", "hr")
SOURCES = ("subtitlecat.com", "subdl.com", "opensubtitles.org")
EXCLUDED = ("masterchef", "reality", "talk-show", "non-fiction")
MAX_EPISODES = int(os.getenv("PAVARAGHI_EPISODES_PER_RUN", "4"))

def discover(query):
    url = "https://www.bing.com/search?format=rss&q=" + urllib.parse.quote(query)
    request = urllib.request.Request(url, headers={"User-Agent": "MeshkiMediaEvidenceBot/1.0 (source-discovery; no subtitle downloads)"})
    try:
        with urllib.request.urlopen(request, timeout=16) as response:
            xml = response.read(500000)
        tree = ET.fromstring(xml)
        output = []
        for el in tree.findall("./channel/item")[:8]:
            link = (el.findtext("link") or "").strip()
            title = (el.findtext("title") or "").strip()
            if link.startswith("https://") and any(host in urllib.parse.urlparse(link).netloc.lower() for host in SOURCES):
                output.append({"url": link, "title": title, "status": "unverified-search-hit"})
        return output, None
    except Exception as exc:
        return [], type(exc).__name__ + ": " + str(exc)[:160]

def main():
    catalog = json.loads(DATA.read_text(encoding="utf-8"))
    backlog = []
    for series in catalog["series"]:
        entries = series.get("entries", [])
        if not entries:
            continue
        slug = series.get("slug", "")
        if any(word in slug for word in EXCLUDED):
            continue
        for ep in sorted(set(e.get("originalEpisode") for e in entries if e.get("kind") == "original" and isinstance(e.get("originalEpisode"), int))):
            backlog.append((series, ep))
    backlog.sort(key=lambda row: (row[0].get("slug") != "tuzlu-kahve", row[0].get("slug", ""), row[1]))
    previous = {}
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass
    old = {item["key"]: item for item in previous.get("episodes", []) if "key" in item}
    incomplete = [v for v in backlog if (v[0]["slug"] + ":" + str(v[1])) not in old or old[v[0]["slug"] + ":" + str(v[1])].get("lastSearchError")]
    # Round-robin after all episodes have been searched at least once.
    if not incomplete:
        incomplete = sorted(backlog, key=lambda v: old[v[0]["slug"] + ":" + str(v[1])].get("checkedAt", ""))
    candidates = incomplete[:MAX_EPISODES]
    now = datetime.now(timezone.utc).isoformat()
    for series, episode in candidates:
        key = series["slug"] + ":" + str(episode)
        # Two targeted queries per episode. All languages remain in the fallback queue.
        names = [series.get("titleTr", ""), series.get("titleFa", "")]
        queries = [f'"{names[0]}" "{episode}" bölüm subtitle site:subtitlecat.com',
                   f'"{names[0]}" "{episode}" subtitles srt ar sr bs hr']
        hits, errors = [], []
        for q in queries:
            matches, err = discover(q)
            hits.extend(matches)
            if err:
                errors.append(err)
            time.sleep(1)
        unique = {hit["url"]: hit for hit in hits}
        old[key] = {
            "key":key, "seriesSlug":series["slug"], "seriesTitle":series["titleFa"],
            "originalEpisode":episode, "checkedAt":now, "languagesToTry":list(LANGS),
            "candidateUrls":list(unique.values()), "lastSearchError":"; ".join(errors) or None,
            "state":"candidates-found-needs-episode-validation" if unique else "no-validated-source-yet",
            "transcriptVerified":False, "dubbedBoundariesVerified":False,
            "publicationApproved":False
        }
    result = {
        "schemaVersion":1, "generatedAt":now, "mode":"discovery-only-no-auto-publication",
        "firstPriority":"tuzlu-kahve", "totalExistingOriginalEpisodes":len(backlog),
        "processedThisRun":[v[0]["slug"] + ":" + str(v[1]) for v in candidates],
        "episodes":[old[v[0]["slug"] + ":" + str(v[1])] for v in backlog if v[0]["slug"] + ":" + str(v[1]) in old]
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Checked {len(candidates)} of {len(backlog)} existing episodes; sources remain unverified until review")

if __name__ == "__main__":
    main()
