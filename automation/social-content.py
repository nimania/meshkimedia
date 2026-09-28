#!/usr/bin/env python3
"""Build editorial, downloadable social cards and captions from published site data."""
from datetime import datetime, date, timedelta
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo
import io
import json
import os
import textwrap
import urllib.request
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageOps
import cairosvg
from solar_date import solar_date

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / "github-pages"
OUT = PAGES / "social"
CARDS = OUT / "cards"
CARDS.mkdir(parents=True, exist_ok=True)
series = json.loads((PAGES / "data/series.json").read_text())
networks = json.loads((PAGES / "data/networks.json").read_text())
calendar = json.loads((PAGES / "data/calendar.json").read_text())
ratings = json.loads((PAGES / "data/ratings.json").read_text())
today = datetime.now(ZoneInfo("Asia/Tehran")).date()
site = "https://nimania.github.io/meshkimedia/"
regular = str(PAGES / "vazirmatn.woff2")
bold = regular
if not Path(regular).exists():
    font_dir = "/usr/share/fonts/truetype/dejavu"
    regular = os.path.join(font_dir, "DejaVuSans.ttf")
    bold = os.path.join(font_dir, "DejaVuSans-Bold.ttf")
logo = Image.open(PAGES / "images/meshki-media-logo.png").convert("RGBA")
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

def fa(value): return str(value).translate(FA)
@lru_cache(maxsize=96)
def f(size, heavy=False):
    face = ImageFont.truetype(bold if heavy else regular, size)
    if regular.endswith(".woff2"):
        face.set_variation_by_name("Bold" if heavy else "Regular")
    return face
def line(d, xy, value, size, color="#fff", heavy=False, rtl=True):
    d.text(xy, value, font=f(size, heavy), fill=color, direction="rtl" if rtl else "ltr", anchor="ra" if rtl else "la")
def wrapped(d, value, max_width, size, max_lines):
    words = value.split()
    lines, current = [], ""
    for word in words:
        proposed = (current + " " + word).strip()
        if d.textlength(proposed, font=f(size), direction="rtl") <= max_width:
            current = proposed
        else:
            if current: lines.append(current)
            current = word
    if current: lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and d.textlength(lines[-1] + "…", font=f(size), direction="rtl") > max_width:
            lines[-1] = lines[-1].rsplit(" ", 1)[0] if " " in lines[-1] else lines[-1][:-1]
        lines[-1] += "…"
    return lines

def artwork(url):
    if os.environ.get("SOCIAL_SKIP_ART") == "1": return None
    if not url or not url.startswith("https://"): return None
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Meshki Media editorial card)"})
        with urllib.request.urlopen(request, timeout=6) as response:
            return Image.open(io.BytesIO(response.read(12_000_000))).convert("RGB")
    except Exception as exc:
        print(f"Artwork unavailable ({url[:55]}): {exc}")
        return None

def date_label(value):
    return solar_date(value)

@lru_cache(maxsize=16)
def network_logo(slug):
    path = PAGES / "images/networks" / f"{slug}.svg"
    if not path.is_file(): return None
    try:
        return Image.open(io.BytesIO(cairosvg.svg2png(url=str(path), output_width=340))).convert("RGBA")
    except Exception as exc:
        print(f"Network logo unavailable ({slug}): {exc}")
        return None

