// Banc de CHARGEMENT — à lancer avant et après toute évolution du jeu (règle 8 de CLAUDE.md).
//
// Mesure un chargement froid puis une relance de la citadelle : durée totale, durée de
// chaque étape (celles d'engine.js, `etape()`), réseau (fichiers, mégaoctets, les plus
// lourds). Écrit le résultat dans bancs/resultats/charge-<date>.json pour comparer d'une fois sur
// l'autre.
//
//   node bancs/charge.mjs [http://127.0.0.1:8000]
//
// Il faut un serveur lancé (./lancer.sh) et Playwright. Il n'est pas installé dans le
// projet : on prend celui d'un autre dépôt (variable TLOC_PLAYWRIGHT, par défaut celui de
// Projet-Padel) et le Chrome de la machine (channel: 'chrome').
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
// sur le PC, Playwright est dans GitHub/tloc/outils (5 octobre)
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
// fileURLToPath et non `.pathname`, qui donne « /C:/… » sous Windows
const DIR = fileURLToPath(new URL('resultats/', import.meta.url));
// Metal n'existe que sur le Mac ; Direct3D 11 est son équivalent sous Windows
const ANGLE = process.platform === 'darwin' ? 'metal' : 'd3d11';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
// la MÉMOIRE (30 septembre) : ce qui fera tenir le jeu sur un téléphone ou non. Le tas JS après
// un ramasse-miettes, et la mémoire graphique des textures (ce qu'elles pèseront une fois envoyées)
const cdp = await page.context().newCDPSession(page);
const reseau = [];
page.on('response', async (r) => { try { const b = await r.body(); reseau.push({ url: r.url().replace(/^https?:\/\/[^/]+\//, ''), n: b.length }); } catch (e) {} });
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
const res = { date: new Date().toISOString(), origine: ORIGINE };
for (const passe of ['froid', 'relance']) {
  reseau.length = 0;
  const t0 = Date.now();
  await page.goto(ORIGINE + '/index.html' + (process.env.TLOC_PARAMS || ''));
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 100 });
  const total = (Date.now() - t0) / 1000;
  const etapes = await page.evaluate(() => JSON.parse(localStorage.getItem('tloc_poids_charge') || 'null'));
  const octets = reseau.reduce((t, r) => t + r.n, 0);
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  const memoire = await page.evaluate(() => {
    const vues = new Set(); let tex = 0;
    window.TLOC.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) for (const k in m) { const t = m[k]; if (!t || !t.isTexture) continue; const src = t.source || t.image; if (!src || vues.has(src)) continue; vues.add(src);
        const im = t.image || {}; tex += t.isCompressedTexture ? (t.mipmaps || []).reduce((a, mm) => a + (mm.data ? mm.data.byteLength : 0), 0) : (im.width || 0) * (im.height || 0) * 4 * 1.33; } });
    return { tasMo: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, texturesMo: Math.round(tex / 1e6) };
  });
  res[passe] = { total, etapes, fichiers: reseau.length, Mo: +(octets / 1e6).toFixed(1), ...memoire,
    lourds: reseau.sort((a, b) => b.n - a.n).slice(0, 10).map((r) => `${(r.n / 1e6).toFixed(2)} Mo  ${r.url}`) };
  console.log(`\n== ${passe} : ${total} s — ${reseau.length} fichiers, ${res[passe].Mo} Mo — tas ${memoire.tasMo} Mo, textures ${memoire.texturesMo} Mo`);
  console.log('étapes (ms) : ' + Object.entries(etapes || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(' | '));
}
console.log('\nles plus lourds :\n  ' + res.froid.lourds.join('\n  '));
// TLOC_ETIQUETTE nomme le relevé (charge-<date>-<étiquette>.json) : sans elle, un second passage
// le même jour écrase la référence du matin — c'est ce que fait le contrôle de publication.
const ETIQ = process.env.TLOC_ETIQUETTE ? '-' + process.env.TLOC_ETIQUETTE : '';
fs.writeFileSync(DIR + `charge-${res.date.slice(0, 10)}${ETIQ}.json`, JSON.stringify(res, null, 1));
await browser.close();
