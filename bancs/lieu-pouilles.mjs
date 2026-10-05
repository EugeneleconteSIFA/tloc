// Banc « LIEU » des Pouilles : Gallipoli, Matera, Alberobello sont-elles JUSTES et praticables ?
//
// La consigne de précision (Eugène, 2 octobre) : mesurer d'abord, en chiffres, avant toute
// nouveauté. Pour chaque ville :
//   a. PRATICABILITÉ — chaque rue, chemin et escalier d'OSM échantillonné tous les 2 m dans le
//      cadre jouable : part des points libres (level.blocked faux), pentes de plus de 35° ;
//      puis Camille MARCHE vraiment (player.walkTo, point par point, sur un chemin cherché en
//      A* dans la grille des collisions) du départ à la gare, à la porte de l'île et aux
//      habitants — pas de téléportation ;
//   b. BÂTI — le soubassement de chaque maison (dénivelé du terrain sous son emprise : au-delà
//      de 1,5 m, un mur nu sort de terre côté aval), les emprises qui se chevauchent, les cônes
//      de trulli qui débordent de leur trullo (les toits plats couvrent leurs murs par
//      construction : l'extrusion EST le toit) ;
//   c. SOLS — l'écart entre les rubans de rue et le relief, par rayon vertical.
// Puis une planche de 8 vues par ville (aérienne, dessus avec les emprises d'OSM en rouge,
// trois rues à hauteur de Camille, une façade, un sol, le départ).
//
//   bancs/tour.sh node bancs/lieu-pouilles.mjs [gallipoli,matera,alberobello] [étiquette]
//
// Sortie : bancs/resultats/lieu-pouilles-<date>.json et lieu-pouilles-<ville>-<date>.png.
import { createRequire } from 'module';
import fs from 'fs';
const PW = process.env.TLOC_PLAYWRIGHT || `${process.env.HOME}/Documents/Projet-Padel/package.json`;
const { chromium } = createRequire(PW)('playwright');
const DIR = new URL('resultats/', import.meta.url).pathname, JOUR = new Date().toISOString().slice(0, 10);
const VILLES = (process.argv[2] || 'gallipoli,matera,alberobello').split(',');
// une étiquette pour garder l'avant et l'après du même jour : … alberobello avant
const ETIQ = process.argv[3] ? '-' + process.argv[3] : '';
const ORIGINE = process.env.TLOC_ORIGINE || 'http://localhost:8000';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const bilan = {};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  let erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).map((l) => l.trim()).join(' < ')));
  for (const V of VILLES) {
    erreurs = [];
    const t0 = Date.now();
    // une ville neuve, sans la partie de la précédente : sinon la sauvegarde de fin de Gallipoli
    // (Camille près de Nunzia) la reposait hors du cœur d'Alberobello, et rien n'y était atteint
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }).catch(() => {});
    await page.goto(`${ORIGINE}/${V}.html`);
    for (let i = 0; i < 90; i++) { await page.waitForTimeout(1500); if (await page.evaluate(() => document.getElementById('loading')?.classList.contains('hidden'))) break; }
    const charge = (Date.now() - t0) / 1000;
    erreurs = [];                 // (celles d'avant venaient de la page précédente, qu'on quittait)
    await page.evaluate(() => { for (const id of ['overlay', 'hud', 'legend', 'msg']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });

    // ---------------- a, b, c : les mesures statiques ----------------
    const M = await page.evaluate(async (V) => {
      const T = window.TLOC, L = T.G.level, THREE = T.THREE;
      const plan = await (await fetch(`carte/mondes/pouilles-${V}-coeur.json`)).json();
      const R = await (await fetch(`carte/mondes/relief-pouilles-${V}-coeur.json`)).json();
      const C = { x0: R.x0 + 8, z0: R.z0 + 8, x1: R.x0 + R.pas * (R.nx - 1) - 8, z1: R.z0 + R.pas * (R.nz - 1) - 8 };
      const dans = (x, z) => x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1;
      const H = (x, z) => T.getH(x, z);
      // a. les rues : tous les 2 m
      let pts = 0, libres = 0, raides = 0; const bloques = [];
      for (const r of [...plan.routes, ...plan.chemins]) {
        let prev = null;
        for (let k = 0; k < r.pts.length - 1; k++) { const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(l / 2));
          for (let t = 0; t < n; t++) { const x = ax + (bx - ax) * t / n, z = az + (bz - az) * t / n; if (!dans(x, z)) { prev = null; continue; }
            pts++; const b = L.blocked(x, z, 0.4); if (!b) libres++; else if (bloques.length < 400) bloques.push([+x.toFixed(1), +z.toFixed(1)]);
            if (prev) { const d = Math.hypot(x - prev[0], z - prev[1]); if (d > 0.5 && Math.atan2(Math.abs(H(x, z) - prev[2]), d) > 35 * Math.PI / 180) raides++; }
            prev = [x, z, H(x, z)]; } } }
      // b. le bâti
      const bat = plan.batiments.filter((b) => b.pts.some(([x, z]) => dans(x, z)));
      const dansP = (x, z, p) => { let d = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };
      let soub = 0, soubMax = 0; const soubs = [];
      // (sur les sommets DANS le cadre : une maison à cheval sur le bord du cœur se mesurait sur
      // le relief prolongé au-delà, faux)
      for (const b of bat) { const hs = b.pts.filter(([x, z]) => dans(x, z)).map(([x, z]) => H(x, z)); if (hs.length < 2) continue; const d = Math.max(...hs) - Math.min(...hs);
        if (d > 1.5) { soub++; if (soubs.length < 200) soubs.push([+b.pts[0][0].toFixed(1), +b.pts[0][1].toFixed(1), +d.toFixed(1)]); } soubMax = Math.max(soubMax, d); }
      // les chevauchements : un sommet d'une emprise À L'INTÉRIEUR d'une autre (à 30 cm près)
      const grille = new Map(); bat.forEach((b, i) => { for (const [x, z] of b.pts) { const k = Math.floor(x / 20) + ',' + Math.floor(z / 20); if (!grille.has(k)) grille.set(k, new Set()); grille.get(k).add(i); } });
      let chev = 0; const vus = new Set();
      bat.forEach((b, i) => { for (const [x, z] of b.pts) for (const j of grille.get(Math.floor(x / 20) + ',' + Math.floor(z / 20)) || []) {
        if (j === i || vus.has(i < j ? i + ':' + j : j + ':' + i)) continue; const o = bat[j].pts;
        // un point de L'INTÉRIEUR de b, à 40 cm de son sommet, tombe-t-il dans o ? (deux voisins
        // qui partagent un mur se touchent sans se chevaucher)
        const p = b.pts, cx = p.reduce((s, q) => s + q[0], 0) / p.length, cz = p.reduce((s, q) => s + q[1], 0) / p.length, d = Math.max(0.4, Math.hypot(cx - x, cz - z)), x2 = x + (cx - x) * 0.4 / d, z2 = z + (cz - z) * 0.4 / d;
        if (dansP(x2, z2, p) && dansP(x2, z2, o)) { chev++; vus.add(i < j ? i + ':' + j : j + ':' + i); } } });
      // les cônes : le bord du cône (12 points) doit rester sur son trullo, à 40 cm près
      let conesDebord = 0; const cones = (window.__pouilles && window.__pouilles.cones) || [];
      const trulli = bat.filter((b) => b.k === 'trullo' || b.toit === 'conical');
      for (const [cx, cz, r] of cones) { const t = trulli.find((b) => dansP(cx, cz, b.pts)); if (!t) { conesDebord++; continue; }
        let hors = 0; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; if (!dansP(cx + Math.cos(a) * (r - 0.4), cz + Math.sin(a) * (r - 0.4), t.pts)) hors++; }
        if (hors > 2) conesDebord++; }
      // c. les rubans de rue : un rayon vertical sur le maillage des rues, comparé au relief
      // (le moteur découpe les grands maillages par quartiers : on prend tous les morceaux)
      const rubans = []; T.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material && o.material.polygonOffset && o.material.polygonOffsetFactor === -2) rubans.push(o); });
      let flotte = 0, enfonce = 0, mes = 0, ecartMax = 0;
      if (rubans.length) { const rc = new THREE.Raycaster(), bas = new THREE.Vector3(0, -1, 0);
        for (const r of plan.routes.concat(plan.chemins)) for (let k = 0; k < r.pts.length - 1; k += 1) { const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1];
          for (const t of [0.25, 0.5, 0.75]) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (!dans(x, z) || mes > 3000) continue;
            rc.set(new THREE.Vector3(x, H(x, z) + 30, z), bas); const h = rc.intersectObjects(rubans, false)[0]; if (!h) continue; mes++;
            const e = h.point.y - H(x, z); ecartMax = Math.max(ecartMax, Math.abs(e)); if (e > 0.05) flotte++; else if (e < -0.02) enfonce++; } } }
      return { plan: { batiments: bat.length, trulli: trulli.length, cones: cones.length },
        rues: { points: pts, libres, part: +(libres / Math.max(1, pts) * 100).toFixed(1), raides, bloques },
        bati: { soubassements: soub, soubassementMax: +soubMax.toFixed(1), soubs, chevauchements: chev, conesDebord },
        sols: { mesures: mes, flottent: flotte, enfonces: enfonce, ecartMax: +ecartMax.toFixed(2) },
        cadre: C, depart: [T.player.pos.x, T.player.pos.z] };
    }, V);

    // ---------------- a bis : la marche réelle ----------------
    // les buts : la gare, les portes de l'île, les habitants (les points d'interaction du lieu)
    const buts = await page.evaluate(() => window.TLOC.interactables.filter((i) => i.pos).map((i) => ({ quoi: typeof i.prompt === 'function' ? i.prompt() : String(i.prompt), x: i.pos.x, z: i.pos.z, r: i.r || 3 })));
    const marches = [];
    for (const B of buts) {
      const r = await page.evaluate(async (B) => {
        const T = window.TLOC, p = T.player, st = T.state; st.running = true; st.paused = false;
        // le chemin : A* sur une grille de 1 m, les cases libres pour les vraies collisions du jeu
        const C = { x: p.pos.x, z: p.pos.z }, lib = new Map(), k = (i, j) => i * 4096 + j;
        // (le rayon du moteur, 0,5 m — tryMove ; et pas de pente de plus de 35° d'une case à l'autre)
        const libre = (i, j) => { const c = k(i, j); if (!lib.has(c)) lib.set(c, !T.blocked(C.x + i, C.z + j, 0.6, false, T.getH(C.x + i, C.z + j) + 0.1)); return lib.get(c); };
        const marche = (i, j, a, b) => Math.abs(T.getH(C.x + a, C.z + b) - T.getH(C.x + i, C.z + j)) < 0.7 * Math.hypot(a - i, b - j);     // 35° : le seuil « trop raide » de la consigne
        const gi = Math.round(B.x - C.x), gj = Math.round(B.z - C.z), ouvert = [[0, 0, 0, Math.hypot(gi, gj)]], g = new Map([[k(0, 0), 0]]), de = new Map();
        let fin = null, n = 0;
        while (ouvert.length && n++ < 250000) {
          let m = 0; for (let q = 1; q < ouvert.length; q++) if (ouvert[q][3] < ouvert[m][3]) m = q;
          const [i, j, gc] = ouvert[m]; ouvert[m] = ouvert[ouvert.length - 1]; ouvert.pop();
          if (Math.hypot(i - gi, j - gj) <= Math.max(1.5, B.r - 0.5)) { fin = [i, j]; break; }
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const a = i + di, b = j + dj; if (!libre(a, b) || !marche(i, j, a, b) || (di && dj && (!libre(i + di, j) || !libre(i, j + dj)))) continue;
            const ng = gc + Math.hypot(di, dj); if (ng >= (g.get(k(a, b)) ?? 1e9)) continue;
            g.set(k(a, b), ng); de.set(k(a, b), [i, j]); ouvert.push([a, b, ng, ng + Math.hypot(a - gi, b - gj)]); } }
        if (!fin) return { trouve: false, n, ouverts: ouvert.length, vus: g.size, libre0: libre(0, 0), libre1: libre(1, 0), marche1: marche(0, 0, 1, 0), but: [gi, gj] };
        const ch = []; for (let c = fin; c; c = de.get(k(c[0], c[1]))) ch.unshift([C.x + c[0], C.z + c[1]]);
        // on marche, case par case (un point sur deux coupait les angles au ras de la mer, à
        // Gallipoli), au pas du jeu (4,5 m/s). Coincée = trois secondes DE JEU
        // sans avancer de 20 cm : sur un Mac chargé, le jeu tourne au quart de sa vitesse, et un
        // délai en secondes réelles déclarait coincée une Camille qui marchait
        p.walkSpeed = 4.5; let coince = null;
        for (let q = 1; q < ch.length; q += 1) { const [x, z] = ch[Math.min(q, ch.length - 1)]; p.walkTo = { x, z };
          let t0 = st.time, x0 = p.pos.x, z0 = p.pos.z, reel = 0;
          while (p.walkTo && st.time - t0 < 3 && reel < 60000) { await new Promise((r) => setTimeout(r, 50)); reel += 50;
            if (Math.hypot(p.pos.x - x0, p.pos.z - z0) > 0.2) { t0 = st.time; x0 = p.pos.x; z0 = p.pos.z; } }
          if (p.walkTo) { coince = [+p.pos.x.toFixed(1), +p.pos.z.toFixed(1)]; p.walkTo = null; break; } }
        const d = Math.hypot(p.pos.x - B.x, p.pos.z - B.z);
        return { trouve: true, longueur: ch.length, arrive: d <= B.r + 0.5, reste: +d.toFixed(1), coince };
      }, B);
      marches.push({ ...B, x: +B.x.toFixed(1), z: +B.z.toFixed(1), ...r });
      // retour au départ pour le but suivant (le départ, lui, n'est pas une marche)
      await page.evaluate(([x, z]) => { const p = window.TLOC.player; p.pos.set(x, window.TLOC.getH(x, z), z); }, M.depart);
    }
    M.marche = { buts: marches.length, atteints: marches.filter((m) => m.arrive).length, detail: marches };

    // ---------------- la planche : 8 vues ----------------
    const vues = await page.evaluate(([V, M]) => {
      const T = window.TLOC, THREE = T.THREE, C = M.cadre, cx = (C.x0 + C.x1) / 2, cz = (C.z0 + C.z1) / 2, H = (x, z) => T.getH(x, z);
      const W = C.x1 - C.x0, [dx, dz] = M.depart, hd = H(dx, dz);
      // les emprises d'OSM en rouge, au-dessus de tout (pour la vue de dessus)
      return fetch(`carte/mondes/pouilles-${V}-coeur.json`).then((r) => r.json()).then((plan) => {
        const pos = []; for (const b of plan.batiments) for (let k = 0; k < b.pts.length - 1; k++) { const [ax, az] = b.pts[k], [bx, bz] = b.pts[k + 1]; pos.push(ax, H(ax, az) + 14, az, bx, H(bx, bz) + 14, bz); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const traits = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff2020, depthTest: false })); traits.visible = false; traits.renderOrder = 999; T.scene.add(traits); window.__traits = traits;
        // les trois plus longues rues du cadre, prises en leur milieu, regardées dans leur axe
        const rues = plan.routes.concat(plan.chemins).map((r) => { const p = r.pts.filter(([x, z]) => x > C.x0 + 20 && x < C.x1 - 20 && z > C.z0 + 20 && z < C.z1 - 20); return p; }).filter((p) => p.length > 2)
          .map((p) => ({ p, l: p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0) })).sort((a, b) => b.l - a.l).slice(0, 3);
        const rue = (r) => { const i = Math.floor(r.p.length / 2), [x, z] = r.p[i], [x2, z2] = r.p[i + 1] || r.p[i - 1], a = Math.atan2(x2 - x, z2 - z); return [x - Math.sin(a) * 6, H(x, z) + 1.7, z - Math.cos(a) * 6, x + Math.sin(a) * 10, H(x, z) + 1.4, z + Math.cos(a) * 10]; };
        // une façade : la maison la plus proche du départ, vue de face à 6 m
        const b = plan.batiments.map((b) => ({ b, d: Math.hypot(b.pts[0][0] - dx, b.pts[0][1] - dz) })).sort((a, c) => a.d - c.d)[0].b;
        const [fx, fz] = b.pts[0], [gx, gz] = b.pts[1], mx = (fx + gx) / 2, mz = (fz + gz) / 2, l = Math.hypot(gx - fx, gz - fz) || 1, nx = (gz - fz) / l, nz = -(gx - fx) / l;
        const s = T.blocked(mx + nx * 3, mz + nz * 3, 0.3) ? -1 : 1;
        return [
          ['aérienne', [cx + W * 0.55, H(cx, cz) + W * 0.45, cz + W * 0.55, cx, H(cx, cz), cz]],
          ['dessus, emprises OSM', [dx, hd + 120, dz + 1, dx, hd, dz], true],
          ...rues.map((r, i) => ['rue ' + (i + 1), rue(r)]),
          ['façade', [mx + nx * s * 7, H(mx, mz) + 2.2, mz + nz * s * 7, mx, H(mx, mz) + 2.4, mz]],
          ['sol', [dx + 2, hd + 2.2, dz + 2, dx + 0.2, hd, dz + 0.2]],
          ['départ', [dx - 7, hd + 3.2, dz - 7, dx + 6, hd + 1, dz + 6]],
        ];
      });
    }, [V, M]);
    const images = [];
    for (const [nom, v, traits] of vues) {
      await page.evaluate(([v, traits]) => { const T = window.TLOC; T.G.freeCam = { pos: { x: v[0], y: v[1], z: v[2] }, at: { x: v[3], y: v[4], z: v[5] } }; window.__traits.visible = !!traits; }, [v, traits]);
      await page.waitForTimeout(1800);
      images.push([nom, (await page.screenshot({ type: 'jpeg', quality: 72 })).toString('base64')]);
    }
    await page.evaluate(() => { window.__traits.visible = false; window.TLOC.G.freeCam = null; });
    const erreursLieu = erreurs.slice(0, 5), nErreurs = erreurs.length;      // avant la planche : composée dans la page, elle fait parler la boucle du jeu
    // la planche : composée dans la même page, puis photographiée
    await page.setContent(`<body style="margin:0;background:#111;font:14px sans-serif;color:#fff">
      <div style="padding:6px 10px">${V} — rues ${M.rues.part} % praticables (${M.rues.points} pts, ${M.rues.raides} trop raides) · marche ${M.marche.atteints}/${M.marche.buts} · soubassements &gt; 1,5 m : ${M.bati.soubassements} · chevauchements ${M.bati.chevauchements} · cônes qui débordent ${M.bati.conesDebord} · rubans qui flottent ${M.sols.flottent}/${M.sols.mesures}</div>
      <div style="display:grid;grid-template-columns:repeat(4,320px);gap:2px">${images.map(([n, b]) => `<div style="position:relative"><img style="width:320px;display:block" src="data:image/jpeg;base64,${b}"><span style="position:absolute;left:4px;top:2px;text-shadow:0 0 3px #000">${n}</span></div>`).join('')}</div></body>`);
    await page.setViewportSize({ width: 1286, height: 400 });
    await page.screenshot({ path: `${DIR}lieu-pouilles-${V}-${JOUR}${ETIQ}.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
    bilan[V] = { charge: +charge.toFixed(1), erreurs: erreursLieu, nErreurs, ...M };
    console.log(`${V} : chargé en ${charge.toFixed(1)} s · rues ${M.rues.part} % (${M.rues.raides} raides) · marche ${M.marche.atteints}/${M.marche.buts} · soubassements ${M.bati.soubassements} (max ${M.bati.soubassementMax} m) · chevauchements ${M.bati.chevauchements} · cônes ${M.bati.conesDebord}/${M.plan.cones} · rubans flottent ${M.sols.flottent}/${M.sols.mesures} (max ${M.sols.ecartMax} m)${nErreurs ? ' · ERREURS ' + nErreurs + ' : ' + erreursLieu[0] : ''}`);
    for (const m of M.marche.detail) if (!m.arrive) console.log('   pas atteint :', m.quoi, m.x, m.z, m.trouve ? `coincée en ${m.coince}, reste ${m.reste} m` : 'aucun chemin ' + JSON.stringify({ n: m.n, ouverts: m.ouverts, vus: m.vus, l0: m.libre0, l1: m.libre1, m1: m.marche1, but: m.but }));
  }
} finally {
  await browser.close();
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(`${DIR}lieu-pouilles-${JOUR}${ETIQ}.json`, JSON.stringify(bilan, null, 1));
}
