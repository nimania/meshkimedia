#!/usr/bin/env python3
"""Create reviewable PNG cards for the latest official TİAK date; never post them."""
import io
import json
import os
from pathlib import Path
import urllib.request
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageOps
import cairosvg
from solar_date import solar_date

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "github-pages" / "data"
DEST = ROOT / "github-pages" / "social" / "ratings"
LOGO = ROOT / "github-pages" / "images" / "meshki-media-logo.png"
series = json.loads((DATA / "series.json").read_text())
ratings = json.loads((DATA / "ratings.json").read_text())
calendar = json.loads((DATA / "calendar.json").read_text())
day = ratings["days"][0]
date = "-".join(reversed(day["date"].split(".")))
FONT = str(ROOT / "github-pages" / "vazirmatn.woff2")
BOLD = FONT
if not Path(FONT).exists():
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

@lru_cache(maxsize=128)
def font(size, bold=False):
    face = ImageFont.truetype(BOLD if bold else FONT, size)
    if FONT.endswith(".woff2"):
        face.set_variation_by_name("Bold" if bold else "Regular")
    return face

def fa(text):
    return str(text).translate(str.maketrans("0123456789.-", "۰۱۲۳۴۵۶۷۸۹٫−"))

@lru_cache(maxsize=16)
def network_logo(slug):
    path = ROOT / "github-pages" / "images" / "networks" / f"{slug}.svg"
    if not path.is_file(): return None
    try:
        return Image.open(io.BytesIO(cairosvg.svg2png(url=str(path), output_width=330))).convert("RGBA")
    except Exception as exc:
        print(f"Network logo unavailable ({slug}): {exc}")
        return None

def network_badge(canvas, slug, xy):
    mark = network_logo(slug)
    if mark is None: return
    x, y = xy
    tile = ImageOps.contain(mark, (150, 62), method=Image.Resampling.LANCZOS)
    panel = Image.new("RGBA", (176, 84), (255, 255, 255, 240))
    panel.alpha_composite(tile, ((176-tile.width)//2, (84-tile.height)//2))
    mask = Image.new("L", panel.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 175, 83), radius=16, fill=255)
    canvas.paste(panel.convert("RGB"), (x, y), mask)

def fmt(value):
    return fa(f"{value:.2f}") if value is not None else "—"

def txt(draw, xy, value, size, fill, *, bold=False, rtl=False, anchor=None):
    draw.text(xy, str(value), font=font(size, bold), fill=fill,
              direction="rtl" if rtl else "ltr", language="fa" if rtl else "en",
              anchor=anchor or ("ra" if rtl else "la"))

def fitted(draw, xy, value, max_width, size, fill, rtl=True):
    while size > 23 and draw.textlength(value, font=font(size, True), direction="rtl" if rtl else "ltr") > max_width:
        size -= 2
    txt(draw, xy, value, size, fill, bold=True, rtl=rtl)

def official_art(url):
    if os.environ.get("SOCIAL_SKIP_ART") == "1":
        return None
    if not url or not url.startswith("https://"):
        return None
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Meshki Media editorial card)"})
        with urllib.request.urlopen(request, timeout=7) as response:
            return Image.open(io.BytesIO(response.read(12_000_000))).convert("RGB")
    except Exception as error:
        print(f"Photo unavailable; using designed fallback: {error}")
        return None

