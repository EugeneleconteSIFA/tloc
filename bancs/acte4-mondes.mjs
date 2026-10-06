// Les autres mondes de monde.js chargent-ils sans erreur ? (monde.js est commun : un crochet
// ajouté pour les Pouilles — bloqueLieu, G.level.mer — ne doit rien casser ailleurs.) Chaque page,
// une partie neuve, jusqu'à la fin de l'écran de chargement, puis cinq secondes de jeu.
//
//   bancs/tour.sh node bancs/acte4-mondes.mjs
import { navigateur, ORIGINE } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
let mauvais = 0;
const pages = fs.readdirSync(new URL('..', import.meta.url)).filter((f) => f.endsWith('.html'))
  .filter((f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').match(/src="([\w-]+)\.js/) && ['aveyron', 'batut', 'thailande', 'pouget', 'villefort', 'garde-guerin', 'matera', 'alberobello', 'gallipoli'].some((n) => f.startsWith(n)));
for (const p of pages) {
  erreurs.length = 0;
  await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
  await page.goto(ORIGINE + '/' + p);
  const ok = await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 240000 }).then(() => true, () => false);
  await page.waitForTimeout(5000);
  const vraies = erreurs.filter((e) => /PAGEERROR/.test(e));
  const mer = await page.evaluate(() => (window.TLOC && TLOC.G.level ? !!TLOC.G.level.mer : null));
  if (!ok || vraies.length) mauvais++;
  console.log(`${ok && !vraies.length ? '✓' : '✗'} ${p} — ${ok ? 'chargée' : 'PAS CHARGÉE'}, mer ${mer ? 'exposée' : 'aucune'}${vraies.length ? ' — ' + vraies[0] : ''}`);
}
console.log(mauvais ? `${mauvais} page(s) en défaut` : 'TOUT EST PASSÉ');
await b.close();
