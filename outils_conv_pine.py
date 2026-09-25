# Tri et conversion du pack Poly Haven « Pine Fir Forest » vers des textures web.
# Les sources restent intactes dans assets_back/pine_forest/ ; on n'écrit que des copies
# WebP redimensionnées, dans les deux conventions déjà utilisées par le jeu :
#   - matériaux tuilables : 03_textures/polyhaven/<slug>/{couleur,normale,rugosite}.webp
#   - cartes à alpha      : 03_textures/foret/<nom>.webp (RGBA)
import os, sys, json, time
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

SRC = 'assets_back/pine_forest/textures'
PH  = 'assets_back/03_textures/polyhaven'
FOR = 'assets_back/03_textures/foret'
ETAT = os.path.expanduser('~/pine_convert_etat.json')

# slug -> (préfixe source, taille, suffixes {couleur, normale, rugosite})
STD = {'couleur': '_diff', 'normale': '_nor_gl', 'rugosite': '_rough'}
TUILABLES = [
    # écorces et troncs : le cœur du sujet
    ('pine_bark',            'pine_bark',            2048, STD),
    ('fir_bark',             'fir_bark',             2048, STD),
    ('pine_trunk_01',        'pine_trunk_01',        1024, STD),
    ('pine_trunk_02',        'pine_trunk_02',        1024, STD),
    ('fir_trunk_01',         'fir_trunk_01',         1024, STD),
    ('tree_trunk',           'tree_trunk',           1024, STD),
    ('tree_roots_01',        'tree_roots_01',        1024, STD),
    ('dead_tree_tiled',      'dead_tree_tiled',      1024, STD),
    ('dry_branches_01',      'dry_branches_medium_01', 1024, STD),
    # sols de forêt
    ('forest_ground_04',     'forest_ground_04',     2048, STD),
    ('forest_leaves_04',     'forest_leaves_04',     2048, STD),
    ('pine_cover_01',        'pine_cover_01',        2048, {'couleur': '_diffuse', 'normale': '_diffuse_normal', 'rugosite': '_rough'}),
    ('rocky_trail',          'rocky_trail',          2048, STD),
    # roches, mousse, ruines — réserve décor
    ('rock_moss_01',         'rock_moss_set_01',     1024, STD),
    ('rock_moss_02',         'rock_moss_set_02',     1024, STD),
    ('mousse',               'moss',                 1024, {'couleur': '_diff', 'rugosite': '_rough'}),
    ('ruines_01',            'montaigle_ruins_01',   2048, {'couleur': '_diff', 'normale': '_nor_gl', 'rugosite': '_rough'}),
    ('ruines_02',            'montaigle_ruins_02',   2048, {'couleur': '_diff', 'normale': '_nor_gl', 'rugosite': '_rough'}),
    ('ruines_03',            'montaigle_ruins_03',   2048, {'couleur': '_diff', 'normale': '_nor_gl', 'rugosite': '_rough'}),
]
# cartes de végétation : diffuse + masque d'opacité fusionnés en RGBA
CARTES = [
    ('pin_rameau',    'pine_twig_diff',           'pine_twig_alpha',       1024),
    ('sapin_rameau',  'fir_twig_diff',            'fir_twig_alpha',        1024),
    ('fougere',       'fern_02_diff',             'fern_02_alpha',         1024),
    ('herbe_haute',   'grass_medium_01_diff',     'grass_medium_01_alpha', 1024),
    ('herbe_seche',   'grass_medium_01_dry_diff', 'grass_medium_01_alpha', 1024),
]

def trouve(base):
    for f in os.listdir(SRC):
        n = f.rsplit('.', 1)[0]
        if n == base or n.replace('_8k', '').replace('_4k', '').replace('_2k', '') == base:
            return os.path.join(SRC, f)
    return None

def conv(src, dst, taille, alpha=None, qualite=82):
    im = Image.open(src)
    if im.mode not in ('RGB', 'RGBA', 'L'): im = im.convert('RGB')
    if alpha:
        a = Image.open(alpha).convert('L')
        if a.size != im.size: a = a.resize(im.size, Image.LANCZOS)
        im = im.convert('RGB'); im.putalpha(a)
    if max(im.size) > taille:
        im = im.resize((taille, max(1, int(im.size[1] * taille / im.size[0]))), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=qualite, method=4)
    return os.path.getsize(dst)

taches = []
for slug, pref, taille, maps in TUILABLES:
    for cle, suf in maps.items():
        taches.append(('ph', slug, cle, pref + suf, None, taille))
for nom, d, a, taille in CARTES:
    taches.append(('carte', nom, None, d, a, taille))

etat = json.load(open(ETAT)) if os.path.exists(ETAT) else {'faits': []}
budget = float(sys.argv[1]) if len(sys.argv) > 1 else 140
t0 = time.time(); n = 0
for t in taches:
    cle = '|'.join(str(v) for v in t)
    if cle in etat['faits']: continue
    kind0 = t[0]
    dst0 = os.path.join(PH, t[1], (t[2] or '') + '.webp') if kind0 == 'ph' else os.path.join(FOR, t[1] + '.webp')
    if os.path.exists(dst0) and os.path.getsize(dst0) > 1000:
        etat['faits'].append(cle); json.dump(etat, open(ETAT, 'w')); continue
    if time.time() - t0 > budget: break
    kind = t[0]
    src = trouve(t[3])
    if not src: print('  absent :', t[3]); etat['faits'].append(cle); continue
    alpha = trouve(t[4]) if t[4] else None
    dst = os.path.join(PH, t[1], t[2] + '.webp') if kind == 'ph' else os.path.join(FOR, t[1] + '.webp')
    try:
        o = conv(src, dst, t[5], alpha)
        print('  %-46s %6.0f Ko' % (dst.split('03_textures/')[1], o / 1024))
        etat['faits'].append(cle); n += 1; json.dump(etat, open(ETAT, 'w'))
    except Exception as e:
        print('  ECHEC', t[3], e)
        etat['faits'].append(cle); json.dump(etat, open(ETAT, 'w'))
json.dump(etat, open(ETAT, 'w'))
print('converties : %d — restantes : %d' % (n, len(taches) - len(etat['faits'])))
