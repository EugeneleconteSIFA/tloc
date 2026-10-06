// Banc du GRAPHE DES BOTS tiré tout seul (consigne C7, 6 octobre) — un bot qui chasse un joueur
// caché derrière un mur ou au bout d'une ruelle le rejoint-il ?
//
// Une instance sur le serveur LOCAL : un joueur sans tête, UN bot vétéran (celui qui chasse le
// plus) — à plusieurs, en chacun pour soi, les bots se chassent entre eux. ESSAIS instances par passe. Dès que le graphe de l'arène est prêt (`grapheAuto`, tloc-multi.js), le joueur est
// posté sur le point le plus « caché » : à 15 m au moins du centre, celui dont le chemin à pied
// depuis le centre est le plus long au regard de la ligne droite (derrière un pâté de maisons, au
// fond d'une impasse). Il y reste, invulnérable. On mesure, sur FENETRE secondes de manche, quand
// chaque bot arrive à 4 m de lui. Deux passes dans la même page de suite : sans le graphe
// (G.sansGrapheAuto, la poursuite d'avant) puis avec.
//
//   bancs/tour.sh node bancs/multi-graphe.mjs [http://127.0.0.1:8000]
//   TLOC_ARENE=gardeguerin|pouget|panyi|gallipoli  TLOC_FENETRE=90
//
// Comptes de test banc_xxxxxx (mots de passe tirés au hasard, jamais écrits) : jamais contre le dev
// ni la prod. Sortie : bancs/resultats/multi-graphe-<date>-<arène>.json
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(ORIGINE)) { console.log('Banc réservé au serveur local.'); process.exit(1); }
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const DIR = fileURLToPath(new URL('resultats/', import.meta.url));
const ANGLE = process.platform === 'darwin' ? 'metal' : 'd3d11';
const ARENE = process.env.TLOC_ARENE || 'gardeguerin', FENETRE = +(process.env.TLOC_FENETRE || 90), BOTS = 1, ESSAIS = +(process.env.TLOC_ESSAIS || 3);
const PAGE = { gardeguerin: 'garde-guerin.html', pouget: 'pouget.html', panyi: 'thailande.html', gallipoli: 'gallipoli.html' }[ARENE];

