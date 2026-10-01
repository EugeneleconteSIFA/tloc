#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""matera.json, alberobello.json, gallipoli.json  →  pouilles-apercu.svg (+ .png) : la planche.

Les trois villes l'une sous l'autre, À LA MÊME ÉCHELLE (chacune dans son repère, origine (+)
à son centre historique) : on voit d'un coup d'œil qu'Alberobello est un tapis de trulli,
Matera un lacis d'escaliers au bord de la Gravina, Gallipoli une île. Comme apercu-lozere.py,
le plan de chaque ville est dessiné une fois en mètres du jeu et posé dans son viewBox.

    python3 apercu-pouilles.py
"""
import json, os, subprocess, html, math

ICI = os.path.dirname(os.path.abspath(__file__))
VILLES = ('matera', 'alberobello', 'gallipoli')
SVG = os.path.join(ICI, 'pouilles-apercu.svg')
PNG = os.path.join(ICI, 'pouilles-apercu.png')
TITRES = {'matera': 'Matera — les Sassi, la Gravina', 'alberobello': 'Alberobello — les trulli',
          'gallipoli': 'Gallipoli — la vieille ville sur son île'}

def d_poly(p, ferme=True):
    s = 'M' + 'L'.join('%.1f %.1f' % (q[0], q[1]) for q in p)
    return s + ('Z' if ferme else '')

def chemin(items, ferme, **att):
    items = [e if isinstance(e, dict) else {'pts': e} for e in items]
    if not items: return ''
    d = ''.join(d_poly(e['pts'], ferme) for e in items if e.get('pts'))
    a = ' '.join('%s="%s"' % (k.replace('_', '-'), v) for k, v in att.items())
    return '<path d="%s" %s/>\n' % (d, a)

def png_gris(w, h, octets):
    """Un PNG en niveaux de gris, bibliothèque standard seule."""
    import zlib, struct
    brut = b''.join(b'\x00' + octets[j * w:(j + 1) * w] for j in range(h))
    def bloc(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + bloc(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0))
            + bloc(b'IDAT', zlib.compress(brut, 9)) + bloc(b'IEND', b''))

def ombrage(ville):
    """Le relief (recolter-relief-pouilles.py, pas encore récolté) : même test qu'en Lozère —
    à Matera, la vallée de l'ombrage doit tomber sous la Gravina, pas à côté."""
    import base64
    f = os.path.join(ICI, 'relief-pouilles-%s.json' % ville)
    if not os.path.exists(f): return ''
    R_ = json.load(open(f))
    nx, nz, pas, h = R_['nx'], R_['nz'], R_['pas'], R_['h']
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
    print('ombrage %-11s %d × %d au pas de %g m, de %.0f à %.0f m' % (ville, nx, nz, pas, R_['min'], R_['max']))
    return ('<image x="%.1f" y="%.1f" width="%.1f" height="%.1f" preserveAspectRatio="none" '
            'style="mix-blend-mode:multiply" opacity="0.7" href="data:image/png;base64,%s"/>\n'
            % (R_['x0'] - pas / 2, R_['z0'] - pas / 2, nx * pas, nz * pas, b64))

MER, TERRE = '#9cc8e4', '#f4f1e8'

