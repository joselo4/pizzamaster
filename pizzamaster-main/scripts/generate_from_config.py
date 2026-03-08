
"""Genera SVGs + SQL a partir de promos_config.json (quirúrgico)."""
import json, pathlib
from datetime import datetime

base = pathlib.Path(__file__).resolve().parents[1]
cfg = json.loads((base/'promos_config.json').read_text(encoding='utf-8'))

(public_promos := base/'public'/'promos').mkdir(parents=True, exist_ok=True)
(social := public_promos/'social').mkdir(parents=True, exist_ok=True)
(supabase_sql := base/'supabase_sql').mkdir(parents=True, exist_ok=True)

brand = cfg['brand']

# --- SVG helpers ---

def svg_banner(primary, secondary, accent, store, title, subtitle, price, badge=None, legal=None, w=1600, h=600):
    badge_block = ""
    if badge:
        badge_block = f"""
        <rect x='48' y='44' width='200' height='64' rx='12' fill='{accent}'/>
        <text x='148' y='88' text-anchor='middle' font-family='Arial, Helvetica, sans-serif' font-size='32' font-weight='900' fill='{secondary}'>{badge}</text>
        """
    legal_block = ""
    if legal:
        legal_block = f"<text x='80' y='{h-30}' font-family='Arial, Helvetica, sans-serif' font-size='18' fill='rgba(255,255,255,0.75)'>{legal}</text>"
    return f"""<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' viewBox='0 0 {w} {h}'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='{primary}'/>
      <stop offset='1' stop-color='{secondary}'/>
    </linearGradient>
  </defs>
  <rect width='{w}' height='{h}' fill='url(#g)'/>
  <g opacity='0.10'>
    <circle cx='{w*0.77}' cy='{h*0.48}' r='240' fill='#fff'/>
    <circle cx='{w*0.82}' cy='{h*0.56}' r='180' fill='{accent}'/>
    <circle cx='{w*0.86}' cy='{h*0.62}' r='140' fill='#fff'/>
  </g>
  <text x='80' y='90' font-family='Arial, Helvetica, sans-serif' font-size='40' font-weight='900' fill='rgba(255,255,255,0.9)'>{store}</text>
  {badge_block}
  <text x='80' y='240' font-family='Arial, Helvetica, sans-serif' font-size='132' font-weight='900' fill='#fff'>{title}</text>
  <text x='84' y='318' font-family='Arial, Helvetica, sans-serif' font-size='52' font-weight='700' fill='rgba(255,255,255,0.92)'>{subtitle}</text>
  <text x='{w-80}' y='{h-120}' text-anchor='end' font-family='Arial, Helvetica, sans-serif' font-size='112' font-weight='900' fill='#fff'>{price}</text>
  {legal_block}
</svg>"""


def svg_square(primary, secondary, accent, store, title, bullets, price, badge=None, w=1024, h=1024):
    badge_block = ""
    if badge:
        badge_block = f"""
        <rect x='{w-280}' y='52' width='220' height='64' rx='12' fill='{accent}'/>
        <text x='{w-170}' y='96' text-anchor='middle' font-family='Arial, Helvetica, sans-serif' font-size='30' font-weight='900' fill='{secondary}'>{badge}</text>
        """
    bullet_lines = []
    y = 220
    for b in bullets[:4]:
        bullet_lines.append(f"<text x='72' y='{y}' font-family='Arial, Helvetica, sans-serif' font-size='40' fill='rgba(255,255,255,0.92)'>• {b}</text>")
        y += 62
    return f"""<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' viewBox='0 0 {w} {h}'>
  <defs>
    <linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='{secondary}'/>
      <stop offset='1' stop-color='{primary}'/>
    </linearGradient>
  </defs>
  <rect width='{w}' height='{h}' fill='url(#g2)'/>
  <text x='72' y='110' font-family='Arial, Helvetica, sans-serif' font-size='42' font-weight='900' fill='rgba(255,255,255,0.9)'>{store}</text>
  {badge_block}
  <text x='72' y='185' font-family='Arial, Helvetica, sans-serif' font-size='88' font-weight='900' fill='#fff'>{title}</text>
  {''.join(bullet_lines)}
  <text x='72' y='{h-80}' font-family='Arial, Helvetica, sans-serif' font-size='110' font-weight='900' fill='#fff'>{price}</text>
</svg>"""


