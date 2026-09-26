// Cuit le relief de la plaine d'avance (carte.js, cuireRelief) : 724 000 hauteurs rangées
// dans carte/relief-cuit.bin, que le jeu relit au lieu de les recalculer (2,5 s gagnées).
// À relancer après toute retouche de la carte qui touche au sol : le jeu le dit lui-même
// dans la console (« relief cuit périmé ») et recalcule en attendant.
//
//   node bancs/cuire-relief.mjs [http://127.0.0.1:8000]
import { createRequire } from 'module';
import fs from 'fs';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const PW = process.env.TLOC_PLAYWRIGHT || `${process.env.HOME}/Documents/Projet-Padel/package.json`;
const { chromium } = createRequire(PW)('playwright');
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await (await browser.newContext()).newPage();
await page.addInitScript(() => { window.__CUIRE_RELIEF = true; });
await page.goto(ORIGINE + '/index.html');
await page.waitForFunction(() => window.__RELIEF_CUIT, null, { timeout: 300000, polling: 200 });
const b64 = await page.evaluate(() => { const u = new Uint8Array(window.__RELIEF_CUIT.buffer); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); });
const buf = Buffer.from(b64, 'base64');
fs.writeFileSync(new URL('../carte/relief-cuit.bin', import.meta.url), buf);
console.log('carte/relief-cuit.bin :', (buf.length / 1e6).toFixed(2), 'Mo');
await browser.close();
