// Banc d'ACCESSIBILITÉ : peut-on atteindre, à pied, tout ce qui se présente à Camille ?
//
// Depuis son point de départ, on inonde la carte aux règles de Camille — rayon 0,5 m, une
// marche de moins de 0,5 m se monte, un obstacle de moins de 1,3 m se saute si l'on peut
// retomber dessus ou derrière (le saut monte à 1,53 m), l'eau profonde arrête (blocked) —
// puis on liste les interactions (PNJ, coffres, portes, boutiques : `interactables`) qu'aucune
// case atteinte ne met à portée, avec le critère même du jeu (distance < rayon, moins de 3 m
// d'écart de hauteur). Il aurait trouvé seul la mezzanine inaccessible de la maison.
// Deux étages par case (un pont et le chemin qui passe dessous), une case d'un mètre.
//
//   node bancs/acces.mjs [page, défaut toutes] [http://127.0.0.1:8000]
//     pages : index house tavern chapelle mage cave
//
// Écrit bancs/resultats/acces-<date>.json ; le résumé s'affiche.
import { createRequire } from 'module';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs';
const PAGES = process.argv[2] && !process.argv[2].startsWith('http') ? [process.argv[2]] : ['index', 'house', 'tavern', 'chapelle', 'mage', 'cave'];
const ORIGINE = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8000';
// sur le PC, Playwright est dans GitHub/tloc/outils (5 octobre)
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const DIR = fileURLToPath(new URL('resultats/', import.meta.url)), JOUR = new Date().toISOString().slice(0, 10);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const bilan = {};
for (const nom of PAGES) {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.on('pageerror', (e) => console.log(`[${nom}] [pageerror]`, e.message));
  await page.goto(`${ORIGINE}/${nom}.html`);
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 200 });
  // une partie neuve, sans l'ouverture scénarisée : Camille à son point de départ
  await page.evaluate(() => { TLOC.state.introSeen = true; if (TLOC.menu.active && TLOC.menu.items[0]) TLOC.menu.items[0].fn(); });
  await page.waitForTimeout(2500);
  const t0 = Date.now();
  const r = await page.evaluate(() => {
    const { world, getH, blocked, player, interactables, G } = TLOC;
    const dedans = !G.level || G.level.name !== 'citadel';   // un intérieur : petit, et qu'on détaille
    // une case d'un mètre dehors (la carte fait 2,6 km), de 25 cm dans les intérieurs (portes, escaliers)
    const PAS = dedans ? 0.25 : 1, R = 0.5, MONTE = 0.5, SAUT = 1.3;
    // l'emprise : celle du niveau (world.bounds dit ce qui est dehors) — on cherche une boîte
    // autour du départ, élargie tant qu'elle touche encore du praticable
    // le départ : là où est Camille, ou le point libre le plus proche (le jeu la dégage de même,
    // unstick() : à l'estaminet elle apparaît dans la collision de la porte)
    let sx = player.pos.x, sz = player.pos.z;
    if (blocked(sx, sz, 0.5, false, player.pos.y)) {
      trouve: for (let r = 0.25; r <= 4; r += 0.25) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
        if (!blocked(x, z, 0.5, false, player.pos.y) && Math.abs(getH(x, z, player.pos.y) - player.pos.y) < 0.6) { sx = x; sz = z; break trouve; } }
    }
    let D = 40; const dehors = (x, z) => world.bounds && world.bounds(x, z);
    if (!dedans) D = 1300;                              // la carte : l'enceinte (levelBlocked) la borne
    for (let essai = 0; essai < 6 && world.bounds; essai++) {
      let bord = false;
      for (let k = 0; k < 64 && !bord; k++) { const a = k / 64 * Math.PI * 2; if (!dehors(sx + Math.cos(a) * D, sz + Math.sin(a) * D)) bord = true; }
      if (!bord) break; D *= 2;
    }
    D = Math.min(D, dedans ? 60 : 1300);
    const x0 = sx - D, z0 = sz - D, N = Math.ceil(2 * D / PAS);
    // deux étages par case : la hauteur de chacun, et s'il est atteint
    const H1 = new Float32Array(N * N).fill(NaN), H2 = new Float32Array(N * N).fill(NaN);
    const file = [];
    const poser = (k, y) => {
      if (Number.isNaN(H1[k])) { H1[k] = y; file.push(k, 0); return; }
      if (Math.abs(H1[k] - y) < 1.5) return;
      if (Number.isNaN(H2[k])) { H2[k] = y; file.push(k, 1); return; }
    };
    const i0 = Math.floor((sx - x0) / PAS), j0 = Math.floor((sz - z0) / PAS);
    poser(j0 * N + i0, getH(sx, sz, player.pos.y + 0.5));
    let pas = 0;
    // un escalier raide monte d'un mètre par mètre : d'une case à l'autre, c'est un mur ; Camille,
    // elle, avance par petits pas. Quand la marche est trop haute d'un coup, on refait le trajet
    // en sous-pas de 25 cm, chacun à la hauteur atteinte au précédent.
    const aPetitsPas = (xa, za, y, x, z) => {
      const n = Math.max(1, Math.round(PAS / 0.25));
      for (let s2 = 1; s2 <= n; s2++) {
        const xs = xa + (x - xa) * s2 / n, zs = za + (z - za) * s2 / n, h = getH(xs, zs, y + MONTE);
        if (h - y >= MONTE || blocked(xs, zs, R, false, y)) return null;
        y = h;
      }
      return y;
    };
    while (file.length) {
      const e = file.pop(), k = file.pop(), y = e ? H2[k] : H1[k], i = k % N, j = (k - i) / N;
      const xa = x0 + (i + 0.5) * PAS, za = z0 + (j + 0.5) * PAS;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const x = x0 + (a + 0.5) * PAS, z = z0 + (b + 0.5) * PAS; pas++;
        if (dehors(x, z)) continue;
        // à pied : le sol à portée de marche
        let h = getH(x, z, y + MONTE);
        if (h - y < MONTE && !blocked(x, z, R, false, y)) { poser(b * N + a, h); continue; }
        if (PAS > 0.25) { const hp = aPetitsPas(xa, za, y, x, z); if (hp !== null) { poser(b * N + a, hp); continue; } }
        // en sautant : au-dessus de ce qui est bas, on retombe sur le dessus ou derrière
        h = getH(x, z, y + SAUT);
        if (h - y < SAUT && !blocked(x, z, R, false, y + SAUT)) poser(b * N + a, h);
      }
    }
    // les interactions : une case atteinte à portée, au critère du jeu
    const hors = [], ok = [];
    for (const it of interactables) {
      if (it.enabled && !it.enabled()) continue;
      const ci = Math.floor((it.pos.x - x0) / PAS), cj = Math.floor((it.pos.z - z0) / PAS), rr = Math.ceil(it.r / PAS);
      let atteint = false;
      for (let b = cj - rr; b <= cj + rr && !atteint; b++) for (let a = ci - rr; a <= ci + rr && !atteint; a++) {
        if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const k = b * N + a, x = x0 + (a + 0.5) * PAS, z = z0 + (b + 0.5) * PAS;
        if (Math.hypot(it.pos.x - x, it.pos.z - z) >= it.r) continue;
        for (const y of [H1[k], H2[k]]) if (!Number.isNaN(y) && Math.abs(it.pos.y - y) < 3) atteint = true;
      }
      let texte = ''; try { texte = typeof it.prompt === 'function' ? it.prompt() : String(it.prompt || ''); } catch (e) { texte = '?'; }
      const fiche = { quoi: texte, x: +it.pos.x.toFixed(1), y: +it.pos.y.toFixed(1), z: +it.pos.z.toFixed(1), r: it.r, zone: world.zoneName ? world.zoneName(it.pos.x, it.pos.z) : '' };
      (atteint ? ok : hors).push(fiche);
    }
    // SECONDE PASSE, fine : un escalier en colimaçon (beffroi, donjon), une rampe étroite, ne
    // passent pas en cases d'un mètre — la maison et sa mezzanine l'ont montré. Pour chaque
    // interaction non atteinte, on inonde à 25 cm un carré de 120 m autour d'elle, en partant
    // des cases déjà atteintes qui s'y trouvent (à leur hauteur).
    const finesAtteintes = [];
    if (!dedans) for (const f of hors.slice()) {
      // autant d'étages qu'il en faut : un colimaçon empile onze tours sur les mêmes cases, et
      // deux étages par case arrêtaient l'inondation au deuxième (le beffroi « inaccessible »)
      const P2 = 0.25, D2 = 60, N2 = Math.ceil(2 * D2 / P2), fx0 = f.x - D2, fz0 = f.z - D2;
      const vus = new Map(), pile = [];
      const cle = (k, y) => k * 256 + Math.round(y / 1.2) + 100;
      const mettre = (k, y) => { const c = cle(k, y); if (vus.has(c)) return; vus.set(c, y); pile.push(k, y); };
      for (let b = Math.floor((fz0 - z0) / PAS); b <= Math.floor((fz0 + 2 * D2 - z0) / PAS); b++) for (let a = Math.floor((fx0 - x0) / PAS); a <= Math.floor((fx0 + 2 * D2 - x0) / PAS); a++) {
        if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const k = b * N + a, x = x0 + (a + 0.5) * PAS, z = z0 + (b + 0.5) * PAS, i2 = Math.floor((x - fx0) / P2), j2 = Math.floor((z - fz0) / P2);
        if (i2 < 0 || j2 < 0 || i2 >= N2 || j2 >= N2) continue;
        for (const y of [H1[k], H2[k]]) if (!Number.isNaN(y)) mettre(j2 * N2 + i2, y);
      }
      while (pile.length) {
        const y = pile.pop(), k = pile.pop(), i = k % N2, j = (k - i) / N2;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N2 || b >= N2) continue;
          const x = fx0 + (a + 0.5) * P2, z = fz0 + (b + 0.5) * P2;
          let h = getH(x, z, y + MONTE);
          if (h - y < MONTE && !blocked(x, z, R, false, y)) { mettre(b * N2 + a, h); continue; }
          h = getH(x, z, y + SAUT);
          if (h - y < SAUT && !blocked(x, z, R, false, y + SAUT)) mettre(b * N2 + a, h);
        }
      }
      let ok2 = false;
      const ci = Math.floor((f.x - fx0) / P2), cj = Math.floor((f.z - fz0) / P2), rr = Math.ceil(f.r / P2);
      for (const [c, y] of vus) {
        if (ok2) break;
        const k = Math.floor(c / 256), a = k % N2, b = (k - a) / N2;
        if (Math.abs(a - ci) > rr || Math.abs(b - cj) > rr) continue;
        if (Math.hypot(f.x - (fx0 + (a + 0.5) * P2), f.z - (fz0 + (b + 0.5) * P2)) < f.r && Math.abs(f.y - y) < 3) ok2 = true;
      }
      // pour le rapport : la case atteinte la plus proche (où l'on bute), et sa hauteur
      if (!ok2) { let m = null; for (const [c, y] of vus) { const k = Math.floor(c / 256), a = k % N2, b = (k - a) / N2, x = fx0 + (a + 0.5) * P2, z = fz0 + (b + 0.5) * P2, d = Math.hypot(f.x - x, f.z - z);
        if (!m || d < m.d) m = { d: +d.toFixed(1), x: +x.toFixed(1), y: +y.toFixed(2), z: +z.toFixed(1) }; } f.auPlusPres = m; f.solIci = +getH(f.x, f.z, f.y + 1).toFixed(2); }
      if (ok2) { hors.splice(hors.indexOf(f), 1); ok.push(f); finesAtteintes.push(f.quoi); }
    }
    let atteintes = 0; for (let k = 0; k < N * N; k++) if (!Number.isNaN(H1[k])) atteintes++;
    return { cases: atteintes, m2: atteintes * PAS * PAS, cote: 2 * D, essais: pas, interactions: ok.length + hors.length, hors, finesAtteintes };
  });
  r.secondes = +((Date.now() - t0) / 1000).toFixed(1);
  bilan[nom] = r;
  console.log(`\n== ${nom} : ${r.interactions} interactions, ${r.hors.length} hors d'atteinte — ${Math.round(r.m2)} m² parcourus en ${r.secondes} s`);
  for (const h of r.hors) console.log(`   ✗ « ${h.quoi} »  (${h.x}, ${h.y}, ${h.z})  r ${h.r}  ${h.zone}${h.auPlusPres ? `  — au plus près : ${h.auPlusPres.d} m, en (${h.auPlusPres.x}, ${h.auPlusPres.y}, ${h.auPlusPres.z}) ; sol sous l'objet ${h.solIci}` : ''}`);
  if (r.finesAtteintes && r.finesAtteintes.length) console.log(`   (à la passe fine : ${r.finesAtteintes.join(', ')})`);
  await page.close();
}
fs.writeFileSync(DIR + `acces-${JOUR}.json`, JSON.stringify(bilan, null, 1));
await browser.close();