def plan(L):
    P = []
    c = L['cadre']
    box = (c['x0'] - 60, c['z0'] - 60, c['x1'] - c['x0'] + 120, c['z1'] - c['z0'] + 120)
    if L['cote']['terre']:
        # Gallipoli : le fond est la mer, la terre est posée dessus
        P.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (box + (MER,)))
        P.append(chemin(L['cote']['terre'], True, fill=TERRE, stroke='#5f8fb0', stroke_width=1.5))
    V = L['verdure']
    P.append(chemin(V['champs'], True, fill='#ece6c4'))
    P.append(chemin(V['landes'], True, fill='#d9d6b0'))
    P.append(chemin(V['pres'], True, fill='#e3ebc4'))
    P.append(chemin(V['bois'], True, fill='#b9cf9c'))
    P.append(chemin(V['jardins'], True, fill='#cfe0b4'))
    P.append(chemin(V['rochers'], True, fill='#cfc9c0'))
    E = L['eau']
    P.append(chemin(E['recifs'], True, fill='#7fb0cf', stroke='#4f87ad', stroke_width=0.8))
    P.append(chemin(E['plans'], True, fill='#a9cfe9', stroke='#6aa5d0', stroke_width=1))
    P.append(chemin(E['cours'], False, fill='none', stroke='#5a9fd0', stroke_width=4, stroke_linejoin='round'))
    P.append(chemin(E['canaux'], False, fill='none', stroke='#7fb2d6', stroke_width=1.2, stroke_dasharray='4 3'))
    P.append(chemin(L['falaises'], False, fill='none', stroke='#8a5a3a', stroke_width=3, stroke_dasharray='2 3'))
    R = L['routes']
    LARG = {3: 8, 2: 5.5, 1: 3.5}
    P.append(chemin([e for e in R if e.get('surface')], True, fill='#fffaf0', stroke='#b8ad9c', stroke_width=0.5))
    lignes = [e for e in R if not e.get('surface') and not e.get('tunnel')]
    for r in (1, 2, 3):
        P.append(chemin([e for e in lignes if e['r'] == r], False, fill='none', stroke='#8d8478', stroke_width=LARG[r] + 1.6, stroke_linecap='round', stroke_linejoin='round'))
    for r in (1, 2, 3):
        P.append(chemin([e for e in lignes if e['r'] == r], False, fill='none', stroke='#fffaf0' if r < 3 else '#f7d58a', stroke_width=LARG[r], stroke_linecap='round', stroke_linejoin='round'))
    C = L['chemins']
    P.append(chemin([e for e in C if e.get('k') != 'steps'], False, fill='none', stroke='#9b7b52', stroke_width=1.3, stroke_dasharray='3 2'))
    P.append(chemin([e for e in C if e.get('k') == 'steps'], False, fill='none', stroke='#b0563a', stroke_width=2))
    P.append(chemin(L['ponts'], False, fill='none', stroke='#6b5d4f', stroke_width=3))
    F = L['fer']
    P.append(chemin([v for v in F['voies'] if v.get('tunnel')], False, fill='none', stroke='#333', stroke_width=2.5, stroke_dasharray='3 6'))
    P.append(chemin([v for v in F['voies'] if not v.get('tunnel')], False, fill='none', stroke='#333', stroke_width=4.5,
                    stroke_opacity=1))
    P.append(chemin([v for v in F['voies'] if not v.get('tunnel') and not v.get('triage') and not v.get('desaffectee')], False,
                    fill='none', stroke='#fff', stroke_width=2, stroke_dasharray='12 12'))
    P.append(chemin([v for v in F['voies'] if v.get('desaffectee')], False, fill='none', stroke='#999', stroke_width=2.5))
    P.append(chemin(F['quais'], True, fill='#bbb'))
    P.append(chemin(L['murs'], False, fill='none', stroke='#6b5d4f', stroke_width=0.8))
    B = L['batiments']
    P.append(chemin([b for b in B if b.get('k') not in ('trullo', 'church', 'cathedral', 'castle')], True, fill='#c9b79c', stroke='#7d6a52', stroke_width=0.3))
    P.append(chemin([b for b in B if b.get('k') == 'trullo'], True, fill='#8a8f96', stroke='#3d4248', stroke_width=0.4))
    P.append(chemin([b for b in B if b.get('k') in ('church', 'cathedral', 'castle')], True, fill='#8c5a4a', stroke='#4d2b20', stroke_width=0.5))
    P.append(chemin(L['enceinte'], False, fill='none', stroke='#7a1f1f', stroke_width=3))
    P.append(chemin(L['cote']['iles'], True, fill='none', stroke='#c0392b', stroke_width=1.5, stroke_dasharray='6 4'))
    return ''.join(P)

