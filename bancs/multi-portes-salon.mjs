// Les portes du Batut, PARTAGÉES par le salon (C8, 6 octobre) : deux joueurs dans la même instance ;
// l'un ferme une porte, l'autre la voit fermée ; un troisième qui arrive après coup la trouve fermée
// (le serveur la redit au `bienvenue`) ; rouverte par l'un, elle l'est chez tous.
//
// Comme rencontres.mjs, il crée des comptes de test sur le serveur LOCAL (pseudos banc_xxxxxx,
// mots de passe tirés au hasard et jamais écrits) : jamais contre le dev ni la prod.
//
//   bancs/tour.sh node bancs/multi-portes-salon.mjs
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
const ORIGINE = 'http://127.0.0.1:8000';
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const pas = [], ERREURS = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
async function api(chemin, corps, jeton) {
  const r = await fetch(ORIGINE + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: JSON.stringify(corps || {}) });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${chemin} : ${r.status} ${d.detail || ''}`); return d;
}
const comptes = [];
for (let k = 0; k < 3; k++) { const pseudo = 'banc_' + crypto.randomBytes(3).toString('hex');
  comptes.push({ ...(await api('/api/inscription', { pseudo, mdp: crypto.randomBytes(12).toString('hex') })), perso: 'Porte ' + (k + 1) }); }
const inst = await api('/api/instances', { nom: 'Banc des portes', mode: 'libre', arene: 'batut', bots: 0, niveau: 'soldat', regle: 'balade', vies: 3, duree: 600 }, comptes[0].jeton);
for (const c of comptes.slice(1)) await api(`/api/instances/${inst.code}/rejoindre`, {}, c.jeton);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
async function ouvrir(c) {
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
  page.on('pageerror', (e) => ERREURS.push(String(e).split('\n')[0]));
  await page.addInitScript(([c, code, nom]) => {
    if (sessionStorage.getItem('banc_pret')) return; sessionStorage.setItem('banc_pret', '1');
    localStorage.setItem('tloc_compte', JSON.stringify({ jeton: c.jeton, pseudo: c.pseudo }));
    localStorage.setItem('tloc_instance', JSON.stringify({ code, nom, perso: c.perso }));
    localStorage.removeItem('tloc_slot'); localStorage.removeItem('tloc_save_v2'); sessionStorage.setItem('tloc_auto', 'instance');
  }, [c, inst.code, inst.nom]);
  await page.goto(ORIGINE + '/batut.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.__batut && window.TLOC_MULTI && TLOC_MULTI.etat().moi, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  return page;
}
const etatPorte = (page, id) => page.evaluate((id) => __batut.PORTES.find((p) => p.id === id).ouverte, id);
try {
  const A = await ouvrir(comptes[0]), B = await ouvrir(comptes[1]);
  const id = await A.evaluate(() => __batut.PORTES[3].id);
  // A ferme la porte comme un joueur : par son invite
  await A.evaluate((id) => { const p = __batut.PORTES.find((p) => p.id === id);
    const it = TLOC.interactables.find((i) => /fermer la porte/.test(typeof i.prompt === 'function' ? i.prompt() : '') && Math.hypot(i.pos.x - p.x, i.pos.z - p.z) < 0.1); it.fn(); }, id);
  await A.waitForTimeout(1500);
  ok('A ferme la porte, chez A', (await etatPorte(A, id)) === false);
  ok('B la voit fermée', (await etatPorte(B, id)) === false);
  const C = await ouvrir(comptes[2]);
  ok('C, arrivé après, la trouve fermée', (await etatPorte(C, id)) === false);
  await B.evaluate((id) => { const p = __batut.PORTES.find((p) => p.id === id);
    const it = TLOC.interactables.find((i) => /ouvrir la porte/.test(typeof i.prompt === 'function' ? i.prompt() : '') && Math.hypot(i.pos.x - p.x, i.pos.z - p.z) < 0.1); it.fn(); }, id);
  await B.waitForTimeout(1500);
  ok('B la rouvre : ouverte chez A et chez C', (await etatPorte(A, id)) === true && (await etatPorte(C, id)) === true);
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
ok('aucune erreur de page', !ERREURS.length, ERREURS.slice(0, 3).join(' | '));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await browser.close();
