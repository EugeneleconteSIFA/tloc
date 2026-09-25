# Matériaux tuilables du pack « Verdant Trail ». Certaines cartes sont en EXR :
# Pillow ne les lit pas, on passe par ImageMagick pour celles-là.
import os, glob, subprocess, sys, time
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
SRC = 'verdant_trail/textures'; PH = 'assets_back/03_textures/polyhaven'
def f(base):
    g = sorted(glob.glob(os.path.join(SRC, base + '.*')) + glob.glob(os.path.join(SRC, base + '_[0-9]k.*')))
    return g[0] if g else None
def conv(src, dst, taille):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if src.lower().endswith('.exr'):
        subprocess.run(['convert', src, '-colorspace', 'sRGB', '-resize', '%dx%d' % (taille, taille),
                        '-quality', '82', dst], check=True)
    else:
        im = Image.open(src)
        if im.mode not in ('RGB', 'RGBA', 'L'): im = im.convert('RGB')
        if max(im.size) > taille: im = im.resize((taille, int(im.size[1]*taille/im.size[0])), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=82, method=4)
    return os.path.getsize(dst)
SLUGS = [
    ('rocher_01',      'boulder_01',          2048),
    ('paroi_rocheuse', 'rock_face_01',        2048),
    ('paroi_rocheuse_2','rock_face_2',        2048),
    ('falaise_mousse', 'coastal_cliff_02',    2048),
    ('falaise_02',     'coastal_cliff_04',    1024),
    ('roche_cotiere',  'coast_rocks_05',      1024),
    ('terre_battue',   'dirt_floor',          2048),
    ('racine_01',      'single_root',         1024),
    ('tronc_mort_02',  'dead_tree_trunk_02',  1024),
]
budget = float(sys.argv[1]) if len(sys.argv) > 1 else 150
t0 = time.time()
for slug, pref, taille in SLUGS:
    for cle, suf in (('couleur', '_diff'), ('normale', '_nor_gl'), ('rugosite', '_rough')):
        dst = os.path.join(PH, slug, cle + '.webp')
        if os.path.exists(dst) and os.path.getsize(dst) > 1000: continue
        if time.time() - t0 > budget: print('… budget épuisé'); raise SystemExit
        src = f(pref + suf)
        if not src: print('  absent :', pref + suf); continue
        try: print('  %-28s %6.0f Ko' % (slug + '/' + cle, conv(src, dst, taille) / 1024))
        except Exception as e: print('  ECHEC', slug, cle, e)
print('terminé')