def network_badge(im, slug, xy):
    mark = network_logo(slug)
    if mark is None: return
    x, y = xy
    logo_tile = ImageOps.contain(mark, (148, 58), method=Image.Resampling.LANCZOS)
    panel = Image.new("RGBA", (176, 78), (255, 255, 255, 240))
    panel.alpha_composite(logo_tile, ((176-logo_tile.width)//2, (78-logo_tile.height)//2))
    mask = Image.new("L", panel.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 175, 77), radius=15, fill=255)
    im.paste(panel.convert("RGB"), (x, y), mask)

def card(kind, show, ep, day, summary, art, wide=False):
    W, H = (1200, 675) if wide else (1080, 1350)
    im = Image.new("RGB", (W, H), "#161116")
    d = ImageDraw.Draw(im)
    if art:
        box = (0, 124, 520, H-89) if wide else (0, 124, W, 770)
        tile = ImageOps.fit(art, (box[2]-box[0], box[3]-box[1]), method=Image.Resampling.LANCZOS)
        im.paste(tile, (box[0], box[1]))
    else:
        for x in range(-H, W, 50): d.line((x, 0, x+H, H), fill="#40232d", width=2)
    # Readable gradient on top of supplied broadcaster art.
    length = W if wide else H
    gradient = Image.new("RGBA", (length, 1) if wide else (1, length))
    gradient.putdata([(15, 11, 17, min(248, int(25 + 230 * max(0, (n/length-.20)/.62)))) for n in range(length)])
    overlay = gradient.resize((W, H))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(im)
    # The masthead has its own dark band; no badge sits on faces in the photo.
    d.rectangle((0, 0, W, 112), fill="#20151b")
    d.rectangle((0, 112, W, 124), fill="#e21b38")
    logo_small = ImageOps.fit(logo, (58,58))
    im.paste(logo_small, (W-103, 27), logo_small)
    d = ImageDraw.Draw(im)
    line(d, (W-117, 47), "مشکی‌مدیا", 28, heavy=True)
    line(d, (W-340, 80), "@meshki.media", 18, "#e8bcc5", rtl=False)
    label = "امشب از تلویزیون ترکیه" if kind == "schedule" and day == today.isoformat() else "به‌زودی از تلویزیون ترکیه" if kind == "schedule" else "خلاصهٔ قسمت تازه"
    right = W-55
    base = 245 if wide else 770
    line(d, (right, base), label, 30, "#ff7a8e", heavy=True)
    title = show["titleFa"]
    title_size = 55 if wide else 64
    while title_size > 32 and d.textlength(title, font=f(title_size, True), direction="rtl") > (610 if wide else W-110): title_size -= 2
    line(d, (right, base+72), title, title_size, heavy=True)
    line(d, (right, base+163), f"فصل {fa(ep['season'])}  ·  قسمت {fa(ep['episode'])}  ·  {date_label(day)}", 25, "#f0dfe2")
    network_badge(im, show.get("network", ""), (55, base+170))
    if summary:
        y = base+249
        for paragraph in wrapped(d, summary, 590 if wide else W-115, 23 if wide else 27, 2 if wide else 4):
            line(d, (right, y), paragraph, 23 if wide else 27, "#f6ebed")
            y += 40 if wide else 46
    if not art:
        line(d, (65, 398 if wide else 405), show.get("titleTr", "")[:24], 29 if wide else 38, "#9b6b7a", heavy=True, rtl=False)
    d.rectangle((0, H-89, W, H), fill="#251a20")
    line(d, (W-50, H-45), "مشاهدهٔ جزئیات در مشکی‌مدیا", 21, "#fff")
    line(d, (50, H-45), "nimania.github.io/meshkimedia", 17, "#e8bcc5", rtl=False)
    return im

def episode_detail(show, season, number):
    for se in show.get("seasons", []):
        if se["number"] == season:
            return next((ep for ep in se.get("episodes", []) if ep["number"] == number), None)
    return None

def caption(kind, show, ep, day, summary):
    title = show["titleFa"]
    lead = f"📺 {title} | فصل {fa(ep['season'])}، قسمت {fa(ep['episode'])}"
    if kind == "schedule":
        description = f"{summary}\n\n" if summary else ""
        text = f"{lead}\n🗓 پخش: {date_label(day)}\n\n{description}زمان پخش و اطلاعات قسمت را در مشکی‌مدیا ببینید:"
    else:
        text = f"{lead}\n\n{summary}\n\nخلاصهٔ کامل و تصاویر قسمت در مشکی‌مدیا:"
    return text + f"\n{site}dizi/{show['slug']}/bolum-{ep['episode']}/\n\n@meshki.media #مشکی_مدیا #سریال_ترکی"

items = []
def add(kind, show, ep, day, summary, picture):
    slug = f"{kind}-{day}-{show['slug']}-{ep['episode']}"
    art = artwork(picture or show.get("hero"))
    for platform, wide in (("instagram", False), ("x", True)):
        card(kind, show, ep, day, summary, art, wide).save(CARDS / f"{slug}-{platform}.png", optimize=True)
    text = caption(kind, show, ep, day, summary)
    (CARDS / f"{slug}-caption.txt").write_text(text, encoding="utf-8")
    items.append(dict(kind=kind, slug=slug, show=show, ep=ep, day=day, caption=text))

# Planned episodes contain no invented plot or rating. Only use recorded calendar entries.
for offset in (0, 1):
    day = (today + timedelta(days=offset)).isoformat()
    for ep in calendar.get("days", {}).get(day, []):
        show = series.get(ep["slug"])
        if not show or show.get("kind") != "series": continue
        # A calendar's season-relative number can differ from the series' global episode number.
        # Use its exact number in the card and link; do not graft an unrelated summary onto it.
        add("schedule", show, ep, day, show.get("synopsis", ""), show.get("hero"))

# Recaps require a real summary and a known broadcast date; keep a small recent window.
recaps = []
for show in series.values():
    if show.get("kind") != "series": continue
    for se in show.get("seasons", []):
        for ep in se.get("episodes", []):
            if ep.get("summary") and ep.get("date") and (today - timedelta(days=7)).isoformat() <= ep["date"] <= today.isoformat():
                recaps.append((ep["date"], show, se, ep))
for day, show, se, ep in sorted(recaps, key=lambda x:x[0], reverse=True)[:6]:
    add("recap", show, dict(season=se["number"], episode=ep["number"]), day, ep["summary"], ep.get("image") or show.get("hero"))

# Remove older generated assets so the publication room always reflects current content.
keep = {f"{i['slug']}-{suffix}" for i in items for suffix in ("instagram.png", "x.png", "caption.txt")}
for old in CARDS.iterdir():
    if old.is_file() and old.name not in keep: old.unlink()

latest = ratings["days"][0]["date"]
reviewed_entries = json.loads((ROOT / "automation" / "reviewed-social-ratings.json").read_text()).get("entries", [])
reviewed_by_slug = {entry["slug"]: entry for entry in reviewed_entries if tuple(map(int, reversed(entry["date"].split(".")))) > tuple(map(int, reversed(latest.split("."))))}
sections = []
for kind, title in (("schedule", "پخش امروز و فردا"), ("recap", "خلاصه‌های تازه")):
    rows = []
    for item in items:
        if item["kind"] != kind: continue
        slug = escape(item["slug"])
        name = escape(item["show"]["titleFa"])
        cap = escape(item["caption"])
        rows.append(f'''<article class="card"><div class="preview"><img src="cards/{slug}-instagram.png" alt="کارت {name}" loading="lazy"></div><div class="card-body"><h3>{name} <small>قسمت {fa(item['ep']['episode'])}</small></h3><p>{date_label(item['day'])}</p><div class="actions"><a download href="cards/{slug}-instagram.png">اینستاگرام ۱۰۸۰×۱۳۵۰</a><a download href="cards/{slug}-x.png">X ‏۱۲۰۰×۶۷۵</a><a download href="cards/{slug}-caption.txt">فایل کپشن</a><button type="button" class="copy" data-caption="{slug}">کپی کپشن</button></div><textarea id="{slug}" readonly aria-label="کپشن {name}">{cap}</textarea></div></article>''')
    sections.append(f'<section id="{kind}"><div class="section-head"><h2>{title}</h2><span>{fa(len(rows))} خروجی</span></div><div class="grid">{"".join(rows) or "<p>در داده‌های فعلی موردی برای این بخش ثبت نشده است.</p>"}</div></section>')

gallery_manifest = OUT / "galleries" / "manifest.json"
galleries = json.loads(gallery_manifest.read_text()).get("galleries", []) if gallery_manifest.exists() else []
gallery_cards = []
for gallery in galleries:
    slides = gallery["slides"]
    slug = escape(gallery["name"], quote=True)
    images = "".join(f'<img src="{escape(path, quote=True)}" alt="اسلاید {fa(i)} از {fa(len(slides))}؛ {escape(gallery["title"])}" loading="lazy" {"" if i == 1 else "hidden"}>' for i, path in enumerate(slides, 1))
    gallery_cards.append(f'''<article class="gallery-card" data-gallery="{slug}"><div class="gallery-stage">{images}<button class="gallery-prev" type="button" aria-label="عکس قبلی">❯</button><button class="gallery-next" type="button" aria-label="عکس بعدی">❮</button><span class="gallery-counter">۱ / {fa(len(slides))}</span></div><div class="gallery-body"><h3>{escape(gallery['title'])} · قسمت {fa(gallery['episode'])}</h3><p>{escape(gallery['dateFa'])} · <a href="{escape(gallery['source'], quote=True)}" target="_blank" rel="noopener noreferrer">منبع گالری ↗</a></p><div class="actions"><a href="{escape(gallery['zip'], quote=True)}" download>دریافت همهٔ اسلایدها (ZIP)</a><a href="{escape(slides[0], quote=True)}" download>اسلاید نخست</a><button type="button" class="copy" data-caption="caption-{slug}">کپی کپشن</button></div><textarea id="caption-{slug}" readonly>{escape(gallery['caption'])}</textarea></div></article>''')
sections.append(f'<section id="galleries"><div class="section-head"><h2>گالری قسمت‌ها، آمادهٔ کروسال</h2><span>{fa(len(gallery_cards))} آلبوم</span></div><p>هر آلبوم از عکس‌های ثبت‌شدهٔ همان قسمت ساخته شده است. اسلایدها را ورق بزنید یا بستهٔ آمادهٔ انتشار را دریافت کنید.</p><div class="gallery-grid">{"".join(gallery_cards) or "<p>در روزهای اخیر گالریِ چندعکسی قابل دریافت ثبت نشده است.</p>"}</div></section>')

rating_files = sorted((OUT / "ratings").glob("*-instagram.png"))
rating_cards = []
for file in rating_files:
    slug = file.name[:-len("-instagram.png")]
    show = series.get(slug)
    if show:
        report = reviewed_by_slug.get(slug)
        label = f"{solar_date(report['date'])} · <a href=\"{escape(report['source']['url'], quote=True)}\" target=\"_blank\" rel=\"noopener\">دیزیلا ↗</a>" if report else f"{solar_date(latest)} · TİAK"
        rating_cards.append(f'<article class="rating-card"><img src="ratings/{escape(file.name)}" alt="ریتینگ {escape(show["titleFa"])}" loading="lazy"><div><h3>{escape(show["titleFa"])}</h3><small>{label}</small><br><a download href="ratings/{escape(file.name)}">اینستاگرام</a><a download href="ratings/{escape(slug)}-x.png">X</a></div></article>')
rating_cards.sort(key=lambda html: "دیزیلا" not in html)
sections.append(f'<section id="ratings"><div class="section-head"><h2>کارت‌های ریتینگ</h2><span>آخرین جدول رسمی: {solar_date(latest)}</span></div><p>تاریخ و منبع هر کارت را ببینید. نتیجهٔ تازهٔ بازبینی‌شدهٔ دیزیلا جدا از جدول رسمی TİAK نمایش داده می‌شود؛ نبودن سریال در جدول عمومی به معنی ریتینگ صفر نیست.</p><div class="rating-grid">{"".join(rating_cards) or "<p>برای این تاریخ کارتی ثبت نشده است.</p>"}</div><a class="more" href="ratings/">صفحهٔ کارت‌های ریتینگ ←</a></section>')

html = '''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>اتاق انتشار | مشکی‌مدیا</title><meta name="description" content="کارت‌های آمادهٔ انتشار سریال‌های ترکی؛ پخش، خلاصهٔ قسمت و ریتینگ رسمی، همراه با کپشن فارسی."><style>
:root{color-scheme:dark}@font-face{font-family:Vazirmatn;src:url(../vazirmatn.woff2)}*{box-sizing:border-box}body{margin:0;background:#120f12;color:#f8f3f4;font-family:Vazirmatn,Tahoma,sans-serif;line-height:1.7}a{color:inherit}header{max-width:1220px;margin:auto;padding:28px 22px;display:flex;align-items:center;justify-content:space-between;gap:20px}header img{width:48px;height:48px;object-fit:cover;border-radius:11px}header a{color:#f3c0c8;text-decoration:none}.brand{display:flex;align-items:center;gap:12px;font-weight:800}main{max-width:1220px;margin:auto;padding:20px 22px 100px}.hero{background:linear-gradient(120deg,#38171f,#21161b 60%,#111);border:1px solid #5b323e;border-radius:26px;padding:38px;margin-bottom:32px}.eyebrow{color:#ff8294;font-weight:700}h1{font-size:clamp(30px,5vw,56px);line-height:1.3;margin:12px 0}p{color:#cbbbc0}.hero p{max-width:670px}.nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.nav a,.actions a,.actions button,.more{border:1px solid #70414c;background:#36232a;border-radius:10px;padding:9px 13px;text-decoration:none;color:#fff;font:inherit;cursor:pointer}.nav a:hover,.actions a:hover,.actions button:hover{background:#a81a32}.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}section{margin-top:55px}h2{font-size:clamp(23px,3vw,32px)}.section-head span{color:#e8aebb}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,510px),1fr));gap:22px}.card{display:grid;grid-template-columns:180px 1fr;min-width:0;overflow:hidden;background:#21191d;border:1px solid #50333c;border-radius:18px}.preview img{width:100%;height:100%;object-fit:cover;display:block}.card-body{padding:20px;min-width:0}.card h3{margin:0;font-size:21px}.card small{display:block;color:#eebbc3;font-size:14px}.card p{margin:5px 0 14px}.actions{display:flex;gap:7px;flex-wrap:wrap}.actions a,.actions button{font-size:13px;padding:6px 9px}.card textarea{width:100%;height:92px;margin-top:14px;background:#100e10;border:1px solid #59404a;color:#dbd1d4;border-radius:8px;padding:9px;font:13px/1.6 system-ui;resize:vertical}.rating-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}.rating-card{background:#21191d;border-radius:15px;overflow:hidden}.rating-card img{width:100%;aspect-ratio:4/5;object-fit:cover}.rating-card div{padding:10px 14px}.rating-card h3{margin:0;font-size:16px}.rating-card a{display:inline-block;margin:5px 0 0 12px;color:#ff8da0}.more{display:inline-block;margin-top:20px}footer{max-width:1220px;margin:auto;padding:22px;color:#a9959e;border-top:1px solid #46313a}@media(max-width:600px){.card{grid-template-columns:125px 1fr}.card-body{padding:12px}.preview img{height:100%;object-fit:cover}.hero{padding:24px}header{padding:16px 22px}}
</style></head><body><header><div class="brand"><img src="../images/meshki-media-logo.png" alt="لوگوی مشکی‌مدیا">مشکی‌مدیا / اتاق انتشار</div><a href="../">بازگشت به سایت ←</a></header><main><div class="hero"><div class="eyebrow">ابزار محتوای مشکی‌مدیا</div><h1>از دادهٔ سایت تا پست آماده</h1><p>کارت تصویری و کپشن فارسی برای پخش قسمت‌ها، خلاصه‌های تازه و ریتینگ. تصویر و متن را پیش از انتشار بازبینی کنید. تاریخ‌ها بر اساس تهران هستند؛ هیچ کارتِ پخش آینده‌ای ادعای ریتینگ یا خلاصهٔ تأییدنشده ندارد.</p><nav class="nav"><a href="#schedule">پخش امروز و فردا</a><a href="#recap">خلاصه‌ها</a><a href="#ratings">ریتینگ</a></nav></div>''' + ''.join(sections) + '''</main><footer>مشکی‌مدیا · خروجی‌ها با به‌روزرسانی سایت از داده‌های ثبت‌شده ساخته می‌شوند. انتشار در شبکه‌های اجتماعی دستی است.</footer><script>document.querySelectorAll('.copy').forEach(button=>button.addEventListener('click',async()=>{const text=document.getElementById(button.dataset.caption).value;try{await navigator.clipboard.writeText(text);button.textContent='کپی شد ✓';setTimeout(()=>button.textContent='کپی کپشن',1800)}catch{const field=document.getElementById(button.dataset.caption);field.select();document.execCommand('copy');button.textContent='کپی شد ✓'}}));</script></body></html>'''
html = html.replace('</style></head>', '''.gallery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:22px}.gallery-card{background:#21191d;border:1px solid #50333c;border-radius:18px;overflow:hidden}.gallery-stage{position:relative;background:#120f12}.gallery-stage img{width:100%;aspect-ratio:4/5;object-fit:contain;display:block}.gallery-stage img[hidden]{display:none}.gallery-stage button{position:absolute;top:47%;border:0;border-radius:50%;background:#20151bdc;color:#fff;width:40px;height:40px;cursor:pointer;font:24px Vazirmatn}.gallery-prev{right:10px}.gallery-next{left:10px}.gallery-counter{position:absolute;bottom:10px;right:12px;background:#20151bdc;padding:3px 10px;border-radius:20px}.gallery-body{padding:18px}.gallery-body h3{margin:0}.gallery-body textarea{width:100%;height:90px;margin-top:12px;background:#100e10;color:#fff;border:1px solid #59404a;border-radius:8px;padding:9px;font:13px/1.6 Vazirmatn}</style></head>''')
html = html.replace('</script></body></html>', '''document.querySelectorAll('[data-gallery]').forEach(card=>{let index=0;const images=[...card.querySelectorAll('.gallery-stage img')];const update=()=>{images.forEach((img,i)=>img.hidden=i!==index);card.querySelector('.gallery-counter').textContent=`${(index+1).toLocaleString('fa-IR')} / ${images.length.toLocaleString('fa-IR')}`};card.querySelector('.gallery-next').addEventListener('click',()=>{index=(index+1)%images.length;update()});card.querySelector('.gallery-prev').addEventListener('click',()=>{index=(index-1+images.length)%images.length;update()})});</script></body></html>''')
html = html.replace('<a href="#ratings">ریتینگ</a>', '<a href="#ratings">ریتینگ</a><a href="#galleries">کروسال قسمت‌ها</a>')
(OUT / "index.html").write_text(html, encoding="utf-8")
print(f"Created {len(items)} social items ({sum(x['kind']=='schedule' for x in items)} schedule, {sum(x['kind']=='recap' for x in items)} recap), {len(rating_cards)} rating previews")