def cover(canvas, box, art, name):
    x, y, w, h = box
    if art:
        tile = ImageOps.fit(art, (w, h), method=Image.Resampling.LANCZOS)
    else:
        tile = Image.new("RGB", (w, h), "#27191d")
        d = ImageDraw.Draw(tile)
        for i in range(0, w + h, 44):
            d.line([(i, 0), (i - h, h)], fill="#473039", width=2)
        fitted(d, (w - 35, h // 2), name, w - 70, 68, "#d3b4b8")
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=30, fill=255)
    canvas.paste(tile, (x, y), mask)

def get_rows(show):
    key = show.get("ratingKey", "").upper().strip()
    return {mode: next((row for row in day["categories"].get(mode, []) if row["program"].upper().strip() == key), None)
            for mode in ("total", "ab", "abc1")}

def previous(show, mode):
    key = show.get("ratingKey", "").upper().strip()
    for old in ratings["days"][1:]:
        for row in old["categories"].get(mode, []):
            if row["program"].upper().strip() == key and row.get("rating") is not None:
                return row["rating"]
    return None

def metric(draw, box, label, row, prior, compact=False):
    x, y, w, h = box
    draw.rounded_rectangle((x, y, x + w, y + h), radius=24, fill="#241c20", outline="#48353c", width=2)
    txt(draw, (x + 24, y + (8 if compact else 19)), label, 22 if compact else 30, "#f2c9cd", bold=True)
    txt(draw, (x + w - 22, y + (12 if compact else 23)), f"رتبه {fa(row['rank'])}" if row else "داده موجود نیست", 17 if compact else 20, "#d9cdd0", rtl=True)
    txt(draw, (x + 22, y + (36 if compact else 52)), fmt(row.get("rating") if row else None), 40 if compact else 57, "#ffffff", bold=True)
    if row and row.get("share") is not None:
        txt(draw, (x + w - 22, y + (45 if compact else 71)), f"سهم {fmt(row['share'])}٪", 16 if compact else 19, "#d9cdd0", rtl=True)
    if row and row.get("rating") is not None and prior is not None:
        delta = row["rating"] - prior
        txt(draw, (x + w - 22, y + h - (24 if compact else 29)), f"{'↑' if delta > 0 else '↓' if delta < 0 else '＝'} {fmt(abs(delta))} نسبت به پخش قبلی", 15 if compact else 17,
            "#7be2b7" if delta > 0 else "#ff8392" if delta < 0 else "#d9cdd0", rtl=True)
    elif row:
        txt(draw, (x + w - 22, y + h - (24 if compact else 29)), "بدون مقایسهٔ قبلی", 15 if compact else 16, "#a9949b", rtl=True)

def card(show, rows, episode, art, landscape=False, report=None):
    report = report or {"date": day["date"], "source": "TİAK"}
    W, H = (1200, 675) if landscape else (1080, 1350)
    canvas = Image.new("RGB", (W, H), "#120f11")
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, 0, W, 16), fill="#e21b38")
    # A compact, direction-safe brand lockup. Keep the Persian name and Latin
    # handle on separate lines so their bidirectional text cannot overlap.
    logo = Image.open(LOGO).convert("RGBA")
    logo = ImageOps.fit(logo, (72, 72), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", (72, 72), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 71, 71), radius=15, fill=255)
    canvas.paste(logo, (38, 39), mask)
    d = ImageDraw.Draw(canvas)
    txt(d, (125, 49), "مشکی‌مدیا", 24, "#ffffff", bold=True, rtl=True, anchor="la")
    txt(d, (126, 85), "@meshki.media", 17, "#eebbc2")
    txt(d, (W - 42, 83), "ریتینگ روزانهٔ سریال‌ها", 25, "#eebbc2", rtl=True)
    title = show["titleFa"]
    if landscape:
        fitted(d, (W - 44, 125), title, W - 95, 49, "#ffffff")
        line = f"{solar_date(report['date'])}  •  {show['titleTr']}"
        txt(d, (W - 46, 193), line, 20, "#b9a6ac", rtl=True)
        subtitle = f"فصل {fa(episode['season'])} · قسمت {fa(episode['number'])}" if episode else "شمارهٔ قسمت هنوز در تقویم ثبت نشده"
        txt(d, (W - 46, 224), subtitle, 22, "#ffffff", rtl=True)
        cover(canvas, (714, 255, 445, 340), art, title)
        network_badge(canvas, show.get("network", ""), (W-219, 273))
        d = ImageDraw.Draw(canvas)
        for i, mode in enumerate(("total", "ab", "abc1")):
            metric(d, (39, 256 + i * 112, 645, 100), mode.upper(), rows[mode], previous(show, mode) if report['source'] == 'TİAK' else None, True)
        txt(d, (39, H - 39), "nimania.github.io/meshkimedia", 16, "#eebbc2")
        txt(d, (W - 43, H - 39), f"داده: {report['source']}", 17, "#b9a6ac", rtl=True)
    else:
        fitted(d, (W - 44, 150), title, W - 88, 61, "#ffffff")
        txt(d, (W - 45, 229), f"{solar_date(report['date'])}  •  {show['titleTr']}", 23, "#b9a6ac", rtl=True)
        subtitle = f"فصل {fa(episode['season'])} · قسمت {fa(episode['number'])}" if episode else "شمارهٔ قسمت هنوز در تقویم ثبت نشده"
        txt(d, (W - 45, 256), subtitle, 26, "#ffffff", rtl=True)
        for i, mode in enumerate(("total", "ab", "abc1")):
            metric(d, (40, 293 + i * 152, 1000, 135), mode.upper(), rows[mode], previous(show, mode) if report['source'] == 'TİAK' else None)
        cover(canvas, (40, 773, 1000, 460), art, title)
        network_badge(canvas, show.get("network", ""), (W-225, 793))
        d = ImageDraw.Draw(canvas)
        txt(d, (40, H - 52), "nimania.github.io/meshkimedia", 17, "#eebbc2")
        txt(d, (W - 45, H - 52), f"داده: {report['source']}  •  @meshki.media", 17, "#b9a6ac", rtl=True)
    return canvas

DEST.mkdir(parents=True, exist_ok=True)
for old in DEST.glob("*.png"):
    old.unlink()

cards = []
for show in series.values():
    if show.get("kind") != "series":
        continue
    rows = get_rows(show)
    if not any(rows.values()):
        continue
    # series.json holds the continuous episode number (synced from the calendar); the raw
    # calendar numbers inside a season, so it is only a fallback.
    episode = next((dict(number=ep["number"], season=season["number"]) for season in show.get("seasons", []) for ep in season.get("episodes", []) if ep.get("date") == date), None)
    if episode is None:
        episode = next((dict(number=e["episode"], season=e["season"]) for e in calendar.get("days", {}).get(date, []) if e["slug"] == show["slug"]), None)
    photo = official_art(show.get("hero", ""))
    name = show["slug"]
    for kind, landscape in (("instagram", False), ("x", True)):
        card(show, rows, episode, photo, landscape).save(DEST / f"{name}-{kind}.png", optimize=True)
    cards.append((show, name, episode, {"date": day["date"], "source": "TİAK", "url": "https://tiak.com.tr/tablolar"}))

# Editorially reviewed public posts can be fresher than TİAK's delayed public Top 10.
# Keep their provenance separate; do not insert these numbers into ratings.json.
reviewed = json.loads((ROOT / "automation" / "reviewed-social-ratings.json").read_text())
for entry in reviewed.get("entries", []):
    show = series.get(entry.get("slug"))
    source = entry.get("source", {})
    order = lambda value: tuple(map(int, reversed(value.split("."))))
    if order(entry["date"]) <= order(day["date"]):
        continue
    if not show or not source.get("url", "").startswith("https://www.instagram.com/p/"):
        continue
    rows = entry["categories"]
    if not all(mode in rows and all(field in rows[mode] for field in ("rank", "rating", "share")) for mode in ("total", "ab", "abc1")):
        continue
    report = {"date": entry["date"], "source": source["name"], "url": source["url"]}
    episode = {"season": entry["season"], "number": entry["episode"]}
    photo = official_art(show.get("hero", ""))
    for kind, landscape in (("instagram", False), ("x", True)):
        card(show, rows, episode, photo, landscape, report).save(DEST / f"{show['slug']}-{kind}.png", optimize=True)
    cards.append((show, show["slug"], episode, report))

from html import escape
cards.sort(key=lambda item: tuple(map(int, reversed(item[3]["date"].split(".")))), reverse=True)
cards = [(s, n, e or {"number": "نامشخص", "season": ""}, r) for s, n, e, r in cards]
items = "".join(f'<article><h2>{escape(show["titleFa"])}</h2><p>قسمت {fa(ep["number"])} · {solar_date(report["date"])} · <a href="{escape(report["url"], quote=True)}" target="_blank" rel="noopener">منبع: {escape(report["source"])}</a></p><img src="{name}-instagram.png" alt="کارت ریتینگ {escape(show["titleFa"])}" loading="lazy"><p><a download href="{name}-instagram.png">دریافت اینستاگرام (۱۰۸۰×۱۳۵۰)</a> · <a download href="{name}-x.png">دریافت X (۱۲۰۰×۶۷۵)</a></p></article>' for show, name, ep, report in cards)
index = f'''<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>کارت‌های ریتینگ | مشکی‌مدیا</title><style>@font-face{{font-family:Vazirmatn;src:url(../../vazirmatn.woff2)}}body{{font-family:Vazirmatn,Tahoma,sans-serif;background:#120f11;color:#fff;max-width:1050px;margin:auto;padding:26px}}h1{{font-size:clamp(24px,4vw,40px)}}p{{color:#c7b7bc}}a{{color:#ff6579}}main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}}article{{padding:18px;background:#241c20;border-radius:20px}}article img{{width:100%;border-radius:14px}}</style><a href="../">← اتاق انتشار</a><h1>کارت‌های آمادهٔ انتشار</h1><p>تاریخ و منبع روی هر کارت مشخص است. دادهٔ رسمی TİAK و نتیجهٔ بازبینی‌شدهٔ دیزیلا جدا نمایش داده می‌شوند؛ پیش از انتشار تصویر و ارقام را مرور کنید.</p><main>{items or '<p>برای این تاریخ کارتی ثبت نشده است.</p>'}</main></html>'''
(DEST / "index.html").write_text(index)
print(f"Created {len(cards)} series cards; official TİAK through {solar_date(day['date'])}, reviewed posts included where newer, in {DEST}")
