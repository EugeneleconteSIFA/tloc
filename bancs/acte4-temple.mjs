// Banc du retour au Temple après l'acte IV (temple.js, DECISIONS-RECIT.md § 3) : la Cloche des
// Heures pendue au troisième étage, le grand cadran, la scène du mage une fois, puis `temple`. Une
// partie qui recharge l'île après la scène ne la rejoue pas. Captures ; aucune pageerror.
//
//   bancs/tour.sh node bancs/acte4-temple.mjs
import { navigateur, partieActe1, filmer, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
const charge = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000, polling: 300 });
const lireCut = async () => { const lu = []; for (let k = 0; k < 40; k++) { const r = await page.evaluate(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? `${c.who || ''} : ${c.say}` : ''; T.cutAdvance(true); return s; }); if (r === null) { if (lu.length) break; await page.waitForTimeout(300); continue; } if (r) lu.push(r); await page.waitForTimeout(150); } return lu; };
// les cloches pendues : les tours de révolution (LatheGeometry) au-dessus de 12 m
const cloches = () => page.evaluate(() => { let n = 0; TLOC.scene.traverse((o) => { if (o.isMesh && o.geometry.type === 'LatheGeometry') { const p = new TLOC.THREE.Vector3(); o.getWorldPosition(p); if (p.y > 12) n++; } }); return n; });

try {
  await partieActe1(page, { acte1: 'temple', templeVu: true, bow: true, lanterne: true, acte4: 'heures', tambourin: true, elan: true });
  await page.goto(ORIGINE + '/temple.html'); await charge(); await page.waitForTimeout(2500);
  const lu = await lireCut();
  ok('la scène du retour : la Cloche des Heures, le cadran, la Lozère', lu.some((r) => /Cloche des Heures/.test(r)) && lu.some((r) => /cadran/.test(r)) && lu.some((r) => /Lozère/.test(r)), lu.join(' | '));
  ok('l’acte IV passe à `temple`', await page.evaluate(() => TLOC.state.acte4 === 'temple'));
  ok('une cloche pendue dans la tour', (await cloches()) >= 1, (await cloches()) + ' cloche(s)');
  await filmer(page, `acte4-temple-${JOUR}-tour.jpg`, [10, 6, 24], [0, 22, 6]);
  // recharger : la scène ne se rejoue pas, la cloche reste pendue
  await page.goto(ORIGINE + '/temple.html'); await charge(); await page.waitForTimeout(3000);
  ok('au retour suivant : pas de seconde scène', !(await page.evaluate(() => TLOC.cut.active)));
  ok('au retour suivant : la cloche toujours pendue', (await cloches()) >= 1);
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `acte4-temple-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