NOMMES = {'gare', 'eglise', 'eglise_rupestre', 'chateau', 'porte', 'belvedere', 'port', 'quartier', 'place', 'fontaine', 'ile', 'baie', 'sommet'}
GRAS = {'gare', 'chateau', 'porte', 'quartier', 'ile'}

W_TOT = 2400
MARGE_HAUT, ESPACE = 70, 70
Ls = {v: json.load(open(os.path.join(ICI, '%s.json' % v))) for v in VILLES}
# une seule échelle pour les trois : celle qui fait tenir la plus large
S = min((W_TOT - 40) / (L['cadre']['x1'] - L['cadre']['x0'] + 120) for L in Ls.values())
H_TOT = int(MARGE_HAUT + sum((L['cadre']['z1'] - L['cadre']['z0'] + 120) * S + ESPACE for L in Ls.values()) + 10)

defs, corps = [], []
y = MARGE_HAUT
for v in VILLES:
    L = Ls[v]
    c = L['cadre']
    box = {'x0': c['x0'] - 60, 'x1': c['x1'] + 60, 'z0': c['z0'] - 60, 'z1': c['z1'] + 60}
    bw, bh = box['x1'] - box['x0'], box['z1'] - box['z0']
    s = S
    defs.append('<g id="plan-%s">\n%s</g>' % (v, plan(L)))
    o = ['<text x="20" y="%.0f" font-size="22" font-weight="600" fill="#2b2b2b">%s — %d × %d m ; origine (+) : %s</text>'
         % (y - 12, html.escape(TITRES[v]), c['x1'] - c['x0'], c['z1'] - c['z0'], html.escape(L['origine']['lieu'])),
         '<svg x="20" y="%.0f" width="%.0f" height="%.0f" viewBox="%.1f %.1f %.1f %.1f">' % (y, bw * s, bh * s, box['x0'], box['z0'], bw, bh),
         '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (box['x0'], box['z0'], bw, bh, TERRE)]
    g = []
    for gx in range(int(math.ceil(box['x0'] / 250)) * 250, int(box['x1']) + 1, 250):
        g.append('M%d %.0fV%.0f' % (gx, box['z0'], box['z1']))
        o.append('<text x="%d" y="%.0f" font-size="%.0f" fill="#999">%d</text>' % (gx + 6 / s, box['z0'] + 14 / s, 11 / s, gx))
    for gz in range(int(math.ceil(box['z0'] / 250)) * 250, int(box['z1']) + 1, 250):
        g.append('M%.0f %dH%.0f' % (box['x0'], gz, box['x1']))
        o.append('<text x="%.0f" y="%d" font-size="%.0f" fill="#999">%d</text>' % (box['x0'] + 4 / s, gz - 4 / s, 11 / s, gz))
    o.append('<use href="#plan-%s"/>' % v)
    o.append('<path d="%s" stroke="#7f7a70" stroke-opacity="0.35" stroke-width="%.2f" fill="none"/>' % (''.join(g), 1 / s))
    o.append(ombrage(v))
    o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#888" stroke-width="%.2f" stroke-dasharray="%.1f %.1f"/>'
             % (c['x0'], c['z0'], c['x1'] - c['x0'], c['z1'] - c['z0'], 1.2 / s, 5 / s, 4 / s))
    o.append('<g stroke="#c0392b" stroke-width="%.2f"><path d="M%.1f 0H%.1fM0 %.1fV%.1f"/></g>' % (2 / s, -10 / s, 10 / s, -10 / s, 10 / s))
    fs = 12 / s
    for l in L['lieux']:
        if l['k'] not in NOMMES or not l.get('nom'): continue
        gare = l['k'] == 'gare'
        if gare and l.get('hors_cadre'):
            # la gare hors du cadre : on la montre au bord, avec sa distance
            x = min(max(l['x'], box['x0'] + 10 / s), box['x1'] - 10 / s); z = min(max(l['z'], box['z0'] + 10 / s), box['z1'] - 10 / s)
            o.append('<path d="M%.1f %.1fl%.1f %.1fl0 %.1fz" fill="#c0392b"/>' % (x, z, -14 / s, -8 / s, 16 / s))
            o.append('<text x="%.1f" y="%.1f" font-size="%.1f" font-weight="700" text-anchor="end" fill="#c0392b" stroke="#fff" stroke-width="%.2f" paint-order="stroke">Gare de %s → %s</text>'
                     % (x - 18 / s, z + 4 / s, fs * 1.2, 3 / s, html.escape(l['nom']), html.escape(l['note'])))
            continue
        col = '#c0392b' if gare or l.get('propose') else '#1a1a1a'
        r = (5 if gare else 2.5) / s
        o.append('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="%s"/>' % (l['x'], l['z'], r, col))
        o.append('<text x="%.1f" y="%.1f" font-size="%.1f" %s fill="%s" stroke="%s" stroke-width="%.2f" paint-order="stroke">%s</text>'
                 % (l['x'] + 5 / s, l['z'] - 4 / s, fs * (1.25 if l['k'] in GRAS else 0.85), 'font-weight="700"' if l['k'] in GRAS else '',
                    col, TERRE, 3 / s, html.escape(('Gare : ' if gare else '') + l['nom'] + (' ?' if l.get('propose') else ''))))
    bx, bz = box['x0'] + 15 / s, box['z1'] - 18 / s
    o.append('<path d="M%.1f %.1fh200" stroke="#222" stroke-width="%.2f"/>' % (bx, bz, 4 / s))
    o.append('<text x="%.1f" y="%.1f" font-size="%.1f" fill="#222">200 m</text>' % (bx, bz - 7 / s, 13 / s))
    o.append('</svg>')
    o.append('<rect x="20" y="%.0f" width="%.0f" height="%.0f" fill="none" stroke="#555"/>' % (y, bw * s, bh * s))
    corps.append('\n'.join(o))
    y += bh * s + ESPACE

