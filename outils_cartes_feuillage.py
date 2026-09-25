# Fabrique des cartes de houppier à partir des atlas de feuilles détourées du pack
# « Verdant Trail » : on isole chaque feuille (composantes connexes du canal alpha),
# puis on en sème des dizaines sur une carte carrée. Une carte = une touffe crédible,
# bien plus réaliste que du feuillage peint à la main.
import os, glob, math, random
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
random.seed(20260920)
SRC = 'verdant_trail/textures'
OUT = 'assets_back/03_textures/foret'
os.makedirs(OUT, exist_ok=True)

def f(base):
    g = sorted(glob.glob(os.path.join(SRC, base + '*')))
    return g[0] if g else None

def rgba(basediff, basealpha):
    p, a = f(basediff), f(basealpha)
    if not p: return None
    im = Image.open(p).convert('RGB')
    if a:
        al = Image.open(a).convert('L')
        if al.size != im.size: al = al.resize(im.size, Image.LANCZOS)
        im = im.copy(); im.putalpha(al)
    else:
        im = im.convert('RGBA')
    return im

def composantes(im, mini=0.0015):
    """Découpe l'atlas en vignettes : une par tache d'alpha connexe."""
    petite = im.resize((512, 512), Image.LANCZOS)
    m = (np.array(petite)[:, :, 3] > 60)
    vu = np.zeros_like(m, dtype=bool)
    boites = []
    H, W = m.shape
    for y in range(H):
        for x in range(W):
            if not m[y, x] or vu[y, x]: continue
            pile = [(y, x)]; vu[y, x] = True
            y0 = y1 = y; x0 = x1 = x; n = 0
            while pile:
                cy, cx = pile.pop(); n += 1
                if cy < y0: y0 = cy
                if cy > y1: y1 = cy
                if cx < x0: x0 = cx
                if cx > x1: x1 = cx
                for dy, dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                    ny, nx = cy+dy, cx+dx
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not vu[ny, nx]:
                        vu[ny, nx] = True; pile.append((ny, nx))
            if n < mini * H * W: continue
            s = im.size[0] / 512.0
            boites.append((int(x0*s), int(y0*s), int((x1+1)*s), int((y1+1)*s)))
    bonnes = []
    for b in boites:
        w, h = b[2]-b[0], b[3]-b[1]
        if w < 10 or h < 10: continue
        if max(w, h) / min(w, h) > 7: continue
        v = im.crop(b)
        remplissage = (np.array(v)[:, :, 3] > 60).mean()
        if remplissage > 0.88 or remplissage < 0.10: continue      # bloc d'atlas, pas une feuille
        bonnes.append(v)
    return bonnes

def carte(vignettes, nom, n=90, taille=512, etalement=0.46, teinte=(1.0, 1.0, 1.0), vertical=False):
    c = Image.new('RGBA', (taille, taille), (0, 0, 0, 0))
    for i in range(n):
        v = random.choice(vignettes)
        # les feuilles du fond sont plus sombres et plus petites : ça creuse la touffe
        prof = i / n
        ech = (0.16 + random.random() * 0.20) * taille / max(v.size)
        w, h = max(4, int(v.size[0]*ech)), max(4, int(v.size[1]*ech))
        ang = random.uniform(-32, 32) if vertical else random.uniform(0, 360)
        o = v.resize((w, h), Image.LANCZOS).rotate(ang, expand=True, resample=Image.BICUBIC)
        lum = 0.55 + 0.55 * prof + random.uniform(-0.10, 0.10)
        px = np.array(o).astype(np.float32)
        px[:, :, 0] *= lum * teinte[0]; px[:, :, 1] *= lum * teinte[1]; px[:, :, 2] *= lum * teinte[2]
        o = Image.fromarray(np.clip(px, 0, 255).astype(np.uint8))
        if vertical:
            x = int(random.uniform(0.06, 0.94) * taille - o.size[0]/2)
            y = int(taille - o.size[1] * random.uniform(0.80, 1.0))
        else:
            a = random.uniform(0, math.tau); r = (random.random() ** 0.62) * etalement * taille
            x = int(taille/2 + math.cos(a)*r - o.size[0]/2)
            y = int(taille/2 + math.sin(a)*r*0.9 - o.size[1]/2)
        c.alpha_composite(o, (max(-o.size[0]+1, x), max(-o.size[1]+1, y)))
    c.save(os.path.join(OUT, nom + '.webp'), 'WEBP', quality=86, method=4)
    return os.path.getsize(os.path.join(OUT, nom + '.webp'))

JOBS = [
    ('houppier_chene',  'island_tree_01_leaves_diff', 'island_tree_01_leaves_alpha', 95, (0.95, 1.00, 0.88), False),
    ('houppier_hetre',  'island_tree_01_leaves_diff', 'island_tree_01_leaves_alpha', 120, (0.86, 1.00, 0.78), False),
    ('houppier_tendre', 'tree_small_02_leaves_diff',  'tree_small_02_leaves_alpha',  90, (1.00, 0.98, 0.84), False),
    ('houppier_fin',    'jacaranda_tree_leaves_diff', 'jacaranda_tree_leaves_alpha', 70, (0.92, 1.00, 0.90), False),
    ('buisson',         'shrub_03_diff',              'shrub_03_alpha',              80, (0.95, 1.00, 0.88), False),
    ('buisson_bas',     'shrub_04_diff',              'shrub_04_alpha',              85, (0.98, 1.00, 0.90), False),
    ('lierre',          'ivy_diff',                   'ivy_alpha',                   70, (0.92, 1.00, 0.88), False),
    ('brins',           'grass_medium_02_diff',       'grass_medium_02_alpha',       110, (1.00, 1.00, 0.95), True),
    ('brins_secs',      'grass_medium_02_dry_diff',   'grass_medium_02_alpha',       110, (1.00, 0.98, 0.88), True),
]
for nom, d, a, n, teinte, vert in JOBS:
    im = rgba(d, a)
    if im is None: print('  absent :', d); continue
    vg = composantes(im)
    if not vg: print('  aucune vignette :', d); continue
    o = carte(vg, nom, n=n, teinte=teinte, vertical=vert)
    print('  %-20s %2d vignettes -> %6.0f Ko' % (nom, len(vg), o/1024))
