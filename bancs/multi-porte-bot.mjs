// Un bot qui poursuit derrière des portes fermées (C8, 7 octobre) : au Batut, un joueur posté,
// invulnérable, dans la grande chambre de l'étage du Batut ; UN bot vétéran. Deux passes : toutes les
// portes ouvertes, puis toutes fermées (les 30 des cloisons) — le bot doit les ouvrir en chemin
// (tickBots : à 1,8 m d'une porte fermée, il l'ouvre). On mesure quand il arrive à 4 m du joueur, et
// combien de portes il a rouvertes. Même cachette, même graphe déclaré (batut.js).
//
//   bancs/tour.sh node bancs/multi-porte-bot.mjs        TLOC_ESSAIS=2  TLOC_FENETRE=120
//
// Comptes de test banc_xxxxxx (mots de passe tirés au hasard, jamais écrits) : serveur LOCAL seulement.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const ORIGINE = 'http://127.0.0.1:8000';
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const DIR = fileURLToPath(new URL('resultats/', import.meta.url)), JOUR = new Date().toISOString().slice(0, 10);
const FENETRE = +(process.env.TLOC_FENETRE || 120), ESSAIS = +(process.env.TLOC_ESSAIS || 2);
async function api(chemin, corps, jeton) {
  const r = await fetch(ORIGINE + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: JSON.stringify(corps || {}) });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${chemin} : ${r.status} ${d.detail || ''}`); return d;
}
const c = { ...(await api('/api/inscription', { pseudo: 'banc_' + crypto.randomBytes(3).toString('hex'), mdp: crypto.randomBytes(12).toString('hex') })), perso: 'Banc' };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const erreurs = [];
async function passe(fermees) {
  const inst = await api('/api/instances', { nom: 'Banc des portes', mode: 'libre', arene: 'batut', bots: 1, niveau: 'veteran', regle: 'temps', vies: 3, duree: 600 }, c.jeton);
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
  page.on('pageerror', (e) => erreurs.push(String(e).split('\n')[0]));
  await page.addInitScript(([c, code, nom]) => {
    if (sessionStorage.getItem('banc_pret')) return; sessionStorage.setItem('banc_pret', '1');
    localStorage.setItem('tloc_compte', JSON.stringify({ jeton: c.jeton, pseudo: c.pseudo }));
    localStorage.setItem('tloc_instance', JSON.stringify({ code, nom, perso: c.perso }));
    localStorage.removeItem('tloc_slot'); localStorage.removeItem('tloc_save_v2'); sessionStorage.setItem('tloc_auto', 'instance');
  }, [c, inst.code, inst.nom]);
  await page.goto(ORIGINE + '/batut.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.__batut && window.TLOC_MULTI, null, { timeout: 300000 });
  for (let k = 0; k < 30 && !(await page.evaluate(() => !!window.TLOC.state.apparition)); k++) { if (await page.$('#boussoleTLOC')) await page.keyboard.press('Escape'); await page.waitForTimeout(1000); }
  // la grande chambre de l'étage du Batut (u = 7,5, v = −11,5 ; x = −(36 + u)) ; posté, invulnérable
  const cache = { x: -43.5, z: -11.5, y: 4.5 };
  await page.evaluate((q) => { const T = window.TLOC; setInterval(() => { T.player.pos.set(q.x, q.y + 0.05, q.z); T.player.vy = 0; T.player.hp = T.player.maxHp; }, 50); }, cache);
  if (fermees) await page.evaluate(() => { for (const p of __batut.PORTES) TLOC.G.level.porte(p.id, false); });
  const etat = () => page.evaluate(() => { const e = window.TLOC_MULTI.etat(); return e.manche ? e.manche.etat : null; });
  const t0 = Date.now();
  while ((await etat()) !== 'cours' && Date.now() - t0 < 240000) await page.waitForTimeout(2000);
  // les portes refermées au départ de la manche (une manche qui commence ne les rouvre pas, mais au cas où)
  if (fermees) await page.evaluate(() => { for (const p of __batut.PORTES) TLOC.G.level.porte(p.id, false); });
  const debut = Date.now(); let arrive = null; const journal = [];
  while (Date.now() - debut < FENETRE * 1000 && arrive === null) {
    const d = await page.evaluate(([x, z, y]) => Math.min(...[...window.TLOC_MULTI.bots.values()].filter((b) => b.pos && !(b.mortT > 0)).map((b) => Math.hypot(b.pos.x - x, b.pos.z - z) + Math.abs((b.pos.y || 0) - y) * 2)), [cache.x, cache.z, cache.y]);
    if (d < 4) arrive = Math.round((Date.now() - debut) / 1000);
    // TLOC_SONDE : où est le bot, et la porte fermée la plus proche (y compris sa hauteur)
    // (TLOC_SONDE=echecs : gardées, et montrées seulement si la passe échoue ; les deux sortes de passes)
    if (process.env.TLOC_SONDE && (fermees || process.env.TLOC_SONDE === 'echecs') && (Date.now() - debut) % 5000 < 600) journal.push(JSON.stringify(await page.evaluate(() => [...window.TLOC_MULTI.bots.values()].map((b) => {
      const f = __batut.PORTES.filter((p) => !p.ouverte).map((p) => [p.id, +Math.hypot(b.pos.x - p.x, b.pos.z - p.z).toFixed(1), p.y]).sort((a, c) => a[1] - c[1])[0];
      return { p: [+b.pos.x.toFixed(1), b.pos.y, +b.pos.z.toFixed(1)], porte: f, cible: b.cible, chasse: b.chasse, flane: !!b.flane, ch: b.chemin ? `${b.chemin.k}/${b.chemin.pts.length}` : null, but: b.but && [Math.round(b.but.x), Math.round(b.but.z)], act: b.act }; }))));
    await page.waitForTimeout(500);
  }
  if (process.env.TLOC_SONDE && (process.env.TLOC_SONDE !== 'echecs' || arrive === null)) console.log(journal.join(String.fromCharCode(10)));
  const rouvertes = fermees ? await page.evaluate(() => __batut.PORTES.filter((p) => p.ouverte).length) : null;
  await page.screenshot({ path: DIR + `multi-porte-bot-${JOUR}-${fermees ? 'fermees' : 'ouvertes'}.jpg`, quality: 80 });
  await page.context().close();
  console.log(`portes ${fermees ? 'fermées' : 'ouvertes'} : ${arrive === null ? `pas au contact en ${FENETRE} s` : `au contact en ${arrive} s`}${fermees ? ` — ${rouvertes} porte(s) rouverte(s) sur 30` : ''}`);
  return { arrive, rouvertes };
}
const res = { ouvertes: [], fermees: [] };
// TLOC_FERMEES=1 : les seules passes aux portes fermées (pour traquer un échec à la sonde)
for (let k = 0; k < ESSAIS; k++) { if (!process.env.TLOC_FERMEES) res.ouvertes.push(await passe(false)); res.fermees.push(await passe(true)); }
const f = (l) => l.map((r) => (r.arrive === null ? '—' : r.arrive + ' s')).join(', ');
console.log(`OUVERTES : ${f(res.ouvertes)} ; FERMÉES : ${f(res.fermees)} ; erreurs de page : ${erreurs.length}`);
fs.writeFileSync(DIR + `multi-porte-bot-${JOUR}.json`, JSON.stringify({ ...res, erreurs }, null, 1));
await browser.close();
