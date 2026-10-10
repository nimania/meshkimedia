#!/usr/bin/env python3
"""Evidence-only tool for the existing MeshkiMedia fictional-series episodes.

No subtitle scraping or automatic publication. Ingest a lawfully acquired
SRT/VTT and create reviewable scene windows, without reproducing dialogue.
"""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import quote

LANGUAGES = ("tr", "fa", "en", "ar", "sr", "bs", "hr")
TIME = re.compile(r"(?:(\d+):)?(\d\d):(\d\d)[,.](\d{3})")
TIMING = re.compile(r"([^\s]+)\s+-->\s+([^\s]+)")
TAG = re.compile(r"<[^>]+>")

def seconds(value):
    m = TIME.fullmatch(value)
    if not m:
        raise ValueError("Invalid cue time: " + value)
    h, minute, sec, ms = m.groups()
    return int(h or 0) * 3600 + int(minute) * 60 + int(sec) + int(ms) / 1000

def parse_cues(raw):
    out = []
    for block in re.split(r"\n\s*\n", raw.replace("\r\n", "\n").lstrip("\ufeff")):
        lines = [v.strip() for v in block.splitlines() if v.strip()]
        match = next(((i, TIMING.match(line)) for i, line in enumerate(lines)
                      if TIMING.match(line)), None)
        if match is None:
            continue
        i, m = match
        try:
            start, end = seconds(m.group(1)), seconds(m.group(2))
        except ValueError:
            continue
        if end <= start:
            continue
        content = " ".join(TAG.sub("", v) for v in lines[i+1:])
        if content:
            out.append((start, end, content))
    return sorted(out)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--series", required=True)
    p.add_argument("--episode", type=int, required=True)
    p.add_argument("--subtitle", type=Path)
    p.add_argument("--language", choices=LANGUAGES, default="tr")
    p.add_argument("--source-url", default="")
    p.add_argument("--rights-confirmed", action="store_true")
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    if args.episode < 1:
        p.error("Episode must be positive")
    query = f"{args.series} {args.episode} bölüm subtitles"
    report = {
        "series": args.series, "episode": args.episode, "language": args.language,
        "sourceUrl": args.source_url, "discoveryQueries": [
            f"{query} {language}" for language in LANGUAGES
        ], "searchUrl": "https://www.google.com/search?q=" + quote(query),
        "status": "candidate-only", "publicationApproved": False,
        "dubbedCutBoundaryVerified": False, "rightsConfirmed": args.rights_confirmed,
        "transcriptExcerptIncluded": False, "windows": []
    }
    if args.subtitle:
        if not args.rights_confirmed:
            p.error("Supply --rights-confirmed only if you have permission to process this subtitle")
        cues = parse_cues(args.subtitle.read_text(encoding="utf-8-sig"))
        if not cues:
            p.error("No valid subtitle cues found")
        for start_bin in range(0, int(cues[-1][1]) + 1, 300):
            subset = [c for c in cues if start_bin <= c[0] < start_bin + 300]
            if subset:
                report["windows"].append({
                    "startSeconds": start_bin, "endSeconds": start_bin + 300,
                    "cueCount": len(subset), "dialogueWordCount": sum(
                        len(c[2].split()) for c in subset
                    ), "verifiedAgainstVideo": False, "storyEvents": []
                })
        report["status"] = "timed-subtitle-imported-awaits-human-video-review"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    print(f"Wrote {args.out}; publication remains blocked pending scene verification")

if __name__ == "__main__":
    main()
