// Banc de la NAGE (monde.js, le souffle du Yak) : dans un monde de mer (Gallipoli par défaut), sans le
// souffle la mer arrête Camille ; avec lui, elle y entre et nage, à 0,9 m sous la surface du plan
// d'eau (celle que la marée des Pouilles déplace). Une capture de la nage.
//
//   bancs/tour.sh node bancs/monde-nage.mjs [page.html]
import { navigateur, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const PAGE = process.argv[2] || 'gallipoli.html';
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/' + PAGE);
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.TLOC.G.level && window.TLOC.G.level.mer, null, { timeout: 300000, polling: 300 });
await page.waitForTimeout(3000);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); });
// un bord de mer : autour du départ, le premier point de terre libre dont la direction mène à l'eau (plus de 30 cm)
const bord = await dans(() => { const T = TLOC, L = T.G.level, s = L.mer.position.y, p0 = T.player.pos;
  for (let r = 5; r < 400; r += 5) for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283, x = p0.x + Math.cos(a) * r, z = p0.z + Math.sin(a) * r;
    if (T.blocked(x, z, 0.5, false, T.getH(x, z) + 0.1) || T.getH(x, z) < s + 0.3) continue;
    for (let q = 0; q < 16; q++) { const b = q / 16 * 6.283, ux = Math.cos(b), uz = Math.sin(b);
      if (L.getH(x + ux * 14, z + uz * 14) < s - 0.3 && L.getH(x + ux * 24, z + uz * 24) < s - 0.3) return { x, z, ux, uz, s }; } }
  return null; });
verifier('un bord de mer trouvé', !!bord, JSON.stringify(bord && { x: Math.round(bord.x), z: Math.round(bord.z), s: +bord.s.toFixed(2) }));
const essai = () => dans((B) => { const T = TLOC, p = T.player.pos; p.set(B.x, T.getH(B.x, B.z), B.z);
  for (let k = 0; k < 80; k++) T.tryMove(p, B.ux * 0.3, B.uz * 0.3, 0.5, false);
  p.y = T.getH(p.x, p.z); return { d: +Math.hypot(p.x - B.x, p.z - B.z).toFixed(1), y: +p.y.toFixed(2) }; }, bord);
const sans = await essai();
verifier('sans le souffle, la mer arrête', sans.d < 14, JSON.stringify(sans));
await dans(() => { TLOC.state.souffle = true; });
const avec = await essai();
verifier('avec le souffle, on nage au large', avec.d > 20 && Math.abs(avec.y - (bord.s - 0.9)) < 0.15, JSON.stringify(avec));
await dans(() => { const T = TLOC; T.player.yaw = Math.atan2(-1, 0); });
await filmer(page, `monde-nage-${PAGE.replace('.html', '')}-${JOUR}.jpg`, [bord.x + bord.ux * 14, bord.s + 4, bord.z + bord.uz * 14], [bord.x + bord.ux * 24, bord.s, bord.z + bord.uz * 24], { camille: true });
const vraies = erreurs.filter((e) => !/favicon|Failed to load resource/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
