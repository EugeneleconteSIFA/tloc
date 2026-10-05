// CONTRÔLE avant publication — ce qui rend les règles de CLAUDE.md mécaniques.
//
// publier-dev.sh l'appelle et n'envoie rien s'il échoue. Trois épreuves, dans l'ordre du
// moins cher au plus cher :
//   1. la syntaxe de chaque module (node --check) : une accolade oubliée ne part plus ;
//   2. le démarrage de chaque page (ville et intérieurs) sans erreur d'exécution ni fichier
//      introuvable : une erreur de portée ne se voit qu'au chargement (docs/ORCHESTRATION.md,
//      « trois pièges déjà payés ») ;
//   3. le banc de chargement (règle 8) : MÉDIANE de 3 passes à froid, parce qu'un passage seul
//      bouge de ±3 s avec la charge du Mac — somme des étapes ≤ 17 s, poids ≤ 45 Mo.
//
//   node bancs/controle.mjs [http://127.0.0.1:8000]      (il faut ./lancer.sh)
//   TLOC_CONTROLE_RAPIDE=1 : épreuves 1 et 2 seulement (pour itérer, jamais pour publier)
//
// Code de sortie 0 : tout passe. 1 : au moins une épreuve échoue (le détail est affiché).
import { createRequire } from 'module';
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
// fileURLToPath et non `.pathname` : sous Windows, `.pathname` donne « /C:/… », que fs lit
// « C:\C:\… » (le PC du 5 octobre). Barres obliques gardées : RACINE + 'bancs/' marche partout.
const chemin = (u) => fileURLToPath(new URL(u, import.meta.url)).split('\\').join('/');
const RACINE = chemin('..');
const RES = chemin('resultats/');
// TLOC_SOMME_MAX ne sert qu'à prouver que le contrôle refuse bien un dépassement
const SOMME_MAX = +(process.env.TLOC_SOMME_MAX || 17), MO_MAX = 45, PASSES = 3;
const PAGES = ['index.html', 'cave.html', 'tavern.html', 'chapelle.html', 'house.html', 'mage.html'];
const echecs = [];
const dire = (s) => console.log(s);

// ---- 1. la syntaxe
const modules = fs.readdirSync(RACINE).filter((f) => /\.(m?js)$/.test(f)).map((f) => RACINE + f)
  .concat(fs.readdirSync(RACINE + 'bancs').filter((f) => f.endsWith('.mjs')).map((f) => RACINE + 'bancs/' + f));
for (const f of modules) {
  // Pas `node --check fichier.js` : sur un .js écrit en modules ES, Node 24 répond 0 même
  // quand la syntaxe est cassée (vérifié le 30 septembre). On lui passe le texte en le
  // déclarant module.
  const r = f.endsWith('.mjs') ? spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' })
    : spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f), encoding: 'utf8' });
  if (r.status !== 0) echecs.push(`syntaxe : ${f.replace(RACINE, '')}\n${(r.stderr || '').split('\n').filter((l) => l.trim()).slice(0, 4).join('\n')}`);
}
dire(`1. syntaxe : ${modules.length} modules, ${echecs.length ? echecs.length + ' en erreur' : 'tous bons'}`);

// ---- 2. le démarrage
// fetch plutôt que curl : `-o /dev/null` n'existe pas sous Windows
if (!(await fetch(ORIGINE + '/index.html').then((r) => r.ok).catch(() => false))) {
  dire(`Le serveur ne répond pas sur ${ORIGINE} : lance ./lancer.sh d'abord.`); process.exit(1);
}
// Playwright n'est pas dans le projet : celui de Projet-Padel sur le Mac, celui de
// GitHub/tloc/outils sur le PC (installé le 5 octobre), ou TLOC_PLAYWRIGHT.
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
// Metal n'existe que sur le Mac ; Direct3D 11 est son équivalent sous Windows
const ANGLE = process.platform === 'darwin' ? 'metal' : 'd3d11';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const pg of PAGES) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const err = [];
  page.on('pageerror', (e) => err.push('erreur : ' + String(e).split('\n')[0]));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/')) err.push(`${r.status()} : ${r.url().replace(ORIGINE, '')}`); });
  const t0 = Date.now();
  try {
    await page.goto(ORIGINE + '/' + pg);
    await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 180000, polling: 200 });
    await page.waitForTimeout(1500);                  // la première image : les erreurs de la boucle de jeu
  } catch (e) { err.push('ne finit pas de charger (3 min)'); }
  dire(`2. ${pg.padEnd(14)} ${err.length ? '✗ ' + err.length + ' problème(s)' : '✓'}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (err.length) echecs.push(`démarrage de ${pg} :\n  ` + [...new Set(err)].slice(0, 6).join('\n  '));
  await page.context().close();
}
await browser.close();

// ---- 3. le banc de chargement
if (process.env.TLOC_CONTROLE_RAPIDE) dire('3. banc de chargement : SAUTÉ (TLOC_CONTROLE_RAPIDE) — ne pas publier ainsi');
else if (echecs.length) dire('3. banc de chargement : pas lancé, les épreuves 1–2 échouent déjà');
else {
  // un Mac occupé fausse la mesure : on attend qu'il se calme (5 min au plus), et on le dit
  for (let i = 0; i < 30 && os.loadavg()[0] > 4; i++) await new Promise((r) => setTimeout(r, 10000));
  const charge = os.loadavg()[0].toFixed(1);
  const sommes = [], mos = [], tas = [], tex = [];
  for (let k = 1; k <= PASSES; k++) {
    const etiq = `controle-${k}`;
    spawnSync(process.execPath, [RACINE + 'bancs/charge.mjs', ORIGINE], { env: { ...process.env, TLOC_ETIQUETTE: etiq }, encoding: 'utf8' });
    const f = fs.readdirSync(RES).filter((n) => n.endsWith(`-${etiq}.json`)).map((n) => RES + n)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    const d = f && JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!d || !d.froid || !d.froid.etapes) { echecs.push(`banc : la passe ${k} n'a rien mesuré`); break; }
    sommes.push(Object.values(d.froid.etapes).reduce((a, b) => a + b, 0) / 1000); mos.push(d.froid.Mo); tas.push(d.froid.tasMo); tex.push(d.froid.texturesMo);
    fs.unlinkSync(f);                                 // les passes de contrôle ne s'accumulent pas
  }
  if (sommes.length === PASSES) {
    const med = (t) => [...t].sort((a, b) => a - b)[Math.floor(t.length / 2)];
    const s = med(sommes), mo = med(mos);
    dire(`3. banc à froid (médiane de ${PASSES}, charge du Mac ${charge}) : somme ${s.toFixed(1)} s / ${SOMME_MAX} s — ${mo} Mo / ${MO_MAX} Mo   [${sommes.map((x) => x.toFixed(1)).join(', ')}]`);
    // la mémoire, pour information (le budget viendra quand un vrai téléphone aura parlé)
    dire(`   mémoire (ordinateur) : tas JS ${med(tas)} Mo après ramasse-miettes, textures ${med(tex)} Mo`);
    if (s > SOMME_MAX) echecs.push(`banc : somme des étapes ${s.toFixed(1)} s, au-delà du budget de ${SOMME_MAX} s (CLAUDE.md, règle 8)`);
    if (mo > MO_MAX) echecs.push(`banc : ${mo} Mo au chargement, au-delà du plafond de ${MO_MAX} Mo`);
  }
}

if (echecs.length) { dire('\n✗ CONTRÔLE ÉCHOUÉ — rien ne part :\n- ' + echecs.join('\n- ')); process.exit(1); }
dire('\n✓ contrôle passé');
