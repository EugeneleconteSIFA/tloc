// BANC D'UN LIEU DE LA LOZÈRE — est-il JUSTE et praticable ? (consigne d'Eugène, 2 octobre)
//
//   bancs/tour.sh node bancs/lieu-lozere.mjs villefort|gardeguerin [étiquette]
//
// Des chiffres d'abord, une planche ensuite :
//   a. praticabilité : chaque rue et chemin d'OSM échantillonné tous les 2 m — part des points
//      libres (level.blocked faux), part des pentes de plus de 35° ; puis Camille MARCHE du
//      départ à chaque lieu à atteindre (player.walkTo, de nœud en nœud du graphe des rues),
//      sans téléportation ;
//   b. bâti : toits qui débordent chez le voisin ou couvrent mal leur emprise, soubassements
//      visibles de plus de 1,5 m côté aval, murs de deux bâtiments qui se chevauchent ;
//   c. sols : rubans de rue qui flottent (> 5 cm) ou s'enfoncent (> 2 cm) sous le relief tel
//      qu'il est DESSINÉ (les triangles du maillage, pas l'interpolation), rubans qui se battent
//      (deux surfaces à moins de 2 mm l'une de l'autre).
// Écrit bancs/resultats/lieu-<nom>-<date>[-étiquette].json et .jpg (la planche de 8 vues).
// Un seul Chrome, une seule page, fermé quoi qu'il arrive (consigne de performance).
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
// le Playwright du Mac, ou celui du PC (GitHub/tloc/outils, hors du dépôt), comme bancs/charge.mjs
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const ORIGINE = process.env.TLOC_ORIGINE || 'http://127.0.0.1:8000';
const nom = process.argv[2], etiq = process.argv[3] ? '-' + process.argv[3] : '';
// « avant » : le lieu tel que monde.js le bâtissait en masse (lozere.js, `?avant`), mesuré de même
const AVANT = process.argv[3] === 'avant';
// fileURLToPath et non `.pathname`, qui donne « /C:/… » sous Windows
const RES = fileURLToPath(new URL('resultats/', import.meta.url));

