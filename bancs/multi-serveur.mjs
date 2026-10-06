// Banc du SERVEUR des arènes (C7, 6 octobre) — ce que le serveur accepte ou refuse selon l'arène,
// en lui parlant directement : la page refuse déjà d'elle-même, il faut donc envoyer à la main.
//   - la fête (`fete`) : acceptée à Lille seulement (ARENES_FETE) ;
//   - la bannière (`saisir`, posté au ralliement adverse) : acceptée là où l'arène en a (ARENES_BANNIERES) ;
//   - le ralliement (`rdv`) : accepté partout, même loin de l'origine (COORD_MAX : la Garde-Guérin).
// Un joueur sans tête en équipes, un bot dans l'autre camp. Les messages reçus sont relevés en
// enveloppant WebSocket avant le chargement.
//   bancs/tour.sh node bancs/multi-serveur.mjs [http://127.0.0.1:8000]    TLOC_ARENES="lille gallipoli"
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(ORIGINE)) { console.log('Banc réservé au serveur local.'); process.exit(1); }
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const ANGLE = process.platform === 'darwin' ? 'metal' : 'd3d11';
const PAGE = { lille: 'index.html', gardeguerin: 'garde-guerin.html', pouget: 'pouget.html', batut: 'batut.html', panyi: 'thailande.html', gallipoli: 'gallipoli.html' };
const ARENES = (process.env.TLOC_ARENES || 'lille gardeguerin pouget batut panyi gallipoli').split(/\s+/);
const ATTENDU = { fete: ['lille'], banniere: ['lille', 'gardeguerin', 'pouget', 'batut'] };

async function api(chemin, corps, jeton) {
  const r = await fetch(ORIGINE + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: JSON.stringify(corps || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${chemin} : ${r.status} ${d.detail || ''}`);
  return d;
}
const c = { ...(await api('/api/inscription', { pseudo: 'banc_' + crypto.randomBytes(3).toString('hex'), mdp: crypto.randomBytes(12).toString('hex') })), perso: 'Banc' };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
let ecarts = 0;
for (const a of ARENES) {
  const inst = await api('/api/instances', { nom: 'Banc du serveur', mode: 'equipes', arene: a, bots: 1, niveau: 'recrue', regle: 'balade', vies: 3, duree: 600 }, c.jeton);
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e).split('\n')[0]));
  await page.addInitScript(([c, code, nom]) => {
    window.__recus = [];
    const WS = window.WebSocket;
    window.WebSocket = class extends WS { constructor(...a) { super(...a); this.addEventListener('message', (e) => { try { window.__recus.push(JSON.parse(e.data)); } catch (_) {} }); } };
    if (sessionStorage.getItem('banc_pret')) return;
    sessionStorage.setItem('banc_pret', '1');
    localStorage.setItem('tloc_compte', JSON.stringify({ jeton: c.jeton, pseudo: c.pseudo }));
    localStorage.setItem('tloc_instance', JSON.stringify({ code, nom, perso: c.perso }));
    localStorage.removeItem('tloc_slot'); localStorage.removeItem('tloc_save_v2');
    sessionStorage.setItem('tloc_auto', 'instance');
  }, [c, inst.code, inst.nom]);
  await page.goto(ORIGINE + '/' + PAGE[a]);
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 250 });
  for (let k = 0; k < 40 && !(await page.evaluate(() => !!window.TLOC.state.apparition)); k++) {
    if (await page.evaluate(() => window.TLOC.menu && window.TLOC.menu.active && /camp/i.test(document.getElementById('overlay')?.textContent || ''))) await page.keyboard.press('Enter');
    else if (await page.$('#okTLOC')) {
      for (let e = 0; e < 40; e++) { await page.mouse.click(80 + Math.random() * 1120, 80 + Math.random() * 560); if (await page.$eval('#okTLOC', (b) => !b.disabled).catch(() => false)) break; }
      await page.keyboard.press('Enter');
    } else if (await page.$('#boussoleTLOC')) await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  // les deux ralliements posés (le mien à l'arrivée, celui du bot) : jusqu'à 30 s
  const rdv = await page.waitForFunction(() => {
    const r = {}; for (const m of window.__recus) if (m.t === 'rdv' && m.camp) r[m.camp] = m; else if (m.t === 'bienvenue' && m.rdv) Object.assign(r, m.rdv);
    return Object.keys(r).length >= 2 ? r : null;
  }, null, { timeout: 30000, polling: 500 }).then((h) => h.jsonValue()).catch(() => null);
  const camp = await page.evaluate(() => window.TLOC.state.camp);
  // la fête
  const n0 = await page.evaluate(() => window.__recus.length);
  await page.evaluate(() => window.TLOC_MULTI.envoyer({ t: 'fete' }));
  // la bannière adverse : posté sur son ralliement, puis la demande
  let banniere = null;
  if (rdv && camp) {
    const adv = camp === 'garnison' ? 'bourg' : 'garnison', q = rdv[adv];
    if (q) {
      await page.evaluate(([x, z]) => { const T = window.TLOC; setInterval(() => { T.player.pos.set(x, T.getH(x, z) + 0.05, z); T.player.hp = T.player.maxHp; }, 50); }, [q.x, q.z]);
      await page.waitForTimeout(1500);                    // que la position parte au serveur
      await page.evaluate((adv) => window.TLOC_MULTI.envoyer({ t: 'saisir', camp: adv }), adv);
    }
  }
  await page.waitForTimeout(3000);
  const recus = await page.evaluate((n0) => window.__recus.slice(n0).map((m) => m.t + (m.evt ? ':' + m.evt : '')), n0);
  const fete = recus.includes('fete'), prise = recus.some((t) => t === 'banniere:prise');
  if (rdv && camp) banniere = prise;
  const ok = (k, v) => (v === null ? '?' : v === ATTENDU[k].includes(a) ? 'ok' : (ecarts++, 'ÉCART'));
  console.log(`${a.padEnd(12)} ralliements ${rdv ? 'ok' : (ecarts++, 'ABSENTS')} · fête ${fete ? 'acceptée' : 'refusée'} (${ok('fete', fete)}) · bannière ${banniere === null ? 'non testée' : banniere ? 'prise' : 'refusée'} (${ok('banniere', banniere)})${erreurs.length ? ' · erreurs : ' + erreurs.join(' | ') : ''}`);
  if (erreurs.length) ecarts++;
  await page.context().close();
}
console.log(ecarts ? `${ecarts} écart(s)` : 'tout est conforme');
await browser.close();
