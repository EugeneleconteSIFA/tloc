// Banc de l'acte I, le bourg (étape 2) : chaque témoin est-il en vue, devant ce dont il parle,
// et dit-il la bonne réplique ? Une capture par témoin, de face, à hauteur d'homme et de haut.
//
//   bancs/tour.sh node bancs/acte1-bourg.mjs [étiquette]
import { navigateur, partieActe1, parler, filmer, filmerSujet, JOUR } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'bourg';
const { b, page, erreurs } = await navigateur();
await partieActe1(page, { metLyderic: true, ind: { crypte: true, crypteNoire: true, lanterne: true } });
const gens = await page.evaluate(async () => { const { PARTAGE } = await import('./etat.js'); const o = {};
  for (const [k, v] of Object.entries(PARTAGE.gensActe1 || {})) o[k] = [v.position.x, v.position.y, v.position.z, v.rotation.y];
  if (PARTAGE.estaminet) o.estaminet = [PARTAGE.estaminet.x, 0, PARTAGE.estaminet.z, 0];
  return o; });
console.log('témoins', JSON.stringify(Object.fromEntries(Object.entries(gens).map(([k, v]) => [k, v.map((n) => +n.toFixed(1))]))));
for (const qui of ['crieur', 'allumeur', 'gardien', 'pecheur']) {
  const g = gens[qui]; if (!g) { console.log('ABSENT', qui); continue; }
  const [x, y, z, yaw] = g, fx = Math.sin(yaw), fz = Math.cos(yaw);
  // de face, dégagé (le pêcheur de dos : de face, on filmait les roseaux), et de haut, en retrait
  const c = await filmerSujet(page, `acte1-${ETIQ}-${JOUR}-${qui}-face.jpg`, g, { yaw: qui === 'pecheur' ? Math.PI * 0.75 : 0 });
  if (!c) console.log('pas de vue dégagée sur', qui);
  await filmer(page, `acte1-${ETIQ}-${JOUR}-${qui}-haut.jpg`, [x - fx * 10, y + 16, z - fz * 10], [x + fx * 6, y, z + fz * 6]);
}
// les répliques de l'étape « grille », dans l'ordre de l'enquête
for (const [re, avant] of [['crieur'], ['Cornélie'], ['gardien'], ['allumeur'], ['pêcheur']]) {
  const r = await parler(page, re, { avant }); console.log(re, '→', r ? r.repliques.join(' | ') : 'PAS D’INTERACTION');
}
console.log('indices', JSON.stringify(await page.evaluate(() => TLOC.state.ind)));
console.log(erreurs.length ? erreurs.join('\n') : 'aucune erreur');
await b.close();
process.exit(erreurs.length ? 1 : 0);