legende = [('#c9b79c', 'bâti'), ('#8a8f96', 'trullo'), ('#8c5a4a', 'église, château'), ('#b0563a', 'escaliers'),
           ('#333', 'voie ferrée (pointillé : tunnel)'), ('#7a1f1f', 'remparts'), ('#9cc8e4', 'mer'), ('#c0392b', 'gare, origine')]
leg = ''.join('<rect x="%d" y="18" width="18" height="12" fill="%s"/><text x="%d" y="29" font-size="14" fill="#333">%s</text>'
              % (20 + i * 290, col, 44 + i * 290, html.escape(t)) for i, (col, t) in enumerate(legende))

svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="%d" height="%d" '
       'viewBox="0 0 %d %d" font-family="Helvetica, Arial, sans-serif">\n'
       '<rect width="100%%" height="100%%" fill="#fbfaf6"/>\n'
       '<defs>%s</defs>\n%s\n%s\n'
       '<text x="%d" y="%d" font-size="12" fill="#888" text-anchor="end">© OpenStreetMap et contributeurs (ODbL) — trois repères, une échelle : %.2f px/m</text>\n</svg>\n'
       % (W_TOT, H_TOT, W_TOT, H_TOT, '\n'.join(defs), leg, '\n'.join(corps), W_TOT - 20, H_TOT - 6, S))
open(SVG, 'w').write(svg)
print('pouilles-apercu.svg : %.0f Ko (%d × %d)' % (os.path.getsize(SVG) / 1024, W_TOT, H_TOT))

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if os.path.exists(CHROME):
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--screenshot=' + PNG,
                    '--window-size=%d,%d' % (W_TOT, H_TOT), 'file://' + SVG],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
    if os.path.exists(PNG): print('pouilles-apercu.png : %.0f Ko' % (os.path.getsize(PNG) / 1024))
