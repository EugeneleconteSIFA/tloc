#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""lozere.json  →  lozere-apercu.svg (+ .png si Chrome est là) : le plan à faire valider.

Comme lille-preview.png pour Lille : c'est ce qu'on compare à une vraie carte AVANT de coder
quoi que ce soit. À gauche tout le monde de Lozère, à droite les trois cadrages proposés
(le Pouget, le lac de Villefort, la Garde-Guérin) à leur échelle.

Le dessin est fait UNE fois, en mètres du jeu, dans un <g> ; chaque vue l'appelle par <use>
dans son propre viewBox. Les traits sont donc à leur vraie largeur (une départementale fait
6 m) et grossissent naturellement dans les vignettes ; seuls les noms sont posés par vue,
pour garder une taille lisible.

    python3 apercu-lozere.py
"""
import json, os, subprocess, shutil, html

ICI = os.path.dirname(os.path.abspath(__file__))
L = json.load(open(os.path.join(ICI, 'lozere.json')))
SVG = os.path.join(ICI, 'lozere-apercu.svg')
PNG = os.path.join(ICI, 'lozere-apercu.png')

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

# ---- le relief, en ombrage, s'il a été récolté (recolter-relief-lozere.py) ----
# Posé en « multiply » par-dessus le plan, une zone par vue (la plus fine qui la couvre) :
# deux ombrages empilés en multiply noirciraient le Pouget. Le test : si une vallée de l'ombrage ne tombe pas sous
# l'Altier ou sous le lac, c'est que le repère du relief et celui du plan divergent —
# c'est précisément ce que cet aperçu doit montrer avant qu'on cuise quoi que ce soit.
def png_gris(w, h, octets):
    """Un PNG en niveaux de gris, bibliothèque standard seule (pas de Pillow à installer)."""
    import zlib, struct
    brut = b''.join(b'\x00' + octets[j * w:(j + 1) * w] for j in range(h))
    def bloc(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + bloc(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0))
            + bloc(b'IDAT', zlib.compress(brut, 9)) + bloc(b'IEND', b''))

def ombrage(nom):
    import math, base64
    f = os.path.join(ICI, 'relief-lozere-%s.json' % nom)
    if not os.path.exists(f): return ''
    R_ = json.load(open(f))
    nx, nz, pas, h = R_['nx'], R_['nz'], R_['pas'], R_['h']
    # soleil au nord-ouest, à 45° : la convention des cartes, sinon le relief paraît inversé
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
    print('ombrage %-7s %d × %d au pas de %g m, de %.0f à %.0f m' % (nom, nx, nz, pas, R_['min'], R_['max']))
    # Les nœuds de la grille sont des CENTRES de pixels : l'image déborde d'un demi-pas.
    return ('<image x="%.1f" y="%.1f" width="%.1f" height="%.1f" preserveAspectRatio="none" '
            'style="mix-blend-mode:multiply" opacity="0.7" href="data:image/png;base64,%s"/>\n'
            % (R_['x0'] - pas / 2, R_['z0'] - pas / 2, nx * pas, nz * pas, b64))

OMB = {z: ombrage(z) for z in ('monde', 'lac', 'pouget', 'garde')}
P.append(chemin(L['falaises'], False, fill='none', stroke='#8a7f72', stroke_width=3, stroke_dasharray='2 3'))
E = L['eau']
P.append(chemin([c for c in E['cours'] if c.get('k') == 'ruisseau' and not c.get('tunnel')], False, fill='none', stroke='#7fb2d6', stroke_width=2))
P.append(chemin([c for c in E['cours'] if c.get('k') == 'riviere' and not c.get('tunnel')], False, fill='none', stroke='#6aa5d0', stroke_width=8, stroke_linejoin='round'))
P.append(chemin(E['canaux'], False, fill='none', stroke='#7fb2d6', stroke_width=1.2, stroke_dasharray='4 3'))
P.append(chemin(E['plans'], True, fill='#a9cfe9', stroke='#6aa5d0', stroke_width=2))
P.append(chemin(E['barrages'], False, fill='none', stroke='#555', stroke_width=7))
R = L['routes']; C = L['chemins']
LARG = {3: 7, 2: 5, 1: 3.5}
for r in (1, 2, 3):
    P.append(chemin([e for e in R if e['r'] == r and not e.get('tunnel')], False, fill='none', stroke='#8d8478', stroke_width=LARG[r] + 1.6, stroke_linecap='round', stroke_linejoin='round'))
for r in (1, 2, 3):
    P.append(chemin([e for e in R if e['r'] == r and not e.get('tunnel')], False, fill='none', stroke='#fffaf0' if r < 3 else '#f7d58a', stroke_width=LARG[r], stroke_linecap='round', stroke_linejoin='round'))
P.append(chemin([e for e in C if e['r'] == 1], False, fill='none', stroke='#9b7b52', stroke_width=2.2, stroke_dasharray='6 3'))
P.append(chemin([e for e in C if e['r'] == 0 and e.get('k') != 'via_ferrata'], False, fill='none', stroke='#9b7b52', stroke_width=1.2, stroke_dasharray='3 2'))
P.append(chemin(L['regordane'], False, fill='none', stroke='#c0392b', stroke_width=3, stroke_dasharray='10 5', stroke_opacity=0.85))
F = L['fer']
P.append(chemin([v for v in F['voies'] if v.get('tunnel')], False, fill='none', stroke='#333', stroke_width=2.5, stroke_dasharray='3 6'))
P.append(chemin([v for v in F['voies'] if not v.get('tunnel')], False, fill='none', stroke='#333', stroke_width=4.5))
P.append(chemin([v for v in F['voies'] if not v.get('tunnel') and not v.get('triage')], False, fill='none', stroke='#fff', stroke_width=2, stroke_dasharray='12 12'))
P.append(chemin([v for v in F['voies'] if v.get('pont') == 'viaduc'], False, fill='none', stroke='#7a1f1f', stroke_width=7, stroke_opacity=0.6))
P.append(chemin(F['quais'], True, fill='#bbb'))
P.append(chemin(L['murs'], False, fill='none', stroke='#6b5d4f', stroke_width=1))
P.append(chemin(L['batiments'], True, fill='#8c6f5a', stroke='#4d3b2e', stroke_width=0.4))
G = L['garde']
P.append(chemin(G['enceinte'], False, fill='none', stroke='#7a1f1f', stroke_width=2.5))
P.append(chemin(G['chateau'] + G['eglise'], True, fill='none', stroke='#7a1f1f', stroke_width=0.8))
P.append(chemin(G['tour'], True, fill='#7a1f1f'))

# ---- les vues -----------------------------------------------------------------------
xs = [c['x0'] for c in L['cadres']] + [c['x1'] for c in L['cadres']]
zs = [c['z0'] for c in L['cadres']] + [c['z1'] for c in L['cadres']]
TOUT = {'x0': min(xs) - 60, 'x1': max(xs) + 60, 'z0': min(zs) - 60, 'z1': max(zs) + 60}

W_TOT, H_TOT = 2400, 1560
MARGE_HAUT = 70
GAUCHE = (20, MARGE_HAUT, 1460, H_TOT - MARGE_HAUT - 20)
DROITE_X, DROITE_W = 1500, 880

def vue(box, x, y, w, h, titre, lieux_k, taille_txt, cadrages=False, grille=0, relief='monde'):
    bw, bh = box['x1'] - box['x0'], box['z1'] - box['z0']
    s = min(w / bw, h / bh)
    pw, ph = bw * s, bh * s
    fs = taille_txt / s              # taille des noms en mètres pour cette échelle
    o = ['<g>',
         '<text x="%.0f" y="%.0f" font-size="22" font-weight="600" fill="#2b2b2b">%s</text>' % (x, y - 10, html.escape(titre)),
         '<svg x="%.0f" y="%.0f" width="%.0f" height="%.0f" viewBox="%.1f %.1f %.1f %.1f">' % (x, y, pw, ph, box['x0'], box['z0'], bw, bh),
         '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#f4f1e8"/>' % (box['x0'], box['z0'], bw, bh)]
    if grille:
        import math
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
    # l'origine du jeu
    o.append('<g stroke="#c0392b" stroke-width="%.2f"><path d="M%.1f 0H%.1fM0 %.1fV%.1f"/></g>' % (1.5 / s, -8 / s, 8 / s, -8 / s, 8 / s))
    for l in L['lieux']:
        if l['k'] not in lieux_k or not l.get('nom'): continue
        if not (box['x0'] <= l['x'] <= box['x1'] and box['z0'] <= l['z'] <= box['z1']): continue
        gras = l['k'] in ('village', 'hamlet', 'eglise', 'chateau', 'tour', 'gare', 'barrage')
        o.append('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="#222"/>' % (l['x'], l['z'], 2.5 / s))
        o.append('<text x="%.1f" y="%.1f" font-size="%.1f" %s fill="#1a1a1a" stroke="#f4f1e8" stroke-width="%.2f" paint-order="stroke">%s</text>'
                 % (l['x'] + 5 / s, l['z'] - 4 / s, fs * (1.15 if gras else 0.9), 'font-weight="700"' if gras else '', 3 / s, html.escape(('Gare de ' if l['k'] == 'gare' else '') + l['nom'])))
    # échelle : une barre ronde (100, 200, 500 m ou 1 km) proche du quart de la vue
    pas = min((100, 200, 500, 1000), key=lambda v: abs(v * s - pw / 4))
    bx, bz = box['x0'] + 15 / s, box['z1'] - 18 / s
    o.append('<path d="M%.1f %.1fh%d" stroke="#222" stroke-width="%.2f"/>' % (bx, bz, pas, 4 / s))
    o.append('<text x="%.1f" y="%.1f" font-size="%.1f" fill="#222">%s</text>' % (bx, bz - 7 / s, 13 / s, '%d m' % pas if pas < 1000 else '1 km'))
    o.append('</svg>')
    o.append('<rect x="%.0f" y="%.0f" width="%.0f" height="%.0f" fill="none" stroke="#555"/>' % (x, y, pw, ph))
    o.append('</g>')
    return '\n'.join(o), ph

LIEUX_LARGES = {'village', 'hamlet', 'gare', 'barrage', 'sommet', 'isolated_dwelling', 'chateau'}
LIEUX_TOUS = LIEUX_LARGES | {'locality', 'quarter', 'neighbourhood', 'eglise', 'tour', 'four', 'source', 'batiment'}

corps = []
v, _ = vue(TOUT, *GAUCHE, 'Le monde de Lozère — 1 unité = 1 m, origine (+) au Pouget, x est, z sud ; grille de 500 m',
           LIEUX_LARGES, 13, cadrages=True, grille=500)
corps.append(v)
y = MARGE_HAUT
for k in ('pouget', 'lac', 'garde'):
    c = L['cadrages'][k]
    h = (H_TOT - MARGE_HAUT - 20 - 2 * 50) / 3
    v, ph = vue(c, DROITE_X, y, DROITE_W, h, '%s — %d × %d m' % (c['nom'], c['x1'] - c['x0'], c['z1'] - c['z0']),
                LIEUX_TOUS, 13, grille=100 if k != 'lac' else 500, relief=k)
    corps.append(v)
    y += h + 50

legende = [('#8c6f5a', 'bâti'), ('#a9cfe9', 'eau'), ('#b9cf9c', 'bois'), ('#d9d6b0', 'landes'),
           ('#f7d58a', 'route principale'), ('#333', 'voie ferrée (pointillé : tunnel)'),
           ('#c0392b', 'Régordane'), ('#7a1f1f', 'la Garde-Guérin')]
leg = ''.join('<rect x="%d" y="18" width="18" height="12" fill="%s"/><text x="%d" y="29" font-size="14" fill="#333">%s</text>'
              % (20 + i * 230, col, 44 + i * 230, html.escape(t)) for i, (col, t) in enumerate(legende))

svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="%d" height="%d" '
       'viewBox="0 0 %d %d" font-family="Helvetica, Arial, sans-serif">\n'
       '<rect width="100%%" height="100%%" fill="#fbfaf6"/>\n'
       '<defs><g id="plan">\n%s</g></defs>\n%s\n%s\n'
       '<text x="%d" y="%d" font-size="12" fill="#888" text-anchor="end">© OpenStreetMap et contributeurs (ODbL)</text>\n</svg>\n'
       % (W_TOT, H_TOT, W_TOT, H_TOT, ''.join(P), leg, '\n'.join(corps), W_TOT - 20, H_TOT - 6))
open(SVG, 'w').write(svg)
print('lozere-apercu.svg : %.0f Ko' % (os.path.getsize(SVG) / 1024))

# Le PNG par Chrome sans tête : pas de dépendance Python à installer.
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if os.path.exists(CHROME):
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--screenshot=' + PNG,
                    '--window-size=%d,%d' % (W_TOT, H_TOT), 'file://' + SVG],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    if os.path.exists(PNG): print('lozere-apercu.png : %.0f Ko' % (os.path.getsize(PNG) / 1024))
