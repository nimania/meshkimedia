#!/usr/bin/env python3
"""Create reviewable PNG cards for the latest official TİAK date; never post them."""
import io
import json
import os
from pathlib import Path
import urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "github-pages" / "data"
DEST = ROOT / "github-pages" / "social" / "ratings"
LOGO = ROOT / "github-pages" / "images" / "meshki-media-logo.png"
series = json.loads((DATA / "series.json").read_text())
ratings = json.loads((DATA / "ratings.json").read_text())
calendar = json.loads((DATA / "calendar.json").read_text())
day = ratings["days"][0]
date = "-".join(reversed(day["date"].split(".")))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
if not Path(FONT).exists():
    FONT = str(Path(os.environ.get("CODEX_PRIMARY_RUNTIME_ROOT", "/usr/share/fonts")) / "DejaVuSans.ttf")
    BOLD = FONT

def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)

def fa(text):
    return str(text).translate(str.maketrans("0123456789.-", "۰۱۲۳۴۵۶۷۸۹٫−"))

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
        txt(draw, (x + 22, y + h - (22 if compact else 26)), f"{'↑' if delta > 0 else '↓' if delta < 0 else '＝'} {fmt(abs(delta))} نسبت به پخش قبلی", 15 if compact else 18,
            "#7be2b7" if delta > 0 else "#ff8392" if delta < 0 else "#d9cdd0", rtl=True, anchor="la")
    elif row:
        txt(draw, (x + 22, y + h - (22 if compact else 26)), "بدون مقایسهٔ قبلی", 15 if compact else 17, "#a9949b", rtl=True, anchor="la")

def card(show, rows, episode, art, landscape=False):
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
        line = f"{fa(day['date'])}  •  {show['titleTr']}"
        txt(d, (W - 46, 193), line, 20, "#b9a6ac", rtl=True)
        subtitle = f"فصل {fa(episode['season'])} · قسمت {fa(episode['number'])}" if episode else "شمارهٔ قسمت هنوز در تقویم ثبت نشده"
        txt(d, (W - 46, 224), subtitle, 22, "#ffffff", rtl=True)
        cover(canvas, (714, 255, 445, 340), art, title)
        d = ImageDraw.Draw(canvas)
        for i, mode in enumerate(("total", "ab", "abc1")):
            metric(d, (39, 256 + i * 112, 645, 100), mode.upper(), rows[mode], previous(show, mode), True)
        txt(d, (39, H - 39), "instagram.com/meshki.media", 17, "#eebbc2")
        txt(d, (W - 43, H - 39), "داده: TİAK", 17, "#b9a6ac", rtl=True)
    else:
        fitted(d, (W - 44, 150), title, W - 88, 61, "#ffffff")
        txt(d, (W - 45, 229), f"{fa(day['date'])}  •  {show['titleTr']}", 23, "#b9a6ac", rtl=True)
        subtitle = f"فصل {fa(episode['season'])} · قسمت {fa(episode['number'])}" if episode else "شمارهٔ قسمت هنوز در تقویم ثبت نشده"
        txt(d, (W - 45, 256), subtitle, 26, "#ffffff", rtl=True)
        for i, mode in enumerate(("total", "ab", "abc1")):
            metric(d, (40, 293 + i * 152, 1000, 135), mode.upper(), rows[mode], previous(show, mode))
        cover(canvas, (40, 773, 1000, 460), art, title)
        d = ImageDraw.Draw(canvas)
        txt(d, (40, H - 52), "instagram.com/meshki.media", 18, "#eebbc2")
        txt(d, (W - 45, H - 52), "داده: TİAK  •  تصویر: شبکهٔ پخش", 18, "#b9a6ac", rtl=True)
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
    episode = next((dict(number=e["episode"], season=e["season"]) for e in calendar.get("days", {}).get(date, []) if e["slug"] == show["slug"]), None)
    if episode is None:
        episode = next((dict(number=ep["number"], season=season["number"]) for season in show.get("seasons", []) for ep in season.get("episodes", []) if ep.get("date") == date), None)
    photo = official_art(show.get("hero", ""))
    name = show["slug"]
    for kind, landscape in (("instagram", False), ("x", True)):
        card(show, rows, episode, photo, landscape).save(DEST / f"{name}-{kind}.png", optimize=True)
    cards.append((show, name, episode))

from html import escape
items = "".join(f'<article><h2>{escape(show["titleFa"])}</h2><p>{"قسمت " + fa(ep["number"]) if ep else "شمارهٔ قسمت ثبت نشده"}</p><img src="{name}-instagram.png" alt="کارت ریتینگ {escape(show["titleFa"])}" loading="lazy"><p><a download href="{name}-instagram.png">دریافت اینستاگرام (۱۰۸۰×۱۳۵۰)</a> · <a download href="{name}-x.png">دریافت X (۱۲۰۰×۶۷۵)</a></p></article>' for show, name, ep in cards)
index = f'''<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>کارت‌های ریتینگ | مشکی‌مدیا</title><style>body{{font-family:system-ui,sans-serif;background:#120f11;color:#fff;max-width:1050px;margin:auto;padding:26px}}h1{{font-size:clamp(24px,4vw,40px)}}p{{color:#c7b7bc}}a{{color:#ff6579}}main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}}article{{padding:18px;background:#241c20;border-radius:20px}}article img{{width:100%;border-radius:14px}}</style><a href="../../reyting/">← ریتینگ سایت</a><h1>کارت‌های آمادهٔ انتشار</h1><p>دادهٔ رسمی {fa(day['date'])} از TİAK؛ برای هر سریال، نسخهٔ اینستاگرام و X آمادهٔ دریافت است. پیش از انتشار، تصویر و اطلاعات را مرور کنید.</p><main>{items or '<p>امروز سریالی در جدول عمومی ثبت نشده است.</p>'}</main></html>'''
(DEST / "index.html").write_text(index)
print(f"Created {len(cards)} series cards for {day['date']} in {DEST}")
