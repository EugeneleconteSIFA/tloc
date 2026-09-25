# -*- coding: utf-8 -*-
"""Cache-buster : aligne la version de tous les modules sur une seule valeur.

La liste des fichiers est DÉDUITE, pas écrite à la main. Un module qui importe
engine.js sans le bon ?v= charge une deuxième instance du moteur — deuxième
scène, deuxième window.TLOC, menu vide — et la panne est silencieuse. Chaque
nouveau module oublié dans une liste en dur reproduisait ce bug.
"""
import re, sys, glob, os

v = sys.argv[1]
touches = []

# pages HTML : le script d'entrée du niveau
for f in glob.glob('*.html'):
    s = open(f, encoding='utf-8').read()
    n = re.sub(r'src="([A-Za-z0-9_-]+)\.js(\?v=[^"]*)?"', r'src="\1.js?v=' + v + '"', s)
    if n != s: open(f, 'w', encoding='utf-8').write(n); touches.append(f)

# tout fichier qui importe engine.js, quel qu'il soit
for f in sorted(glob.glob('*.js') + glob.glob('*.html')):
    if os.path.basename(f) == 'engine.js': continue
    s = open(f, encoding='utf-8').read()
    if "engine.js" not in s: continue
    n = re.sub(r"(['\"])\./engine\.js(\?v=[^'\"]*)?\1", r"\1./engine.js?v=" + v + r"\1", s)
    if n != s:
        open(f, 'w', encoding='utf-8').write(n)
        if f not in touches: touches.append(f)

print('version', v, '->', ', '.join(touches) or 'rien à faire')
