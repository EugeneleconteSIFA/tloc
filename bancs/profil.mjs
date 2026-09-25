// Profil CPU du CHARGEMENT : le temps propre de chaque fonction, par fichier et par ligne.
// C'est lui qui a trouvé les quatre secondes de rayons de aCielOuvert et les huit secondes
// figées après « Prêt » (25 septembre). Même usage que charge.mjs :
//
//   node bancs/profil.mjs [http://127.0.0.1:8000]
//
// Le profil complet est écrit dans bancs/chargement.cpuprofile (s'ouvre dans l'onglet
// Performance de Chrome).
import { createRequire } from 'module';
import fs from 'fs';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const PW = process.env.TLOC_PLAYWRIGHT || `${process.env.HOME}/Documents/Projet-Padel/package.json`;
const { chromium } = createRequire(PW)('playwright');
const DIR = new URL('.', import.meta.url).pathname;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
const t0 = Date.now();
await page.goto(ORIGINE + '/index.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 100 });
const { profile } = await cdp.send('Profiler.stop');
const dt = {};
for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] || 0) + (profile.timeDeltas[i + 1] || 0);
const parFn = {}, parFichier = {};
for (const node of profile.nodes) {
  const us = dt[node.id]; if (!us) continue;
  const cf = node.callFrame, f = (cf.url || '').replace(/^https?:\/\/[^/]+\//, '') || '(natif)';
  const k = `${cf.functionName || '(anonyme)'}  ${f}:${cf.lineNumber + 1}`;
  parFn[k] = (parFn[k] || 0) + us; parFichier[f] = (parFichier[f] || 0) + us;
}
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([a, v]) => `${(v / 1000).toFixed(0).padStart(6)} ms  ${a}`).join('\n');
console.log(`chargement : ${(Date.now() - t0) / 1000} s\n\nPAR FICHIER\n${top(parFichier, 12)}\n\nPAR FONCTION (temps propre)\n${top(parFn, 30)}`);
fs.writeFileSync(DIR + 'chargement.cpuprofile', JSON.stringify(profile));
await browser.close();
