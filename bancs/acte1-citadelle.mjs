// Banc de l'ACTE I, la citadelle et Phinaert (étapes 9 et 10, docs/DECOUPAGE-ACTE1.md ;
// consigne B3 de PLAN-2026-10-05-ACTE1.md). On joue le morceau de bout en bout sans attendre
// les autres sessions : une sauvegarde posée à la main (le prologue fait, la lanterne et l'arc
// en poche, sortie de la poterne : state.acte1 = 'citadelle'), puis chaque moment clé, avec une
// capture et la vérification de l'état.
//
//   bancs/tour.sh node bancs/acte1-citadelle.mjs [http://127.0.0.1:8000]
//
// On déplace Camille en la posant (player.pos) : ce banc vérifie l'enchaînement de l'acte, pas
// les chemins (bancs/acces.mjs fait ça). Les flèches et les bombes, elles, partent du clavier
// (C, F, V) et volent par la machine du jeu ; les coups d'épée du Capitaine sont donnés par
// hitEnemy (un fantôme se bat comme tous les fantômes).
// Sortie : bancs/resultats/acte1-citadelle-<date>.json et -<moment>.jpg
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const DIR = fileURLToPath(new URL('resultats/', import.meta.url)), JOUR = new Date().toISOString().slice(0, 10);
const ANGLE = process.platform === 'darwin' ? 'metal' : 'd3d11';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const res = { date: new Date().toISOString(), etapes: [], erreurs: [] };
const ok = (nom, vrai, detail = '') => { res.etapes.push({ nom, ok: !!vrai, detail }); console.log(`${vrai ? '✔' : '✘'} ${nom}${detail ? ' — ' + detail : ''}`); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => { res.erreurs.push(e.message); console.log('PAGEERROR', e.message, (e.stack || '').split(/\n/).slice(1, 4).join(' | ')); });
  await page.goto(ORIGINE + '/connexion.html');
  // la sauvegarde de départ : ce que les étapes 1 à 8 auront donné
  await page.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    const flags = { sword: true, introSeen: true, metLyderic: true, prologueFait: true, acte1: 'citadelle', lanterne: true, fleches: 30,
      carteBeffroi: true, decouverts: {}, morceauCloche: true, lydericOsier: true };
    localStorage.setItem('tloc_save_v2', JSON.stringify({ v: 2, carte: 5, level: 'citadel', pos: [76, 0, 147], yaw: 0, camYaw: 0, hp: 12, maxHp: 12, time: 0, kills: 0, flags, levels: {} }));
    sessionStorage.setItem('tloc_auto', 'resume');
  });
  await page.goto(ORIGINE + '/index.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 200 });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const src = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
    window.__E = await import(src('/engine.js?v='));
    window.__C = await import(src('/citadelle.js'));
    const T = window.TLOC;
    // poser Camille en (x, z), tournée vers (ax, az)
    window.__poser = (x, z, ax, az, y = null) => { T.player.pos.set(x, y ?? T.getH(x, z, 40), z); const yaw = Math.atan2(ax - x, az - z); T.player.yaw = yaw; T.G.camYaw = yaw; T.player.vy = 0; };
    window.__parler = (re) => { const it = T.interactables.find((i) => (!i.enabled || i.enabled()) && re.test(typeof i.prompt === 'function' ? i.prompt() : i.prompt)); if (!it) return false; it.fn(); return true; };
    window.__soigner = () => { T.player.hp = T.player.maxHp; };
    // l'arc APRÈS le chargement : une sauvegarde qui l'a fait planter loadGame (engine.js lit
    // player.mesh.userData.bowBack, que la Camille riggée n'a pas — demandé dans PROMPT-REPRISE.md)
    T.state.bow = true;
  });
  // fait défiler la cinématique en cours (répliques et étapes chronométrées)
  const arc = (oui) => page.evaluate((o) => { window.TLOC.G.bowOut = o; }, oui);
  const finirCine = async (max = 60) => { for (let i = 0; i < max; i++) { const a = await page.evaluate(() => { if (!window.TLOC.cut.active) return false; window.TLOC.cutAdvance(true); return true; }); if (!a) return; await page.waitForTimeout(250); } };
  const photo = async (nom) => { await page.screenshot({ path: `${DIR}acte1-citadelle-${JOUR}-${nom}.jpg`, quality: 70 }); };
  // une prise cadrée : caméra posée en `cam`, visant `at` (la caméra de jeu reprend après)
  const prise = async (nom, cam, at) => {
    await page.evaluate(([c, a]) => { window.TLOC.G.freeCam = { pos: { x: c[0], y: c[1], z: c[2] }, at: { x: a[0], y: a[1], z: a[2] } }; }, [cam, at]);
    await page.waitForTimeout(500); await photo(nom); await page.evaluate(() => { window.TLOC.G.freeCam = null; });
  };
  const etat = () => page.evaluate(() => ({ acte1: TLOC.state.acte1, a1c: TLOC.state.a1c, bombes: TLOC.state.bombes, nb: TLOC.state.nbBombes, gate: TLOC.state.gateOpen }));
  const lieux = await page.evaluate(() => { const L = (() => { try { return null; } catch (e) { return null; } })(); return null; });

  // 0. l'arrivée : l'ancienne histoire est retirée, les soldats naissent
  await page.waitForTimeout(1500);
  const depart = await page.evaluate(() => ({
    kinds: TLOC.enemies.filter((e) => !e.dead).map((e) => e.kind + ':' + e.zone),
    obj: TLOC.G.level.objective(), repere: window.__C && null,
  }));
  ok('l’ancienne garnison de monstres est retirée (restent le champ et Phinaert)', depart.kinds.every((k) => /:champ$|^phinaert|^mouleReine|^corbelle|^capitaine|^soldatRonde/.test(k)), depart.kinds.join(', '));
  ok('l’objectif parle des soldats cachés', /soldats/.test(depart.obj), depart.obj);

  // les lieux du jeu (calculés par citadelle.js) : on les relit par l'objectif et les PNJ
  const P = await page.evaluate(() => {
    const T = window.TLOC, gens = {};
    // les PNJ de l'acte : leurs invites
    for (const i of T.interactables) { const p = typeof i.prompt === 'function' ? i.prompt() : ''; if (/caporal|tambour|vieux soldat|armurier/.test(p)) gens[p] = [i.pos.x, i.pos.y, i.pos.z]; }
    return { gens, repere: (window.__E && null) };
  });
  const posDe = (re) => { const k = Object.keys(P.gens).find((x) => re.test(x)); return k ? P.gens[k] : null; };
  const cap = posDe(/caporal/);
  ok('le caporal, le tambour et le vieux soldat sont là', cap && posDe(/tambour/) && posDe(/vieux/), JSON.stringify(P.gens));

  // 1. les soldats cachés
  if (cap) {
    // (E3, 7 octobre : les soldats sont DANS la caserne, la chambrée — on entre par la porte de la façade)
    const entre = await page.evaluate(() => { const it = TLOC.interactables.find((i) => /entrer dans la caserne/.test(i.prompt()) && (!i.enabled || i.enabled())); if (!it) return false; it.fn(); return true; });
    await page.waitForTimeout(800);
    ok('la porte de la caserne mène à la chambrée', entre && await page.evaluate(() => TLOC.player.pos.y > 400), '');
    const t = posDe(/tambour/), v = posDe(/vieux/);
    const cx = (cap[0] + t[0] + v[0]) / 3, cz = (cap[2] + t[2] + v[2]) / 3;
    // en face d'eux, à 7 m
    const dx = cap[0] - (t[0] + v[0]) / 2, dz = cap[2] - (t[2] + v[2]) / 2, l = Math.hypot(dx, dz) || 1;
    await page.evaluate(([x, z, ax, az]) => window.__poser(x, z, ax, az), [cx + dx / l * 7, cz + dz / l * 7, cx, cz]);
    await page.waitForTimeout(1200);
    await prise('1-soldats', [cx + dx / l * 9, cap[1] + 2.4, cz + dz / l * 9 + 2], [cx, cap[1] + 1.2, cz]);
    for (const [nom, re] of [['caporal', /caporal/], ['tambour', /tambour/], ['vieux', /vieux soldat/], ['vieux (revenu)', /vieux soldat/]]) {
      const p = posDe(re); await page.evaluate(([x, z]) => window.__poser(x + 1.2, z + 1.2, x, z), [p[0], p[2]]); await page.waitForTimeout(300);
      const parle = await page.evaluate((s) => window.__parler(new RegExp(s)), re.source);
      const txt = await page.evaluate(() => document.getElementById('cinetxt')?.textContent || document.querySelector('#cine .txt, #cinesub')?.textContent || '');
      await finirCine();
      ok(`parler au ${nom}`, parle, txt.slice(0, 90));
    }
    // et l'on ressort de la caserne
    await page.evaluate(() => { const it = TLOC.interactables.find((i) => /sortir de la caserne/.test(i.prompt()) && (!i.enabled || i.enabled())); if (it) it.fn(); });
    await page.waitForTimeout(600);
    ok('on ressort sur la place d’Armes', await page.evaluate(() => TLOC.player.pos.y < 300), '');
    const e1 = await etat();
    ok('les soldats ont tout dit (créatures, nuit, armurier, poudre)', e1.a1c && e1.a1c.caporal && e1.a1c.tambour && e1.a1c.vieux && e1.a1c.poudre, JSON.stringify(e1.a1c));
  }

  // 2. l'armurerie : une flèche dans la poudre
  const arm = await page.evaluate(() => { const o = TLOC.G.level.objective(); return o; });
  ok('l’objectif mène à la poudre de l’armurerie', /poudre/.test(arm), arm);
  const poudre = await page.evaluate(() => { const T = window.TLOC; const it = T.interactables.find((i) => { const p = typeof i.prompt === 'function' ? i.prompt() : ''; return /armurier/.test(p); }); return it ? [it.pos.x, it.pos.y, it.pos.z] : null; });
  // la poudre est posée à 2,6 m le long de la façade depuis la porte, l'armurier à 1,2 m de l'autre côté :
  // on la cherche dans la scène, par son poids (trois tonneaux)
  const pp = await page.evaluate(() => {
    let best = null;
    window.TLOC.scene.traverse((o) => { if (o.isGroup && o.children.length === 9 && o.userData.dynamic && o.children[0].geometry && o.children[0].geometry.type === 'CylinderGeometry') best = [o.position.x, o.position.y, o.position.z]; });
    return best;
  });
  ok('la barricade et la poudre sont posées', !!pp, JSON.stringify(pp));
  if (pp && poudre) {
    // en retrait de 9 m, du côté de l'armurier (devant la façade)
    const nx = poudre[0] - pp[0], nz = poudre[2] - pp[2], l = Math.hypot(nx, nz) || 1;
    // devant la porte : on se met sur la normale, en reculant depuis l'armurier
    await page.evaluate(([x, z, ax, az, y]) => window.__poser(x, z, ax, az, y), [pp[0] + nx / l * 2 + (poudre[0] - pp[0]) * 0.0 + 6, pp[2] + nz / l * 2 + 6, pp[0], pp[2], pp[1] + 0.1]);
    await page.waitForTimeout(800);
    // on vise la poudre depuis 7 m devant elle, perpendiculairement à la façade
    const vise = await page.evaluate(([x, y, z]) => {
      const T = window.TLOC; let best = null;
      for (let a = 0; a < 32; a++) for (const r of [6, 8, 10]) { const px = x + Math.cos(a / 32 * Math.PI * 2) * r, pz = z + Math.sin(a / 32 * Math.PI * 2) * r;
        const h = T.getH(px, pz, y + 1); if (Math.abs(h - y) > 0.6 || T.blocked(px, pz, 0.5, false, h)) continue;
        let libre = true; for (let t = 0.15; t < 0.85; t += 0.05) if (T.blocked(px + (x - px) * t, pz + (z - pz) * t, 0.05, true, y + 1.4)) libre = false;
        if (libre && (!best || r < best[2])) best = [px, pz, r]; }
      return best;
    }, pp);
    ok('un endroit d’où tirer dans la poudre', !!vise, JSON.stringify(vise));
    if (vise) {
      await page.evaluate(([x, z, ax, az, y]) => window.__poser(x, z, ax, az, y), [vise[0], vise[1], pp[0], pp[2], pp[1] + 0.1]);
      await page.waitForTimeout(600); await photo('2-armurerie-barricadee');
      await arc(true); await page.waitForTimeout(300);
      for (let k = 0; k < 4 && !(await etat()).a1c.porte; k++) { await page.evaluate(([x, z, ax, az, y]) => window.__poser(x, z, ax, az, y), [vise[0], vise[1], pp[0], pp[2], pp[1] + 0.1]); await page.keyboard.press('KeyF'); await page.waitForTimeout(900); }
      await page.waitForTimeout(800); await photo('3-armurerie-sautee');
      ok('la flèche fait sauter la porte de l’armurerie', (await etat()).a1c.porte);
      await page.waitForTimeout(1200); await finirCine();
      await arc(false);
    }
  }
  // l'armurier
  { const a = await page.evaluate(() => { const it = window.TLOC.interactables.find((i) => (!i.enabled || i.enabled()) && /armurier/.test(typeof i.prompt === 'function' ? i.prompt() : '')); return it ? [it.pos.x, it.pos.y, it.pos.z] : null; });
    ok('l’armurier sort', !!a, JSON.stringify(a));
    if (a) { await page.evaluate(([x, y, z]) => window.__poser(x + 1.5, z + 1.5, x, z, y + 0.1), a); await page.waitForTimeout(800);
      await prise('4-armurier', [a[0] + 5, a[1] + 2.5, a[2] + 5], [a[0], a[1] + 1.4, a[2]]);
      await page.evaluate(() => window.__parler(/armurier/)); await finirCine(); }
    const e = await etat(); ok('les bombes (étape bombes)', e.bombes && e.nb === 10 && e.acte1 === 'bombes', `${e.acte1}, ${e.nb} bombes`);
  }

  // 3. la Moule-Reine, depuis le pont de la Porte Royale
  await page.evaluate(() => window.__soigner());
  const reine = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'mouleReine'); return e ? [e.pos.x, e.pos.y, e.pos.z] : null; });
  ok('la Moule-Reine est dans le fossé', !!reine, JSON.stringify(reine));
  if (reine) {
    await page.evaluate(([x, y, z]) => window.__poser(1.8, z, x, z), reine); await page.waitForTimeout(1500);
    await prise('5-moule-reine', [reine[0] - 7, 4, reine[2] + 12], [reine[0], 0.5, reine[2]]);
    // une bombe fermée : la coquille tient
    for (let k = 0; k < 8; k++) {
      // on attend qu'elle s'ouvre pour cracher, et on lance
      await page.waitForFunction(() => { const e = TLOC.enemies.find((x) => x.kind === 'mouleReine'); return !e || e.dead || (e.ouverte && e.cycle < 0.3); }, null, { timeout: 15000, polling: 50 }).catch(() => {});
      await page.evaluate(([x, y, z]) => { window.__soigner(); window.__poser(1.8, z, x, z); }, reine);
      await page.keyboard.press('KeyV');
      await page.waitForTimeout(2300);
      const r = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'mouleReine'); return e ? { hp: e.hp, fendue: !!e.fendue, dead: e.dead } : null; });
      if (k === 0) await photo('6-bombe-reine');
      if (!r || r.dead || r.fendue) break;
    }
    const r1 = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'mouleReine'); return e ? { hp: e.hp, fendue: !!e.fendue, dead: e.dead } : null; });
    ok('une bombe lancée quand elle crache fend la coquille', r1 && (r1.fendue || r1.dead), JSON.stringify(r1));
    // puis d'autres bombes : fendue, elle les prend à tout moment (l'arc ne passe pas le garde-corps du pont)
    for (let k = 0; k < 6; k++) { const d = await page.evaluate(() => (TLOC.state.a1c.morts || {}).reine); if (d) break; await page.evaluate(([x, y, z]) => { window.__soigner(); window.__poser(1.8, z, x, z); }, reine); await page.keyboard.press('KeyV'); await page.waitForTimeout(2300); }
    ok('la Moule-Reine est vaincue', await page.evaluate(() => !!(TLOC.state.a1c.morts || {}).reine));
    await page.waitForTimeout(1200);
    const cle = await page.evaluate(() => TLOC.state.a1c.clesPos.reine);
    if (cle) { await page.evaluate(([x, z]) => window.__poser(x, z + 4, x, z), cle); await page.waitForTimeout(500); await photo('7-cle-reine'); await page.evaluate(([x, z]) => window.__poser(x, z, x, z - 1), cle); await page.waitForTimeout(800); await finirCine(); }
    ok('sa clé est ramassée, avec le billet d’Eugène', await page.evaluate(() => !!TLOC.state.a1c.cles.reine));
  }

  // 4. la Grande Corbelle, sur la pointe de Turenne
  await page.evaluate(() => window.__soigner());
  const corb = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'corbelle'); return e ? [e.pos.x, e.pos.y, e.pos.z] : null; });
  ok('la Grande Corbelle tourne au-dessus de Turenne', !!corb && corb[1] > 12, JSON.stringify(corb));
  if (corb) {
    // là où l'on peut se tenir sous elle (la bande praticable du terre-plein), tourné vers son cercle
    const centre = await page.evaluate(() => { const c = window.__C.ACTE1_CITADELLE.lieux().corbelle; return [c.pied[0], c.pied[1], c.x, c.z]; });
    // au centre de son cercle, sur le terre-plein
    const C = await page.evaluate(() => window.__C && null);
    await page.evaluate(([x, z, cx, cz]) => window.__poser(x, z, cx, cz), centre); await page.waitForTimeout(1000); await photo('8-corbelle');
    await prise('8b-corbelle', [centre[0] + 5, 8, centre[1] + 16], [centre[2], 15, centre[3]]);
    await arc(true);
    let fleches = 0;
    for (let k = 0; k < 30; k++) {
      if (await page.evaluate(() => !!(TLOC.state.a1c.morts || {}).corbelle)) break;
      await page.evaluate(() => { window.__soigner(); const e = TLOC.enemies.find((x) => x.kind === 'corbelle'); const p = TLOC.player.pos; const yaw = Math.atan2(e.pos.x - p.x, e.pos.z - p.z); TLOC.player.yaw = yaw; TLOC.G.camYaw = yaw; });
      await page.keyboard.press('KeyF'); fleches++; await page.waitForTimeout(800);
    }
    await arc(false);
    ok('la Corbelle tombe à l’arc', await page.evaluate(() => !!(TLOC.state.a1c.morts || {}).corbelle), `${fleches} flèches tirées`);
    await page.waitForTimeout(1200);
    const cle = await page.evaluate(() => TLOC.state.a1c.clesPos.corbelle);
    if (cle) { await page.evaluate(([x, z]) => window.__poser(x, z, x, z - 1), cle); await page.waitForTimeout(800); await finirCine(); }
    ok('sa clé est ramassée', await page.evaluate(() => !!TLOC.state.a1c.cles.corbelle));
  }

  // 5. le Capitaine sans tête : de jour, personne ; la nuit (le lit de Camille, house.js : state.nuit), sa ronde
  await page.evaluate(() => window.__soigner());
  { const r = await page.evaluate(() => window.__C.ACTE1_CITADELLE.lieux().ronde);
    await page.evaluate(([x, z]) => window.__poser(x + 14, z + 2, x, z), [r.x, r.z]); await page.waitForTimeout(1200);
    ok('de jour, la ronde est vide', await page.evaluate(() => !TLOC.enemies.some((x) => x.kind === 'capitaine')));
    ok('de jour, l’objectif envoie dormir', /dors chez toi/.test(await page.evaluate(() => TLOC.G.level.objective())), await page.evaluate(() => TLOC.G.level.objective()));
    await page.evaluate(() => { TLOC.state.nuit = true; }); }
  await page.waitForTimeout(1500);
  const capi = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'capitaine'); return e ? [e.pos.x, e.pos.y, e.pos.z] : null; });
  ok('le Capitaine fait sa ronde (à la lanterne)', !!capi, JSON.stringify(capi));
  if (capi) {
    await page.evaluate(([x, y, z]) => window.__poser(x + 14, z + 2, x, z), capi); await page.waitForTimeout(1500);
    await photo('9-capitaine');
    await finirCine();
    { const c = await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'capitaine'); return [e.pos.x, e.pos.y, e.pos.z]; });
      await prise('9b-capitaine', [c[0] + 6, c[1] + 3, c[2] + 6], [c[0], c[1] + 2.2, c[2]]); }
    ok('il parle quand la lanterne le trouve', await page.evaluate(() => TLOC.enemies.find((x) => x.kind === 'capitaine').parle));
    await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'capitaine'); TLOC.hitEnemy(e, 99, e.pos.x + 1, e.pos.z); });
    await page.waitForTimeout(1200);
    ok('le Capitaine et sa ronde tombent', await page.evaluate(() => !!TLOC.state.a1c.morts.capitaine && TLOC.enemies.filter((x) => x.kind === 'soldatRonde' && !x.dead).length === 0));
    const cle = await page.evaluate(() => TLOC.state.a1c.clesPos.capitaine);
    if (cle) { await page.evaluate(([x, z]) => window.__poser(x, z, x, z - 1), cle); await page.waitForTimeout(800); await finirCine(); }
    ok('sa clé est ramassée', await page.evaluate(() => !!TLOC.state.a1c.cles.capitaine));
  }

  // 6. les cadenas du donjon
  const D = await page.evaluate(() => window.__E && null);
  await page.evaluate(() => window.__poser(0, 26, 0, 0)); await page.waitForTimeout(800); await photo('10-cadenas');
  ok('l’objectif : les trois cadenas', /cadenas/.test(await page.evaluate(() => TLOC.G.level.objective())));
  await page.evaluate(() => window.__parler(/cadenas/)); await page.waitForTimeout(300); await finirCine(); await page.waitForTimeout(2500);
  { const e = await etat(); ok('la grille du donjon s’ouvre (étape donjon)', e.gate && e.acte1 === 'donjon', `${e.acte1}, cadenas ${e.a1c.cadenas}`); }
  await photo('11-grille-ouverte');

  // 7. Phinaert : l'entrée, la cloche, la corde, la porte de lumière
  if (!(await etat()).gate) throw new Error('la grille du donjon est restée fermée : la fin ne se joue pas');
  await page.evaluate(() => window.__poser(0, 12, 0, -10)); await page.waitForTimeout(800);
  await photo('12-phinaert'); await finirCine();
  await prise('12b-enclos', [18, 8, 22], [0, 4, -8]);
  ok('Phinaert parle à l’entrée', await page.evaluate(() => !!TLOC.state.a1c.vu));
  await page.evaluate(() => { const b = TLOC.enemies.find((e) => e.k.boss); TLOC.hitEnemy(b, 14, b.pos.x, b.pos.z + 3); window.__soigner(); });
  await page.waitForTimeout(800); await finirCine(); await page.waitForTimeout(2500);
  ok('à mi-vie, il sonne la cloche (la corde est une cible)', await page.evaluate(() => TLOC.enemies.some((e) => e.kind === 'cordeCloche' && !e.dead)));
  await page.evaluate(() => { const e = TLOC.enemies.find((x) => x.kind === 'cordeCloche'); window.__poser(e.pos.x - 6, e.pos.z + 10, e.pos.x, e.pos.z); });
  await page.waitForTimeout(1500); await photo('13-cloche');
  await prise('13b-cloche', [14, 10, 6], [3, 12, -12]);
  await arc(true);
  for (let k = 0; k < 10; k++) {
    if (await page.evaluate(() => !!TLOC.state.a1c.cloche)) break;
    await page.evaluate(() => { window.__soigner(); const e = TLOC.enemies.find((x) => x.kind === 'cordeCloche'); if (e) window.__poser(e.pos.x - 6, e.pos.z + 10, e.pos.x, e.pos.z); });
    await page.keyboard.press('KeyF'); await page.waitForTimeout(80);
    const d = await page.evaluate(() => { const T = window.TLOC, c = T.enemies.find((x) => x.kind === 'cordeCloche'); return { fl: T.arrows.length, arc: T.G.bowOut, cut: T.cut.active, fleches: T.state.fleches, corde: c ? c.hp : 'coupée', p: [T.player.pos.x.toFixed(1), T.player.pos.z.toFixed(1)] }; });
    console.log('   tir', k, JSON.stringify(d)); await page.waitForTimeout(600);
  }
  await arc(false);
  ok('une flèche coupe la corde, la cloche se tait', await page.evaluate(() => !!TLOC.state.a1c.cloche));
  await page.evaluate(() => { const b = TLOC.enemies.find((e) => e.k.boss); window.__poser(b.pos.x + 6, b.pos.z + 6, b.pos.x, b.pos.z); TLOC.hitEnemy(b, b.hp - 7, b.pos.x, b.pos.z + 3); window.__soigner(); });
  await page.waitForTimeout(600);
  // la fin : on la laisse jouer (Phinaert et Eugène marchent), en avançant les répliques
  for (let k = 0; k < 80; k++) {
    const s = await page.evaluate(() => { const c = TLOC.cut; if (c.active && c.cur && c.cur.say !== undefined) TLOC.cutAdvance(true); return { cut: c.active, i: c.i, parti: !!TLOC.state.a1c.parti }; });
    if (k === 22) await photo('14-porte-de-lumiere');
    if (s.parti && !s.cut) break;
    await page.waitForTimeout(300);
  }
  ok('Phinaert emmène Eugène dans la porte de lumière', await page.evaluate(() => !!TLOC.state.a1c.parti && !TLOC.enemies.some((e) => e.k.boss)));
  await page.evaluate(() => window.__poser(0, 4, 0, -5)); await page.waitForTimeout(1000); await photo('15-suivre');
  await prise('15b-porte', [7, 3.5, 6], [0, 2.5, -5]);
  ok('l’objectif : suivre Phinaert', /lumière/.test(await page.evaluate(() => TLOC.G.level.objective())));
  await page.evaluate(() => window.__poser(0, -3.5, 0, -5)); await page.waitForTimeout(300);
  await page.evaluate(() => window.__parler(/suivre Phinaert/));
  await page.waitForTimeout(4000);
  // depuis la citadelle, l'île s'ouvre dans un cadre par-dessus la ville (engine.js, ouvrirInterieur)
  const fin = await page.evaluate(() => { let a = null; try { a = JSON.parse(localStorage.getItem('tloc_save_v2')).flags.acte1; } catch (e) {}
    const f = document.querySelector('iframe'); return { acte1: a, ou: f ? f.getAttribute('src') : location.pathname }; });
  ok('on passe à l’île du temps, l’acte I est fini (étape temple)', /temple/.test(fin.ou) && fin.acte1 === 'temple', JSON.stringify(fin));
  await page.waitForTimeout(8000); await photo('16-ile-du-temps');
} catch (e) {
  console.log('ARRÊT :', e.message); res.arret = e.message;
} finally {
  await browser.close();
  fs.writeFileSync(`${DIR}acte1-citadelle-${JOUR}.json`, JSON.stringify(res, null, 1));
  const ko = res.etapes.filter((e) => !e.ok).length;
  console.log(`\n${res.etapes.length - ko}/${res.etapes.length} étapes, ${res.erreurs.length} erreur(s) de page`);
}
