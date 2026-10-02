#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""aveyron.json  →  aveyron-apercu.svg (+ .png si Chrome est là) : le plan à faire valider.

Copie d'apercu-lozere.py : le plan est dessiné UNE fois, en mètres du jeu, et chaque vue
l'appelle par <use> dans son viewBox. Le monde fait 5 km sur 1,3 : il prend toute la largeur
en haut ; dessous, les deux cadrages (le lac, le bourg de Saint-Symphorien) à leur échelle.

Les lieux posés à la main (les maisons Roquette, le duel, la source, le Dormeur — absents
d'OSM, validés par Eugène le 1er octobre) sont dessinés en orange, pour qu'on les voie et les déplace.

    python3 apercu-aveyron.py
"""
import json, os, subprocess, html, math

ICI = os.path.dirname(os.path.abspath(__file__))
L = json.load(open(os.path.join(ICI, 'aveyron.json')))
SVG = os.path.join(ICI, 'aveyron-apercu.svg')
PNG = os.path.join(ICI, 'aveyron-apercu.png')

def d_poly(p, ferme=True):
    s = 'M' + 'L'.join('%.1f %.1f' % (q[0], q[1]) for q in p)
    return s + ('Z' if ferme else '')

def chemin(items, ferme, **att):
    if not items: return ''
    d = ''.join(d_poly(e['pts'], ferme) for e in items if e.get('pts'))
    a = ' '.join('%s="%s"' % (k.replace('_', '-'), v) for k, v in att.items())
    return '<path d="%s" %s/>\n' % (d, a)

# ---- le plan, en mètres -------------------------------------------------------------
P = []
V = L['verdure']
P.append(chemin(V['landes'], True, fill='#d9d6b0'))
P.append(chemin(V['pres'], True, fill='#e3ebc4'))
P.append(chemin(V['bois'], True, fill='#b9cf9c'))
P.append(chemin(V['jardins'], True, fill='#cfe0b4'))
P.append(chemin(V['rochers'], True, fill='#cfc9c0'))

# ---- le relief, en ombrage (recolter-relief-aveyron.py) ----
# Même test qu'en Lozère : une vallée de l'ombrage doit tomber sous le ruisseau des Vergnes
# et sous le lac. Sinon, le repère du relief et celui du plan divergent.
def png_gris(w, h, octets):
    """Un PNG en niveaux de gris, bibliothèque standard seule."""
    import zlib, struct
    brut = b''.join(b'\x00' + octets[j * w:(j + 1) * w] for j in range(h))
    def bloc(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + bloc(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0))
            + bloc(b'IDAT', zlib.compress(brut, 9)) + bloc(b'IEND', b''))

def ombrage(nom):
    import base64
    f = os.path.join(ICI, 'relief-aveyron-%s.json' % nom)
    if not os.path.exists(f): return ''
    R_ = json.load(open(f))
    nx, nz, pas, h = R_['nx'], R_['nz'], R_['pas'], R_['h']
    # soleil au nord-ouest, à 45° : la convention des cartes
    az, el = math.radians(315), math.radians(45)
    lx, lz, ly = math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)
    out = bytearray(nx * nz)
    for j in range(nz):
        for i in range(nx):
            a = h[j * nx + max(i - 1, 0)]; b = h[j * nx + min(i + 1, nx - 1)]
            c = h[max(j - 1, 0) * nx + i]; d = h[min(j + 1, nz - 1) * nx + i]
            gx, gz = (b - a) / (2 * pas), (d - c) / (2 * pas)
            n = math.sqrt(gx * gx + gz * gz + 1)
            v = (-gx * lx - gz * lz + ly) / n
            out[j * nx + i] = max(0, min(255, int(255 * (0.35 + 0.65 * v))))
    b64 = base64.b64encode(png_gris(nx, nz, bytes(out))).decode()
    print('ombrage %-6s %d × %d au pas de %g m, de %.0f à %.0f m' % (nom, nx, nz, pas, R_['min'], R_['max']))
    return ('<image x="%.1f" y="%.1f" width="%.1f" height="%.1f" preserveAspectRatio="none" '
            'style="mix-blend-mode:multiply" opacity="0.7" href="data:image/png;base64,%s"/>\n'
            % (R_['x0'] - pas / 2, R_['z0'] - pas / 2, nx * pas, nz * pas, b64))

OMB = {z: ombrage(z) for z in ('monde', 'lac', 'bourg')}
P.append(chemin(L['falaises'], False, fill='none', stroke='#8a7f72', stroke_width=3, stroke_dasharray='2 3'))
E = L['eau']
P.append(chemin([c for c in E['cours'] if not c.get('tunnel')], False, fill='none', stroke='#7fb2d6', stroke_width=2.5))
P.append(chemin(E['canaux'], False, fill='none', stroke='#7fb2d6', stroke_width=1.2, stroke_dasharray='4 3'))
P.append(chemin(E['plans'], True, fill='#a9cfe9', stroke='#6aa5d0', stroke_width=2))
P.append(chemin(E['baignade'], True, fill='none', stroke='#2f7fb8', stroke_width=1.5, stroke_dasharray='4 3'))
P.append(chemin(E['barrages'], False, fill='none', stroke='#555', stroke_width=7))
R = L['routes']; C = L['chemins']
LARG = {3: 7, 2: 5, 1: 3.5}
for r in (1, 2, 3):
    P.append(chemin([e for e in R if e['r'] == r and not e.get('tunnel')], False, fill='none', stroke='#8d8478', stroke_width=LARG[r] + 1.6, stroke_linecap='round', stroke_linejoin='round'))
for r in (1, 2, 3):
    P.append(chemin([e for e in R if e['r'] == r and not e.get('tunnel')], False, fill='none', stroke='#fffaf0' if r < 3 else '#f7d58a', stroke_width=LARG[r], stroke_linecap='round', stroke_linejoin='round'))
P.append(chemin([e for e in C if e['r'] == 1], False, fill='none', stroke='#9b7b52', stroke_width=2.2, stroke_dasharray='6 3'))
P.append(chemin([e for e in C if e['r'] == 0], False, fill='none', stroke='#9b7b52', stroke_width=1.2, stroke_dasharray='3 2'))
P.append(chemin(L['ponts'], False, fill='none', stroke='#6b5d4f', stroke_width=2.5))
P.append(chemin(L['murs'], False, fill='none', stroke='#6b5d4f', stroke_width=1))
P.append(chemin(L['batiments'], True, fill='#8c6f5a', stroke='#4d3b2e', stroke_width=0.4))

# ---- les vues -----------------------------------------------------------------------
xs = [c['x0'] for c in L['cadres']] + [c['x1'] for c in L['cadres']]
zs = [c['z0'] for c in L['cadres']] + [c['z1'] for c in L['cadres']]
# les cadrages débordent des extraits (250 m de rive autour du lac) : la vue les englobe
xs += [c['x0'] for c in L['cadrages'].values()] + [c['x1'] for c in L['cadrages'].values()]
zs += [c['z0'] for c in L['cadrages'].values()] + [c['z1'] for c in L['cadrages'].values()]
TOUT = {'x0': min(xs) - 60, 'x1': max(xs) + 60, 'z0': min(zs) - 60, 'z1': max(zs) + 60}

W_TOT, H_TOT = 2400, 1820
MARGE_HAUT = 70

def vue(box, x, y, w, h, titre, lieux_k, taille_txt, cadrages=False, grille=0, relief='monde'):
    bw, bh = box['x1'] - box['x0'], box['z1'] - box['z0']
    s = min(w / bw, h / bh)
    pw, ph = bw * s, bh * s
    fs = taille_txt / s
    o = ['<g>',
         '<text x="%.0f" y="%.0f" font-size="22" font-weight="600" fill="#2b2b2b">%s</text>' % (x, y - 10, html.escape(titre)),
         '<svg x="%.0f" y="%.0f" width="%.0f" height="%.0f" viewBox="%.1f %.1f %.1f %.1f">' % (x, y, pw, ph, box['x0'], box['z0'], bw, bh),
         '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#f4f1e8"/>' % (box['x0'], box['z0'], bw, bh)]
    if grille:
        g = []
        for gx in range(int(math.ceil(box['x0'] / grille)) * grille, int(box['x1']) + 1, grille):
            g.append('M%d %.0fV%.0f' % (gx, box['z0'], box['z1']))
            o.append('<text x="%d" y="%.0f" font-size="%.0f" fill="#999">%d</text>' % (gx + 8 / s, box['z0'] + 16 / s, 11 / s, gx))
        for gz in range(int(math.ceil(box['z0'] / grille)) * grille, int(box['z1']) + 1, grille):
            g.append('M%.0f %dH%.0f' % (box['x0'], gz, box['x1']))
            o.append('<text x="%.0f" y="%d" font-size="%.0f" fill="#999">%d</text>' % (box['x0'] + 4 / s, gz - 4 / s, 11 / s, gz))
        o.insert(4, '<path d="%s" stroke="#d9d3c4" stroke-width="%.2f" fill="none"/>' % (''.join(g), 1 / s))
    o.append('<use href="#plan"/>')
    o.append(OMB.get(relief) or OMB.get('monde', ''))
    for c in L['cadres']:
        o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#aaa" stroke-width="%.2f" stroke-dasharray="%.1f %.1f"/>'
                 % (c['x0'], c['z0'], c['x1'] - c['x0'], c['z1'] - c['z0'], 1 / s, 4 / s, 4 / s))
    if cadrages:
        for k, c in L['cadrages'].items():
            o.append('<rect x="%d" y="%d" width="%d" height="%d" fill="none" stroke="#c0392b" stroke-width="%.2f"/>'
                     % (c['x0'], c['z0'], c['x1'] - c['x0'], c['z1'] - c['z0'], 2.5 / s))
            o.append('<text x="%d" y="%.0f" font-size="%.0f" font-weight="700" fill="#c0392b">%s</text>'
                     % (c['x0'], c['z0'] - 5 / s, 14 / s, html.escape(c['nom'])))
        # le trou entre les deux extraits : rien n'y est cartographié, le dire sur le plan
        a, b = L['cadres'][0], L['cadres'][1]
        o.append('<text x="%.0f" y="%.0f" font-size="%.0f" fill="#999" text-anchor="middle">— %.1f km sans plan OSM —</text>'
                 % ((a['x1'] + b['x0']) / 2, (b['z0'] + b['z1']) / 2, 16 / s, (b['x0'] - a['x1']) / 1000))
    o.append('<g stroke="#c0392b" stroke-width="%.2f"><path d="M%.1f 0H%.1fM0 %.1fV%.1f"/></g>' % (1.5 / s, -8 / s, 8 / s, -8 / s, 8 / s))
    for l in L['lieux']:
        if not (box['x0'] <= l['x'] <= box['x1'] and box['z0'] <= l['z'] <= box['z1']): continue
        if l.get('pose'):
            # posé à la main : gros, orange, impossible à confondre avec un lieu d'OSM
            if l.get('zone'):
                zz = l['zone']
                o.append('<path d="%s" fill="#e67e22" fill-opacity="0.18" stroke="#e67e22" stroke-width="%.2f" stroke-dasharray="%.1f %.1f"/>'
                         % (d_poly(zz), 2 / s, 6 / s, 4 / s))
            o.append('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="#e67e22" stroke="#7a3d00" stroke-width="%.2f"/>' % (l['x'], l['z'], 7 / s, 1.5 / s))
            o.append('<text x="%.1f" y="%.1f" font-size="%.1f" font-weight="700" fill="#a04000" stroke="#fff" stroke-width="%.2f" paint-order="stroke">%s</text>'
                     % (l['x'] + 10 / s, l['z'] + 5 / s, fs * 1.25, 3.5 / s, html.escape(l['nom'])))
            continue
        if l['k'] not in lieux_k: continue
        nom = l.get('nom') or {'croix': '✝', 'fontaine': 'fontaine', 'ecole': 'école', 'reservoir': 'réservoir',
                               'monument': 'monument aux morts', 'seuil': 'seuil'}.get(l['k'])
        if not nom: continue
        gras = l['k'] in ('village', 'eglise', 'barrage', 'mairie')
        o.append('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="#222"/>' % (l['x'], l['z'], 2.5 / s))
        o.append('<text x="%.1f" y="%.1f" font-size="%.1f" %s fill="#1a1a1a" stroke="#f4f1e8" stroke-width="%.2f" paint-order="stroke">%s</text>'
                 % (l['x'] + 5 / s, l['z'] - 4 / s, fs * (1.15 if gras else 0.9), 'font-weight="700"' if gras else '', 3 / s, html.escape(nom)))
    pas = min((100, 200, 500, 1000), key=lambda v: abs(v * s - pw / 4))
    bx, bz = box['x0'] + 15 / s, box['z1'] - 18 / s
    o.append('<path d="M%.1f %.1fh%d" stroke="#222" stroke-width="%.2f"/>' % (bx, bz, pas, 4 / s))
    o.append('<text x="%.1f" y="%.1f" font-size="%.1f" fill="#222">%s</text>' % (bx, bz - 7 / s, 13 / s, '%d m' % pas if pas < 1000 else '1 km'))
    o.append('</svg>')
    o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="none" stroke="#555"/>' % (x, y, pw, ph))
    o.append('</g>')
    return '\n'.join(o), ph

LIEUX_LARGES = {'village', 'hamlet', 'isolated_dwelling', 'locality', 'barrage', 'eglise'}
LIEUX_TOUS = LIEUX_LARGES | {'croix', 'fontaine', 'ecole', 'mairie', 'place', 'cimetiere', 'monument', 'reservoir', 'seuil'}

corps = []
v, ph = vue(TOUT, 20, MARGE_HAUT, W_TOT - 40, 640,
            "Le monde de l'Aveyron — 1 unité = 1 m, origine (+) au centre du lac de Saint-Gervais, x est, z sud ; grille de 500 m",
            LIEUX_LARGES, 12, cadrages=True, grille=500)
corps.append(v)
y = MARGE_HAUT + ph + 60
h = H_TOT - y - 30
c = L['cadrages']['lac']
v, _ = vue(c, 20, y, 1240, h, '%s — %d × %d m' % (c['nom'], c['x1'] - c['x0'], c['z1'] - c['z0']), LIEUX_TOUS, 13, grille=100, relief='lac')
corps.append(v)
c = L['cadrages']['bourg']
v, _ = vue(c, 1300, y, W_TOT - 1320, h, '%s — %d × %d m' % (c['nom'], c['x1'] - c['x0'], c['z1'] - c['z0']), LIEUX_TOUS, 13, grille=100, relief='bourg')
corps.append(v)

legende = [('#8c6f5a', 'bâti'), ('#a9cfe9', 'eau'), ('#b9cf9c', 'bois'), ('#e3ebc4', 'prés'),
           ('#f7d58a', 'route principale'), ('#9b7b52', 'chemin, sentier'), ('#e67e22', 'posé à la main (pas dans OSM), validé')]
leg = ''.join('<rect x="%d" y="18" width="18" height="12" fill="%s"/><text x="%d" y="29" font-size="14" fill="#333">%s</text>'
              % (20 + i * 250, col, 44 + i * 250, html.escape(t)) for i, (col, t) in enumerate(legende))

svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="%d" height="%d" '
       'viewBox="0 0 %d %d" font-family="Helvetica, Arial, sans-serif">\n'
       '<rect width="100%%" height="100%%" fill="#fbfaf6"/>\n'
       '<defs><g id="plan">\n%s</g></defs>\n%s\n%s\n'
       '<text x="%d" y="%d" font-size="12" fill="#888" text-anchor="end">© OpenStreetMap et contributeurs (ODbL)</text>\n</svg>\n'
       % (W_TOT, H_TOT, W_TOT, H_TOT, ''.join(P), leg, '\n'.join(corps), W_TOT - 20, H_TOT - 6))
open(SVG, 'w').write(svg)
print('aveyron-apercu.svg : %.0f Ko' % (os.path.getsize(SVG) / 1024))

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if os.path.exists(CHROME):
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--screenshot=' + PNG,
                    '--window-size=%d,%d' % (W_TOT, H_TOT), 'file://' + SVG],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    if os.path.exists(PNG): print('aveyron-apercu.png : %.0f Ko' % (os.path.getsize(PNG) / 1024))

# ---- les environs : où se couche le Dormeur ---------------------------------------------
# Le monde (5 × 1,4 km) est un plateau doux : aucune falaise pour le géant couché. Les environs
# (relief-aveyron-environs.json, 14 × 12 km au pas de 50 m) montrent la vallée profonde qui
# longe le lac au nord-ouest ; on y dessine les pentes de plus de 33° et les candidats.
DORMEUR = [  # (nom, x, z, note) — mesurés le 2 octobre sur les environs ; à valider par Eugène
    ('A — le mur de l’ouest', -2592, -501, '1,1 km nord-sud, 400 m de haut (300 → 700 m), 2,6 km à l’ouest du lac'),
    ('B — l’escarpement du nord', 562, -3174, '1,7 km, 235 m de haut, 3,2 km au nord du lac'),
]
F_ENV = os.path.join(ICI, 'relief-aveyron-environs.json')
if os.path.exists(F_ENV):
    E_ = json.load(open(F_ENV))
    nx, nz, pas, hh = E_['nx'], E_['nz'], E_['pas'], E_['h']
    s = 3.0 / pas                     # 3 px par maille
    W2, H2 = int(nx * pas * s) + 40, int(nz * pas * s) + 90
    rects = []
    for j in range(1, nz - 1):
        for i in range(1, nx - 1):
            gx = (hh[j * nx + i + 1] - hh[j * nx + i - 1]) / (2 * pas)
            gz = (hh[(j + 1) * nx + i] - hh[(j - 1) * nx + i]) / (2 * pas)
            if math.degrees(math.atan(math.hypot(gx, gz))) > 33:
                rects.append('M%.0f %.0fh%gv%gh-%gz' % (E_['x0'] + i * pas - pas / 2, E_['z0'] + j * pas - pas / 2, pas, pas, pas))
    bx = (E_['x0'] - pas / 2, E_['z0'] - pas / 2, nx * pas, nz * pas)
    o = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="Helvetica, Arial, sans-serif">' % (W2, H2),
         '<rect width="100%" height="100%" fill="#fbfaf6"/>',
         '<text x="20" y="34" font-size="20" font-weight="600" fill="#2b2b2b">Les environs du lac (14 × 12 km, relief IGN au pas de 50 m) — où coucher le Dormeur ?</text>',
         '<text x="20" y="58" font-size="14" fill="#555">en rouge : pentes de plus de 33° ; en orange : les deux candidats ; cadres gris : les extraits OSM ; grille de 1 km</text>',
         '<svg x="20" y="70" width="%.0f" height="%.0f" viewBox="%.1f %.1f %.1f %.1f">' % ((nx * pas * s, nz * pas * s) + bx),
         '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#f4f1e8"/>' % bx,
         ombrage('environs').replace('opacity="0.7"', 'opacity="1"'),
         '<path d="%s" fill="#c0392b" fill-opacity="0.55"/>' % ''.join(rects)]
    g = ''.join('M%d %.0fV%.0f' % (v, bx[1], bx[1] + bx[3]) for v in range(-6000, 8001, 1000))
    g += ''.join('M%.0f %dH%.0f' % (bx[0], v, bx[0] + bx[2]) for v in range(-6000, 6001, 1000))
    o.append('<path d="%s" stroke="#777" stroke-opacity="0.5" stroke-width="%.1f" fill="none"/>' % (g, 1 / s))
    for c in L['cadres']:
        o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="none" stroke="#333" stroke-width="%.1f"/>' % (c['x0'], c['z0'], c['x1'] - c['x0'], c['z1'] - c['z0'], 2 / s))
    o.append(chemin(L['eau']['plans'], True, fill='#a9cfe9', stroke='#2f7fb8', stroke_width=1.5 / s))
    for l in L['lieux']:
        if l.get('pose') and l['k'] in ('maison', 'dormeur'):
            o.append('<circle cx="%.0f" cy="%.0f" r="%.0f" fill="#555"/>' % (l['x'], l['z'], 3 / s))
    for nom, x, z, note in DORMEUR:
        o.append('<circle cx="%d" cy="%d" r="%.0f" fill="none" stroke="#e67e22" stroke-width="%.1f"/>' % (x, z, 700, 4 / s))
        o.append('<text x="%d" y="%d" font-size="%.0f" font-weight="700" fill="#a04000" stroke="#fff" stroke-width="%.1f" paint-order="stroke">%s</text>'
                 % (x + 720, z - 40, 15 / s, 4 / s, html.escape(nom)))
        o.append('<text x="%d" y="%d" font-size="%.0f" fill="#333" stroke="#fff" stroke-width="%.1f" paint-order="stroke">%s</text>'
                 % (x + 720, z + 230, 12 / s, 3 / s, html.escape(note)))
    o.append('<text x="%d" y="%d" font-size="%.0f" fill="#333" stroke="#fff" stroke-width="%.1f" paint-order="stroke">lac de Saint-Gervais</text>' % (250, 120, 12 / s, 3 / s))
    o += ['</svg>', '</svg>']
    SV2, PN2 = os.path.join(ICI, 'aveyron-environs.svg'), os.path.join(ICI, 'aveyron-environs.png')
    open(SV2, 'w').write('\n'.join(o))
    if os.path.exists(CHROME):
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--screenshot=' + PN2,
                        '--window-size=%d,%d' % (W2, H2), 'file://' + SV2], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        print('aveyron-environs.png : %.0f Ko' % (os.path.getsize(PN2) / 1024))
