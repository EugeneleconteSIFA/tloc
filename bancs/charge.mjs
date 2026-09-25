// Banc de CHARGEMENT — à lancer avant et après toute évolution du jeu (règle 8 de CLAUDE.md).
//
// Mesure un chargement froid puis une relance de la citadelle : durée totale, durée de
// chaque étape (celles d'engine.js, `etape()`), réseau (fichiers, mégaoctets, les plus
// lourds). Écrit le résultat dans bancs/charge-<date>.json pour comparer d'une fois sur
// l'autre.
//
//   node bancs/charge.mjs [http://127.0.0.1:8000]
//
// Il faut un serveur lancé (./lancer.sh) et Playwright. Il n'est pas installé dans le
// projet : on prend celui d'un autre dépôt (variable TLOC_PLAYWRIGHT, par défaut celui de
// Projet-Padel) et le Chrome de la machine (channel: 'chrome').
import { createRequire } from 'module';
import fs from 'fs';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const PW = process.env.TLOC_PLAYWRIGHT || `${process.env.HOME}/Documents/Projet-Padel/package.json`;
const { chromium } = createRequire(PW)('playwright');
const DIR = new URL('.', import.meta.url).pathname;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const reseau = [];
page.on('response', async (r) => { try { const b = await r.body(); reseau.push({ url: r.url().replace(/^https?:\/\/[^/]+\//, ''), n: b.length }); } catch (e) {} });
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
const res = { date: new Date().toISOString(), origine: ORIGINE };
for (const passe of ['froid', 'relance']) {
  reseau.length = 0;
  const t0 = Date.now();
  await page.goto(ORIGINE + '/index.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 100 });
  const total = (Date.now() - t0) / 1000;
  const etapes = await page.evaluate(() => JSON.parse(localStorage.getItem('tloc_poids_charge') || 'null'));
  const octets = reseau.reduce((t, r) => t + r.n, 0);
  res[passe] = { total, etapes, fichiers: reseau.length, Mo: +(octets / 1e6).toFixed(1),
    lourds: reseau.sort((a, b) => b.n - a.n).slice(0, 10).map((r) => `${(r.n / 1e6).toFixed(2)} Mo  ${r.url}`) };
  console.log(`\n== ${passe} : ${total} s — ${reseau.length} fichiers, ${res[passe].Mo} Mo`);
  console.log('étapes (ms) : ' + Object.entries(etapes || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(' | '));
}
console.log('\nles plus lourds :\n  ' + res.froid.lourds.join('\n  '));
fs.writeFileSync(DIR + `charge-${res.date.slice(0, 10)}.json`, JSON.stringify(res, null, 1));
await browser.close();