// par lieu : la page, son plan, le pas de son relief, ce qu'on doit pouvoir atteindre à pied,
// et les huit vues de la planche ([x, y au-dessus du sol, z] → [x, y, z])
const LIEUX = {
  gardeguerin: {
    page: 'garde-guerin.html', plan: 'carte/mondes/lozere-garde.json', grille: { x0: 1528, z0: -5612, pas: 2 },
    cibles: [['le poteau des vieux chemins', 1850.5, -5233.8], ['la place de l’église', 1835, -5352], ['le pied de la tour', 1817, -5362], ['le four banal', 1798, -5318]],
    vues: [['aérienne', [1990, 160, -5180], [1815, 0, -5340]], ['dessus, emprises OSM', [1812, 190, -5333], [1812, 0, -5334]],
      ['rue de l’École', [1752, 1.7, -5318], [1800, 2, -5280]], ['la Régordane', [1840, 1.7, -5288], [1790, 2, -5325]], ['place de l’église', [1822, 1.7, -5358], [1852, 4, -5342]],
      ['façade', [1803, 1.7, -5300], [1812, 2.5, -5285]], ['sol', [1820, 1.4, -5306], [1828, 0, -5296]], ['le départ', [1856, 1.8, -5226], [1815, 3, -5330]]],
  },
  villefort: {
    page: 'villefort.html', plan: 'carte/mondes/lozere-villefort.json', grille: { x0: 1420, z0: -1430, pas: 5 },
    // la gare est hors du lieu depuis le resserrement du 5 octobre : Chez Fernand la remplace. Les cibles
    // sont des points de RUE devant la porte (l'ancienne cible de l'église, 4 m plus loin, était dans le bâti)
    cibles: [['le poteau des vieux chemins', 1584.5, -1129.5], ['l’église Saint-Victorin', 1676.6, -981], ['devant Chez Fernand', 1559.8, -1095.9], ['le pont Saint-Jean', 1550, -1405]],
    vues: [['aérienne', [1250, 420, -1700], [1450, 0, -1150]], ['dessus, emprises OSM', [1590, 230, -1110], [1590, 0, -1111]],
      ['rue de la Bourgade', [1548, 1.7, -1120], [1585, 3, -1070]], ['le bout de l’avenue de la Gare', [1475, 1.7, -1271], [1425, 3, -1276]], ['place du Bosquet', [1583, 1.7, -1170], [1586, 3, -1090]],
      ['façade', [1576, 1.7, -1128], [1560, 3, -1122]], ['le bord nord, pont Saint-Jean', [1565, 1.7, -1380], [1540, 3, -1432]], ['le départ', [1578, 1.8, -1140], [1586, 3, -1090]]],
  },
};
const L = LIEUX[nom];
if (!L) { console.log('lieux : ' + Object.keys(LIEUX).join(', ')); process.exit(1); }
const date = new Date().toISOString().slice(0, 10);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
let bilan = null;
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e).split('\n').slice(0, 3).join(' | ')));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/') && !r.url().endsWith('favicon.ico')) erreurs.push(r.status() + ' ' + r.url().replace(ORIGINE, '')); });
  const t0 = Date.now();
  await page.goto(`${ORIGINE}/${L.page}${AVANT ? '?avant' : ''}`);
  try { await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 240000, polling: 300 }); }
  catch (e) { console.log('✗ le lieu ne finit pas de charger ; erreurs de la page :\n  ' + (erreurs.join('\n  ') || '(aucune)')); throw e; }
  const charge = (Date.now() - t0) / 1000;
  for (let k = 0; k < 5 && !(await page.evaluate(() => window.TLOC.state.running)); k++) { await page.keyboard.press('Enter'); await page.waitForTimeout(1500); }
  await page.waitForTimeout(8000);                      // la cinématique d'entrée

  // ---------- a, b, c : les mesures, dans la page ----------
  const m = await page.evaluate(async ({ plan, grille, avant }) => {
    const T = window.TLOC, lv = T.G.level, THREE = T.THREE;
    const P = await (await fetch('/' + plan)).json(), C = P.cadre, M = await import('/lozere.js').catch(() => null), B = M && M.BILAN;
    const dans = (x, z) => x > C.x0 + 9 && x < C.x1 - 9 && z > C.z0 + 9 && z < C.z1 - 9;
    const densifier = (pts, pas) => { const o = []; for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
      for (let t = 0; t < n; t++) o.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); } o.push(pts[pts.length - 1]); return o; };
    const dansPoly = (x, z, pts) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };
    // le relief tel qu'il est dessiné : les deux triangles de chaque case de PlaneGeometry
    // (diagonale du coin (i, j+1) au coin (i+1, j)), d'après les nœuds — où l'interpolation est exacte
    const hNoeud = (i, j) => lv.getH(grille.x0 + i * grille.pas, grille.z0 + j * grille.pas);
    const hDessin = (x, z) => { const fx = (x - grille.x0) / grille.pas, fz = (z - grille.z0) / grille.pas, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const a = hNoeud(i, j), b = hNoeud(i, j + 1), c = hNoeud(i + 1, j + 1), d = hNoeud(i + 1, j);
      return u + v <= 1 ? a + u * (d - a) + v * (b - a) : c + (1 - u) * (b - c) + (1 - v) * (d - c); };
    const rues = [...P.routes, ...P.chemins].filter((c) => c.pts.some(([x, z]) => dans(x, z)));
    // a. praticabilité
    let n = 0, libres = 0, raides = 0; const bloques = [];
    for (const c of rues) { const pts = densifier(c.pts, 2).filter(([x, z]) => dans(x, z));
      for (let k = 0; k < pts.length; k++) { const [x, z] = pts[k]; n++; if (!lv.blocked(x, z, 0.4)) libres++; else if (bloques.length < 40) bloques.push([+x.toFixed(1), +z.toFixed(1), c.nom || '']);
        if (k) { const [xa, za] = pts[k - 1], d = Math.hypot(x - xa, z - za); if (d > 0.5 && Math.atan2(Math.abs(lv.getH(x, z) - lv.getH(xa, za)), d) > 35 * Math.PI / 180) raides++; } } }
    // b. bâti — les chiffres que lozere.js a laissés en bâtissant (BILAN), vérifiés ici sur la géométrie
    const bati = { mesure: !!B && !avant };
    if (B && !avant) {
      const toutes = B.corps;
      let deborde = 0, malCouvert = 0, soub = 0, chevauche = 0, soubMax = 0; const pires = [];
      for (const c of toutes) {
        // le toit ne descend pas chez le voisin : ses points ne tombent dans AUCUNE autre emprise de corps
        let chez = 0; for (const [x, z] of c.toitEchant) if (toutes.some((o) => o.bat !== c.bat && dansPoly(x, z, o.rect))) chez++;
        if (chez) { deborde++; pires.push(['toit chez le voisin', c.bat, chez]); }
        // le toit couvre ses murs : chaque coin du corps sous son toit
        // (un coin posé pile sur le bord du toit, débord rentré à zéro, compte comme couvert : 5 cm de tolérance)
        if (c.rect.some(([x, z]) => !dansPoly(x + (c.cx - x) * 0.05 / Math.hypot(c.cx - x, c.cz - z), z + (c.cz - z) * 0.05 / Math.hypot(c.cx - x, c.cz - z), c.toit))) malCouvert++;
        // le soubassement visible : du plancher au sol (ou au terre-plein) juste devant le mur
        let s = 0; for (const [x, z] of c.pied) s = Math.max(s, c.plancher - lv.getH(x, z));
        soubMax = Math.max(soubMax, s); if (s > 1.5) { soub++; if (pires.length < 30) pires.push(['soubassement', c.bat, +s.toFixed(2)]); }
      }
      for (let i = 0; i < toutes.length; i++) for (let j = i + 1; j < toutes.length; j++) {
        const a = toutes[i], b = toutes[j]; if (a.bat === b.bat) continue;
        if (Math.abs(a.cx - b.cx) > 30 || Math.abs(a.cz - b.cz) > 30) continue;
        if (a.echant.some(([x, z]) => dansPoly(x, z, b.rect))) chevauche++;
      }
      Object.assign(bati, { batiments: B.batiments, avant: false, corps: toutes.length, toitsChezLeVoisin: deborde, toitsQuiCouvrentMal: malCouvert, soubassementsSup15: soub, soubassementMax: +soubMax.toFixed(2), mursQuiSeChevauchent: chevauche, pires: pires.slice(0, 20) });
    }
    // b, avant : les toits de monde.js, refaits ici avec SA formule (le rectangle orienté selon
    // l'axe principal de l'emprise, 40 cm de débord ; murs de la fondation à 1,2 m sous le point
    // le plus bas jusqu'au plus haut + hauteur de mur)
    if (avant) {
      const ms = P.maisons, poly = ms.map((b) => b.pts);
      let chez = 0, malCouvert = 0, soub = 0, soubMax = 0, chev = 0;
      ms.forEach((b, i) => { const pts = b.pts, cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of pts) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
        const an = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(an), uz = Math.sin(an);
        let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const [x, z] of pts) { const a = (x - cx) * ux + (z - cz) * uz, bb = -(x - cx) * uz + (z - cz) * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, bb); b1 = Math.max(b1, bb); }
        let hors = 0, n = 0, voisin = false;
        for (let a = a0 - 0.4; a <= a1 + 0.4; a += 0.4) for (let bb = b0 - 0.4; bb <= b1 + 0.4; bb += 0.4) { const x = cx + a * ux - bb * uz, z = cz + a * uz + bb * ux; n++;
          if (!dansPoly(x, z, pts)) { hors++; if (!voisin && ms.some((o, j) => j !== i && Math.abs(o.pts[0][0] - x) < 60 && Math.abs(o.pts[0][1] - z) < 60 && dansPoly(x, z, o.pts))) voisin = true; } }
        if (voisin) chez++;
        if (hors / n > 0.3) malCouvert++;                 // le toit couvre plus de 30 % de vide hors des murs
        const hs = pts.map(([x, z]) => lv.getH(x, z)), s = Math.max(...hs) - Math.min(...hs) + 1.2;   // le mur sous le seuil, côté aval
        soubMax = Math.max(soubMax, s); if (s > 1.5) soub++;
        for (let j = i + 1; j < ms.length; j++) { const o = ms[j]; if (Math.abs(o.pts[0][0] - pts[0][0]) > 60 || Math.abs(o.pts[0][1] - pts[0][1]) > 60) continue;
          const d = Math.max(0.4, Math.hypot(cx - pts[0][0], cz - pts[0][1])), x2 = pts[0][0] + (cx - pts[0][0]) * 0.4 / d, z2 = pts[0][1] + (cz - pts[0][1]) * 0.4 / d;
          if (dansPoly(x2, z2, pts) && dansPoly(x2, z2, o.pts)) chev++; } });
      Object.assign(bati, { mesure: true, avant: true, batiments: ms.length, corps: ms.length, toitsChezLeVoisin: chez, toitsQuiCouvrentMal: malCouvert, soubassementsSup15: soub, soubassementMax: +soubMax.toFixed(2), mursQuiSeChevauchent: chev });
    }
    // c. sols : chaque ruban, sous les points de sa ligne (décalés de leur pas pour ne pas tomber pile sur un sommet)
    const sols = { mesure: !!B && !avant };
    if (avant) Object.assign(sols, { mesure: true, avant: true, note: 'rubans de monde.js : 18 cm au-dessus du relief (constante de son code) et faces tournées vers le bas, invisibles d’en haut', flottent: 'tous', enfonces: 0, combats: 'n. m.' });
    if (B && !avant) {
      const rc = new THREE.Raycaster(), bas = new THREE.Vector3(0, -1, 0); let echant = 0, flotte = 0, enfonce = 0, combat = 0, ecMax = 0;
      const meshes = B.rubans.map((r) => { const o = new THREE.Mesh(r.geo); o.updateMatrixWorld(); return { r, o }; });
      for (const { r, o } of meshes) {
        for (const [x, z] of densifier(r.pts, 2.37).filter(([x, z]) => dans(x, z))) for (const t of [-0.3, 0, 0.3]) {
          const [xa, za] = [x + t * r.w * (Math.random() - 0.5), z + t * r.w * (Math.random() - 0.5)];
          rc.set(new THREE.Vector3(xa, 5000, za), bas); const hit = rc.intersectObject(o)[0]; if (!hit) continue;
          echant++; const e = hit.point.y - (B.dessin ? B.dessin(xa, za) : hDessin(xa, za));   // le relief seul, sans les terre-pleins
          ecMax = Math.max(ecMax, Math.abs(e));
          if (e > 0.05) flotte++; if (e < -0.02) enfonce++;
          for (const q of meshes) { if (q === meshes.find((u) => u.o === o) || Math.abs(q.r.cx - r.cx) > q.r.rayon + r.rayon) continue;
            const h2 = rc.intersectObject(q.o)[0]; if (h2 && Math.abs(h2.point.y - hit.point.y) < 0.002) { combat++; break; } }
        }
      }
      Object.assign(sols, { echantillons: echant, flottent: flotte, enfonces: enfonce, ecartMax: +ecMax.toFixed(3), combats: combat });
    }
    return { pointsDeRue: n, libres, praticable: +(100 * libres / Math.max(1, n)).toFixed(2), tropRaides: raides, bloques, bati, sols, cadre: C };
  }, { plan: L.plan, grille: L.grille, avant: AVANT });

  // ---------- a (suite) : Camille marche du départ à chaque cible, par les rues ----------
  const marche = [];
  for (const [quoi, tx, tz] of L.cibles) {
    const chemin = await page.evaluate(async ({ plan, tx, tz }) => {
      // le graphe des rues : nœuds tous les 2 m, reliés le long des rues et d'une rue à l'autre à moins de 3 m
      const T = window.TLOC, P = await (await fetch('/' + plan)).json(), N = [], V = [];
      const dens = (pts) => { const o = []; for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
        for (let t = 0; t < n; t++) o.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); } o.push(pts[pts.length - 1]); return o; };
      for (const c of [...P.routes, ...P.chemins]) { const pts = dens(c.pts), d = N.length; pts.forEach((p, k) => { N.push(p); V.push([]); if (k) { V[d + k].push(d + k - 1); V[d + k - 1].push(d + k); } }); }
      const G = new Map(); N.forEach(([x, z], i) => { const k = Math.floor(x / 3) + ',' + Math.floor(z / 3); if (!G.has(k)) G.set(k, []); G.get(k).push(i); });
      N.forEach(([x, z], i) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of G.get((Math.floor(x / 3) + a) + ',' + (Math.floor(z / 3) + b)) || []) if (j !== i && Math.hypot(N[j][0] - x, N[j][1] - z) < 3 && !V[i].includes(j)) V[i].push(j); });
      const proche = (x, z) => { let b = 0, d = 1e9; N.forEach(([a, c], i) => { const e = Math.hypot(a - x, c - z); if (e < d) { d = e; b = i; } }); return b; };
      const p = T.player.pos, s = proche(p.x, p.z), t = proche(tx, tz), dist = new Map([[s, 0]]), prec = new Map(), file = [s];
      while (file.length) { file.sort((a, b) => dist.get(a) - dist.get(b)); const u = file.shift(); if (u === t) break;
        for (const v of V[u]) { const d = dist.get(u) + Math.hypot(N[v][0] - N[u][0], N[v][1] - N[u][1]); if (d < (dist.get(v) ?? 1e9)) { dist.set(v, d); prec.set(v, u); file.push(v); } } }
      if (!dist.has(t)) return null;
      const ch = [[tx, tz]]; for (let u = t; u !== s; u = prec.get(u)) ch.push(N[u]); ch.push(N[s]); return ch.reverse();
    }, { plan: L.plan, tx, tz });
    if (!chemin) { marche.push({ quoi, ok: false, raison: 'aucun chemin dans le graphe des rues' }); continue; }
    let ok = true, raison = '';
    const t1 = Date.now();
    for (const [x, z] of chemin) {
      await page.evaluate(([x, z]) => { const p = window.TLOC.player; p.walkTo = { x, z }; p.walkSpeed = 8; }, [x, z]);
      let dernier = null, immobile = 0;
      for (;;) {
        await page.waitForTimeout(150);
        const q = await page.evaluate(() => { const p = window.TLOC.player; return [p.pos.x, p.pos.z, !!p.walkTo]; });
        if (!q[2] || Math.hypot(q[0] - x, q[1] - z) < 0.6) break;
        if (dernier && Math.hypot(q[0] - dernier[0], q[1] - dernier[1]) < 0.05) immobile++; else immobile = 0;
        dernier = q;
        if (immobile > 20) { ok = false; raison = `bloquée en (${q[0].toFixed(1)}, ${q[1].toFixed(1)})`; break; }
      }
      if (!ok) break;
    }
    const fin = await page.evaluate(() => { const p = window.TLOC.player.pos; return [p.x, p.z]; });
    if (ok && Math.hypot(fin[0] - tx, fin[1] - tz) > 2.5) { ok = false; raison = 'arrivée trop loin'; }
    marche.push({ quoi, ok, raison, longueur: Math.round(chemin.reduce((s, p, k) => s + (k ? Math.hypot(p[0] - chemin[k - 1][0], p[1] - chemin[k - 1][1]) : 0), 0)), secondes: +((Date.now() - t1) / 1000).toFixed(1) });
    await page.evaluate(() => { window.TLOC.player.walkTo = null; });
  }

  // ---------- la planche : huit vues fixes, les emprises OSM en surimpression sur la vue de dessus ----------
  await page.addStyleTag({ content: '#overlay,#hud,[id^=cine]{display:none!important}' });
  const images = [];
  for (const [titre, c, a] of L.vues) {
    await page.evaluate(async ({ c, a, emprises, plan }) => {
      const T = window.TLOC, h = T.G.level.getH, THREE = T.THREE;
      if (window.__emprises) { T.scene.remove(window.__emprises); window.__emprises = null; }
      if (emprises) { const P = await (await fetch('/' + plan)).json(), g = new THREE.Group();
        for (const b of P.maisons) { const pts = b.pts.map(([x, z]) => new THREE.Vector3(x, h(x, z) + 0.3, z));
          const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff2020, depthTest: false })); l.renderOrder = 999; g.add(l); }
        T.scene.add(g); window.__emprises = g; }
      T.G.freeCam = { pos: { x: c[0], y: h(c[0], c[2]) + c[1], z: c[2] }, at: { x: a[0], y: h(a[0], a[2]) + a[1], z: a[2] } };
    }, { c, a, emprises: titre.startsWith('dessus'), plan: L.plan });
    await page.waitForTimeout(2200);
    images.push([titre, (await page.screenshot({ type: 'jpeg', quality: 82 })).toString('base64')]);
  }
  bilan = { lieu: nom, date: new Date().toISOString(), chargement_s: +charge.toFixed(1), erreurs: [...new Set(erreurs)].slice(0, 10), ...m, marche };
  const vert = bilan.praticable === 100 && marche.every((x) => x.ok) && (!m.bati.mesure || (m.bati.toitsChezLeVoisin === 0 && m.bati.soubassementsSup15 === 0 && m.bati.mursQuiSeChevauchent === 0 && m.bati.toitsQuiCouvrentMal === 0))
    && (!m.sols.mesure || (m.sols.flottent === 0 && m.sols.enfonces === 0 && m.sols.combats === 0));
  bilan.vert = vert && m.bati.mesure && m.sols.mesure && !AVANT;
  const base = `${RES}lieu-${nom}-${date}${etiq}`;
  fs.writeFileSync(base + '.json', JSON.stringify(bilan, null, 1));
  // la planche, dans la même page (pas de second navigateur)
  const r = (t, v) => `<tr><td>${t}</td><td><b>${v}</b></td></tr>`;
  const tab = `<table style="font:13px sans-serif;color:#eee;border-spacing:8px 2px">${r('rues praticables', bilan.praticable + ' %  (' + m.libres + ' / ' + m.pointsDeRue + ')')}${r('pentes > 35°', m.tropRaides)}
    ${r('à pied depuis le départ', marche.map((x) => (x.ok ? '✓ ' : '✗ ') + x.quoi).join(' · '))}
    ${m.bati.mesure ? r('toits chez le voisin / mal couvrants', m.bati.toitsChezLeVoisin + ' / ' + m.bati.toitsQuiCouvrentMal) + r('soubassements > 1,5 m (max)', m.bati.soubassementsSup15 + ' (' + m.bati.soubassementMax + ' m)') + r('murs qui se chevauchent', m.bati.mursQuiSeChevauchent) : r('bâti', 'non mesuré (bâti par monde.js)')}
    ${m.sols.mesure ? r('rubans : flottent / enfoncés / combats', m.sols.flottent + ' / ' + m.sols.enfonces + ' / ' + m.sols.combats + '  (écart max ' + m.sols.ecartMax + ' m)') : r('sols', 'non mesurés (rubans de monde.js)')}</table>`;
  await page.goto('about:blank');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setContent(`<body style="margin:0;background:#111;font:14px sans-serif;color:#fff"><div style="padding:6px 10px"><b>${nom} — ${date}${etiq}</b>${tab}</div>
    <div style="display:grid;grid-template-columns:repeat(4,318px);gap:2px">${images.map(([t, b]) => `<div style="position:relative"><img src="data:image/jpeg;base64,${b}" width=318 height=199><span style="position:absolute;left:4px;top:3px;background:#000a;padding:1px 5px;font-size:12px">${t}</span></div>`).join('')}</div></body>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: base + '.jpg', type: 'jpeg', quality: 85, fullPage: true });
  console.log(JSON.stringify({ ...bilan, bloques: bilan.bloques.slice(0, 8) }, null, 1).slice(0, 3000));
  console.log('→', base + '.json', base + '.jpg');
} finally {
  await browser.close();
}