def svg_social(primary, secondary, accent, store, title, subtitle, price, size=(1080,1080), layout='post'):
    w,h = size
    title_y = 280 if layout=='story' else 250
    price_y = h-180 if layout=='story' else h-140
    sub_y = title_y+90
    return f"""<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' viewBox='0 0 {w} {h}'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='{primary}'/>
      <stop offset='1' stop-color='{secondary}'/>
    </linearGradient>
  </defs>
  <rect width='{w}' height='{h}' fill='url(#bg)'/>
  <g opacity='0.10'>
    <circle cx='{w*0.76}' cy='{h*0.42}' r='{min(w,h)*0.22}' fill='#fff'/>
    <circle cx='{w*0.82}' cy='{h*0.52}' r='{min(w,h)*0.17}' fill='{accent}'/>
  </g>
  <text x='64' y='110' font-family='Arial, Helvetica, sans-serif' font-size='44' font-weight='900' fill='rgba(255,255,255,0.92)'>{store}</text>
  <text x='64' y='{title_y}' font-family='Arial, Helvetica, sans-serif' font-size='{120 if layout=="story" else 110}' font-weight='900' fill='#fff'>{title}</text>
  <text x='66' y='{sub_y}' font-family='Arial, Helvetica, sans-serif' font-size='{54 if layout=="story" else 48}' font-weight='700' fill='rgba(255,255,255,0.92)'>{subtitle}</text>
  <rect x='64' y='{price_y}' width='{w-128}' height='{90 if layout=="story" else 86}' rx='18' fill='rgba(0,0,0,0.25)'/>
  <text x='{w-70}' y='{price_y+62}' text-anchor='end' font-family='Arial, Helvetica, sans-serif' font-size='{64 if layout=="story" else 62}' font-weight='900' fill='#fff'>{price}</text>
  <text x='84' y='{price_y+62}' font-family='Arial, Helvetica, sans-serif' font-size='{34 if layout=="story" else 32}' font-weight='700' fill='rgba(255,255,255,0.90)'>Pide ahora</text>
</svg>"""

# Generate assets
for promo in cfg['promos']:
    slug = promo['slug']
    bullets = []
    if 'bullets' in promo and isinstance(promo['bullets'], list):
        bullets = promo['bullets']
    else:
        # fallback: derive from detail
        bullets = [promo.get('detail_text','')]
    banner_name = promo['image']['banner'].split('/')[-1]
    thumb_name  = promo['image']['thumb'].split('/')[-1]
    (public_promos/banner_name).write_text(
        svg_banner(brand['primary'], brand['secondary'], brand['accent'], brand['store_name'], promo.get('badge','PROMO'), promo.get('subheadline',''), promo.get('price_text',''), badge=promo.get('badge'), legal=brand.get('legal')),
        encoding='utf-8'
    )
    (public_promos/thumb_name).write_text(
        svg_square(brand['primary'], brand['secondary'], brand['accent'], brand['store_name'], promo.get('name','').upper(), bullets, promo.get('price_text',''), badge=promo.get('badge')),
        encoding='utf-8'
    )

    social_base = slug.replace('-','_')
    title = (promo.get('badge','PROMO')+' '+promo.get('name','')).strip().upper()
    (social/f"{social_base}_ig_post_1080.svg").write_text(
        svg_social(brand['primary'], brand['secondary'], brand['accent'], brand['store_name'], title, promo.get('subheadline',''), promo.get('price_text',''), size=(1080,1080), layout='post'),
        encoding='utf-8'
    )
    (social/f"{social_base}_ig_story_1080x1920.svg").write_text(
        svg_social(brand['primary'], brand['secondary'], brand['accent'], brand['store_name'], title, promo.get('subheadline',''), promo.get('price_text',''), size=(1080,1920), layout='story'),
        encoding='utf-8'
    )
    (social/f"{social_base}_fb_post_1200x1200.svg").write_text(
        svg_social(brand['primary'], brand['secondary'], brand['accent'], brand['accent'], title, promo.get('subheadline',''), promo.get('price_text',''), size=(1200,1200), layout='post'),
        encoding='utf-8'
    )

# SQL upsert
sql = [
  "-- 22_promotions_variants_upsert.sql",
  "-- Generado por scripts/generate_from_config.py",
  f"-- {datetime.now().isoformat()}
"
]
for promo in cfg['promos']:
    def esc(s):
        return (s or '').replace("'","''")
    sql.append(
      "insert into public.promotions as p (slug, name, badge, headline, subheadline, price_text, detail_text, cta_label, cta_url, image_url, thumb_url, active, sort_index) values ("
      f"'{esc(promo['slug'])}', '{esc(promo.get('name'))}', '{esc(promo.get('badge'))}', '{esc(promo.get('headline'))}', '{esc(promo.get('subheadline'))}', '{esc(promo.get('price_text'))}', '{esc(promo.get('detail_text'))}', '{esc(brand.get('cta_label','Pedir ahora'))}', '{esc(brand.get('cta_url',''))}', '{esc(promo['image']['banner'])}', '{esc(promo['image']['thumb'])}', true, {int(promo.get('sort_index',0))}"
      ") on conflict (slug) do update set name=excluded.name, badge=excluded.badge, headline=excluded.headline, subheadline=excluded.subheadline, price_text=excluded.price_text, detail_text=excluded.detail_text, cta_label=excluded.cta_label, cta_url=excluded.cta_url, image_url=excluded.image_url, thumb_url=excluded.thumb_url, active=excluded.active, sort_index=excluded.sort_index;"
    )

(supabase_sql/'22_promotions_variants_upsert.sql').write_text("
".join(sql)+"
", encoding='utf-8')
print('OK: regenerado')
