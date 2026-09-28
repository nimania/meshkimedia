#!/usr/bin/env python3
"""Sourced episode-photo carousels for the publication room."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo
from zipfile import ZipFile, ZIP_DEFLATED
import json
import shutil
import urllib.request

import cairosvg
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
from solar_date import solar_date

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / "github-pages"
OUT = PAGES / "social" / "galleries"
SERIES = json.loads((PAGES / "data" / "series.json").read_text())
TODAY = datetime.now(ZoneInfo("Asia/Tehran")).date()
FONT = PAGES / "vazirmatn.woff2"
LOGO = Image.open(PAGES / "images" / "meshki-media-logo.png").convert("RGBA")
W, H = 1080, 1350
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

@lru_cache(maxsize=32)
def font(size, bold=False):
    face = ImageFont.truetype(str(FONT), size)
    face.set_variation_by_name("Bold" if bold else "Regular")
    return face

@lru_cache(maxsize=16)
def network_logo(slug):
    path = PAGES / "images" / "networks" / f"{slug}.svg"
    if not path.is_file(): return None
    return Image.open(BytesIO(cairosvg.svg2png(url=str(path), output_width=320))).convert("RGBA")

def photo(url):
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Meshki Media gallery)"})
        with urllib.request.urlopen(request, timeout=9) as response:
            if not response.headers.get("Content-Type", "").startswith("image/"): return None
            return Image.open(BytesIO(response.read(12_000_000))).convert("RGB")
    except Exception as error:
        print(f"Gallery image unavailable ({url[:65]}): {error}")
        return None

def slide(show, season, ep, day, picture, number, total, first=False):
    canvas = Image.new("RGB", (W, H), "#20151b")
    backdrop = ImageOps.fit(picture, (W, 1061), method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(30))
    canvas.paste(backdrop, (0, 119))
    fitted = ImageOps.contain(picture, (W, 1061), method=Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((W-fitted.width)//2, 119+(1061-fitted.height)//2))
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, 0, W, 110), fill="#20151b")
    d.rectangle((0, 110, W, 119), fill="#e21b38")
    tile = ImageOps.fit(LOGO, (58, 58))
    canvas.paste(tile, (W-94, 27), tile)
    d.text((W-110, 48), "مشکی‌مدیا", font=font(28, True), anchor="ra", direction="rtl", fill="white")
    d.text((W-310, 90), "@meshki.media", font=font(17), anchor="la", fill="#f4c6ce")
    mark = network_logo(show.get("network", ""))
    if mark:
        tile = ImageOps.contain(mark, (135, 56))
        panel = Image.new("RGBA", (164, 74), (255, 255, 255, 240))
        panel.alpha_composite(tile, ((164-tile.width)//2, (74-tile.height)//2))
        mask = Image.new("L", panel.size)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, 163, 73), radius=14, fill=255)
        canvas.paste(panel.convert("RGB"), (32, 19), mask)
    d = ImageDraw.Draw(canvas)
    if first:
        d.rounded_rectangle((70, 425, 1010, 760), radius=30, fill="#20151b")
        d.text((W//2, 500), "گالری عکس‌های قسمت", font=font(34, True), anchor="mm", direction="rtl", fill="#ff8ca0")
        size = 49
        while size > 30 and d.textlength(show["titleFa"], font=font(size, True), direction="rtl") > 860: size -= 2
        d.text((W//2, 600), show["titleFa"], font=font(size, True), anchor="mm", direction="rtl", fill="white")
        d.text((W//2, 699), "ورق بزنید ←", font=font(24), anchor="mm", direction="rtl", fill="#f4c6ce")
    d.rectangle((0, 1130, W, H), fill="#20151b")
    title_size = 42
    while title_size > 28 and d.textlength(show["titleFa"], font=font(title_size, True), direction="rtl") > 940: title_size -= 2
    d.text((W-45, 1203), show["titleFa"], font=font(title_size, True), anchor="ra", direction="rtl", fill="white")
    detail = f"فصل {str(season).translate(FA)} · قسمت {str(ep).translate(FA)} · {solar_date(day)}"
    d.text((W-45, 1296), detail, font=font(24), anchor="ra", direction="rtl", fill="#f4c6ce")
    d.text((42, 1296), f"{number}/{total}".translate(FA), font=font(22), fill="white")
    return canvas

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    eligible = []
    for show in SERIES.values():
        for season in show.get("seasons", []):
            for ep in season.get("episodes", []):
                day = ep.get("date", "")
                if not day or not (TODAY - timedelta(days=7) <= datetime.fromisoformat(day).date() <= TODAY): continue
                urls = list(dict.fromkeys(url for url in ep.get("images", []) if url.startswith("https://")))[:6]
                if len(urls) >= 2 and ep.get("photosSource", "").startswith("https://"):
                    eligible.append((day, show, season["number"], ep, urls))
    eligible.sort(key=lambda item: item[0], reverse=True)
    manifest, keep = [], set()
    for day, show, season, ep, urls in eligible[:12]:
        with ThreadPoolExecutor(max_workers=6) as pool:
            pictures = [picture for picture in pool.map(photo, urls) if picture is not None]
        if len(pictures) < 2: continue
        name = f"{day}-{show['slug']}-ep-{ep['number']}"
        folder = OUT / name
        folder.mkdir(exist_ok=True)
        count = len(pictures)+1
        images = [slide(show, season, ep["number"], day, pictures[0], 1, count, True)]
        images.extend(slide(show, season, ep["number"], day, picture, i+2, count)
                      for i, picture in enumerate(pictures))
        files = []
        for index, image in enumerate(images, 1):
            filename = f"{index:02d}.jpg"
            image.save(folder / filename, quality=88, optimize=True)
            files.append(f"galleries/{name}/{filename}")
        caption = (f"📸 گالری قسمت {str(ep['number']).translate(FA)} {show['titleFa']} — {solar_date(day)}\n"
                   f"عکس‌ها: {ep['photosSource']}\n"
                   f"اطلاعات قسمت: https://nimania.github.io/meshkimedia/dizi/{show['slug']}/bolum-{ep['number']}/\n"
                   "@meshki.media #مشکی_مدیا #سریال_ترکی")
        (folder / "caption.txt").write_text(caption, encoding="utf-8")
        with ZipFile(folder / "carousel.zip", "w", ZIP_DEFLATED) as bundle:
            for index in range(1, count+1): bundle.write(folder / f"{index:02d}.jpg", f"{index:02d}.jpg")
            bundle.write(folder / "caption.txt", "caption.txt")
        manifest.append({"name": name, "title": show["titleFa"], "slug": show["slug"],
                         "episode": ep["number"], "date": day, "dateFa": solar_date(day),
                         "source": ep["photosSource"], "slides": files,
                         "zip": f"galleries/{name}/carousel.zip", "caption": caption})
        keep.add(name)
    for old in OUT.iterdir():
        if old.is_dir() and old.name not in keep: shutil.rmtree(old)
    (OUT / "manifest.json").write_text(json.dumps({"galleries": manifest}, ensure_ascii=False, indent=2) + "\n")
    print(f"Created {len(manifest)} sourced episode carousels.")

if __name__ == "__main__": main()