async function api(chemin, corps, jeton) {
  const r = await fetch(ORIGINE + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: JSON.stringify(corps || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${chemin} : ${r.status} ${d.detail || ''}`);
  return d;
}
const pseudo = 'banc_' + crypto.randomBytes(3).toString('hex');
const c = { ...(await api('/api/inscription', { pseudo, mdp: crypto.randomBytes(12).toString('hex') })), perso: 'Banc' };

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const erreurs = [];
async function passe(avecGraphe) {
  // une instance par passe : la manche repart de zéro, les bots de leurs départs
  const inst = await api('/api/instances', { nom: 'Banc du graphe', mode: 'libre', arene: ARENE, bots: BOTS, niveau: 'veteran', regle: 'temps', vies: 3, duree: 600 }, c.jeton);
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => { erreurs.push(String(e).split('\n')[0]); console.log(`erreur : ${String(e).split('\n')[0]}`); });
  await page.addInitScript(([c, code, nom, avec]) => {
    if (!avec) window.addEventListener('DOMContentLoaded', () => { const t = setInterval(() => { if (window.TLOC) { window.TLOC.G.sansGrapheAuto = true; clearInterval(t); } }, 20); });
    if (sessionStorage.getItem('banc_pret')) return;
    sessionStorage.setItem('banc_pret', '1');
    localStorage.setItem('tloc_compte', JSON.stringify({ jeton: c.jeton, pseudo: c.pseudo }));
    localStorage.setItem('tloc_instance', JSON.stringify({ code, nom, perso: c.perso }));
    localStorage.removeItem('tloc_slot'); localStorage.removeItem('tloc_save_v2');
    sessionStorage.setItem('tloc_auto', 'instance');
  }, [c, inst.code, inst.nom, avecGraphe]);
  await page.goto(ORIGINE + '/' + PAGE);
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 250 });
  for (let k = 0; k < 30 && !(await page.evaluate(() => !!window.TLOC.state.apparition)); k++) {
    if (await page.$('#boussoleTLOC')) await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  // le graphe (on le fait mûrir même pour la passe sans : on y prend la cachette, la même)
  const g = await page.waitForFunction(() => {
    const A = window.TLOC.G.level.arenes[0];
    if (window.TLOC.G.sansGrapheAuto) { window.TLOC.G.sansGrapheAuto = false; A.__sans = true; }
    const Gr = A.grapheAuto;
    if (!Gr || !Gr.fait) return null;
    if (A.__sans) window.TLOC.G.sansGrapheAuto = true;
    return { n: Gr.n.length, a: Gr.a.length, ms: Gr.ms, cpu: Gr.cpu };
  }, null, { timeout: 120000, polling: 250 }).then((h) => h.jsonValue());
  // la cachette : le plus long détour à pied depuis le centre, à 15 m au moins
  const cache = await page.evaluate(() => {
    const A = window.TLOC.G.level.arenes[0], Gr = A.grapheAuto, [cx, cz] = A.centre, N = Gr.n.length;
    const vois = Gr.n.map(() => []);
    for (const [i, j] of Gr.a) { const d = Math.hypot(Gr.n[i][0] - Gr.n[j][0], Gr.n[i][1] - Gr.n[j][1]); vois[i].push([j, d]); vois[j].push([i, d]); }
    let s = 0; for (let i = 1; i < N; i++) if (Math.hypot(Gr.n[i][0] - cx, Gr.n[i][1] - cz) < Math.hypot(Gr.n[s][0] - cx, Gr.n[s][1] - cz)) s = i;
    const dist = new Float64Array(N).fill(Infinity), fait = new Uint8Array(N); dist[s] = 0;
    for (;;) { let u = -1; for (let i = 0; i < N; i++) if (!fait[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i; if (u < 0) break; fait[u] = 1;
      for (const [v, d] of vois[u]) if (dist[u] + d < dist[v]) dist[v] = dist[u] + d; }
    const r0 = A.aires[0].r;
    let best = null, bt = 0;
    for (let i = 0; i < N; i++) { const e = Math.hypot(Gr.n[i][0] - cx, Gr.n[i][1] - cz);
      if (e < 15 || e > r0 * 0.8 || !(dist[i] < Infinity)) continue;
      const t = dist[i] / e; if (t > bt) { bt = t; best = i; } }
    const q = Gr.n[best];
    return { x: q[0], z: q[1], y: q[2], detour: +bt.toFixed(2), aVol: +Math.hypot(q[0] - cx, q[1] - cz).toFixed(1), aPied: +dist[best].toFixed(1) };
  });
  // posté, invulnérable
  await page.evaluate((q) => { const T = window.TLOC; setInterval(() => { T.player.pos.set(q.x, q.y + 0.05, q.z); T.player.vy = 0; T.player.hp = T.player.maxHp; }, 50); }, cache);
  const etat = () => page.evaluate(() => { const e = window.TLOC_MULTI.etat(); return e.manche ? e.manche.etat : null; });
  const t0 = Date.now();
  while ((await etat()) !== 'cours' && Date.now() - t0 < 240000) await page.waitForTimeout(2000);
  const debut = Date.now(), arrives = {};
  while (Date.now() - debut < FENETRE * 1000) {
    const l = await page.evaluate(([x, z]) => [...window.TLOC_MULTI.bots.values()].filter((b) => b.pos && !(b.mortT > 0)).map((b) => [b.id, Math.hypot(b.pos.x - x, b.pos.z - z)]), [cache.x, cache.z]);
    for (const [id, d] of l) if (d < 4 && arrives[id] == null) arrives[id] = Math.round((Date.now() - debut) / 1000);
    if (process.env.TLOC_SONDE && (Date.now() - debut) % 10000 < 600) console.log(JSON.stringify(await page.evaluate(() => [...window.TLOC_MULTI.bots.values()].map((b) => ({
      p: [Math.round(b.pos.x), Math.round(b.pos.z)], cible: b.cible, chasse: b.chasse, flane: !!b.flane, ch: b.chemin ? `${b.chemin.k}/${b.chemin.pts.length}` : null, but: b.but && [Math.round(b.but.x), Math.round(b.but.z)] })))));
    await page.waitForTimeout(500);
  }
  const JOUR = new Date().toISOString().slice(0, 10);
  await page.screenshot({ path: DIR + `multi-graphe-${JOUR}-${ARENE}-${avecGraphe ? 'avec' : 'sans'}.jpg`, quality: 80 });
  await page.context().close();
  const t = Object.values(arrives).sort((a, b) => a - b);
  console.log(`${avecGraphe ? 'avec' : 'sans'} le graphe : ${t.length}/${BOTS} bots au contact en ${FENETRE} s (graphe ${g.n} points en ${g.ms} ms, dont ${g.cpu} ms de calcul)${t.length ? ' (à ' + t.join(', ') + ' s)' : ''}`);
  return { graphe: g, cache, auContact: t.length, secondes: t };
}
async function essais(avec) {
  const l = [];
  for (let k = 0; k < ESSAIS; k++) l.push(await passe(avec));
  const t = l.map((r) => r.secondes[0] ?? null);
  console.log(`${avec ? 'AVEC' : 'SANS'} le graphe : ${t.filter((x) => x !== null).length}/${ESSAIS} au contact (${t.map((x) => (x === null ? '—' : x + ' s')).join(', ')})`);
  return { essais: l, temps: t };
}
const sans = process.env.TLOC_AVEC ? null : await essais(false);
const g0 = sans && sans.essais[0];
if (g0) console.log(`graphe : ${g0.graphe.n} points, ${g0.graphe.a} arêtes, ${g0.graphe.ms} ms ; cachette à ${g0.cache.aVol} m du centre, ${g0.cache.aPied} m à pied (×${g0.cache.detour})`);
const avec = await essais(true);
const res = { date: new Date().toISOString(), arene: ARENE, fenetre: FENETRE, bots: BOTS, sans, avec, erreurs };
fs.writeFileSync(DIR + `multi-graphe-${res.date.slice(0, 10)}-${ARENE}.json`, JSON.stringify(res, null, 1));
await browser.close();
