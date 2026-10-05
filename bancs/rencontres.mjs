// Banc des RENCONTRES du multi — les joueurs se croisent-ils ? (consigne 4, 5 octobre)
//
// Eugène : en multi, les joueurs ne se croisent pas. Ce banc ouvre une instance sur le serveur
// local, y fait entrer JOUEURS navigateurs sans tête et BOTS bots, et compte, sur les
// FENETRE premières secondes de la manche, les RENCONTRES : deux personnages qui passent à
// moins de 30 m l'un de l'autre (une rencontre se termine au-delà de 40 m, pour qu'un couple
// qui oscille autour de 30 m ne compte pas dix fois).
//
// Les joueurs sans tête marchent au hasard : ils avancent (W) et tournent un moment à gauche
// ou à droite (A, D), comme quelqu'un qui découvre la carte. Leur point d'arrivée est cliqué
// au hasard sur la carte de choix. Les bots font ce qu'ils font en jeu.
//
// La règle par défaut est le chrono de 10 min, observé sur ses 3 premières minutes : avant les
// arènes, c'était « toute la châtellenie » jusqu'à 5 min de la fin ; c'est là que l'aire de
// départ change le plus.
//
//   bancs/tour.sh node bancs/rencontres.mjs [http://127.0.0.1:8000]
//   TLOC_REGLE=temps|survie|balade  TLOC_DUREE=600  TLOC_JOUEURS=4  TLOC_BOTS=4
//   TLOC_FENETRE=180  TLOC_ETIQUETTE=avant  TLOC_ARENE=lille|gardeguerin|pouget|batut  TLOC_MODE=libre|equipes
//
// Il crée des comptes de test sur le serveur LOCAL (pseudos banc_xxxxxx, mots de passe tirés au
// hasard et jamais écrits) : ne jamais le lancer contre le dev ni la prod.
// Sortie : bancs/resultats/rencontres-<date>-<étiquette>.json
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
const REGLE = process.env.TLOC_REGLE || 'temps', DUREE = +(process.env.TLOC_DUREE || 600);
const JOUEURS = +(process.env.TLOC_JOUEURS || 4), BOTS = +(process.env.TLOC_BOTS || 4), FENETRE = +(process.env.TLOC_FENETRE || 180);
const ETIQ = process.env.TLOC_ETIQUETTE || 'essai';
const PRES = 30, LOIN = 40;
const ARENE = process.env.TLOC_ARENE || 'lille', MODE = process.env.TLOC_MODE || 'libre';
// la page de chaque arène (= C.ARENES, tloc-compte.js)
const PAGE = { lille: 'index.html', gardeguerin: 'garde-guerin.html', pouget: 'pouget.html', batut: 'batut.html', panyi: 'thailande.html', gallipoli: 'gallipoli.html' }[ARENE];

async function api(chemin, corps, jeton) {
  const r = await fetch(ORIGINE + chemin, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: JSON.stringify(corps || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${chemin} : ${r.status} ${d.detail || ''}`);
  return d;
}

// les comptes et l'instance
const comptes = [];
for (let k = 0; k < JOUEURS; k++) {
  const pseudo = 'banc_' + crypto.randomBytes(3).toString('hex');
  comptes.push({ ...(await api('/api/inscription', { pseudo, mdp: crypto.randomBytes(12).toString('hex') })), perso: 'Banc ' + (k + 1) });
}
const inst = await api('/api/instances', { nom: 'Banc des rencontres', mode: MODE, arene: ARENE, bots: BOTS, niveau: 'soldat', regle: REGLE, vies: 3, duree: DUREE }, comptes[0].jeton);
for (const c of comptes.slice(1)) await api(`/api/instances/${inst.code}/rejoindre`, {}, c.jeton);
console.log(`instance ${inst.code} (${REGLE}, ${DUREE} s, arène ${inst.arene || '—'}) : ${JOUEURS} joueurs, ${BOTS} bots`);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const pages = [];
for (const c of comptes) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => console.log(`[${c.perso}] erreur : ${String(e).split('\n')[0]}`));
  await page.addInitScript(([c, code, nom]) => {
    if (sessionStorage.getItem('banc_pret')) return;     // une seule fois : le jeu réécrit ensuite
    sessionStorage.setItem('banc_pret', '1');
    localStorage.setItem('tloc_compte', JSON.stringify({ jeton: c.jeton, pseudo: c.pseudo }));
    localStorage.setItem('tloc_instance', JSON.stringify({ code, nom, perso: c.perso }));
    localStorage.removeItem('tloc_slot'); localStorage.removeItem('tloc_save_v2');
    sessionStorage.setItem('tloc_auto', 'instance');
  }, [c, inst.code, inst.nom]);
  pages.push({ page, c });
}
// un à un : quatre chargements de Lille en même temps se marchent dessus
for (const { page } of pages) {
  await page.goto(ORIGINE + '/' + PAGE);
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 250 });
}
console.log('pages chargées');

// l'entrée : l'armoire (Échap), le camp en équipes (Entrée), puis à Lille un point cliqué au
// hasard sur la carte, jusqu'à ce qu'il soit pris ; ailleurs l'arrivée est automatique
async function entrer({ page, c }) {
  for (let k = 0; k < 60; k++) {
    if (await page.evaluate(() => !!window.TLOC.state.apparition)) return true;
    if (await page.evaluate(() => window.TLOC.menu && window.TLOC.menu.active && /camp/i.test(document.getElementById('overlay')?.textContent || ''))) {
      await page.keyboard.press(k % 2 ? 'ArrowDown' : 'Enter'); await page.waitForTimeout(800); continue;
    }
    const ok = await page.$('#okTLOC');
    if (ok) {
      for (let e = 0; e < 40; e++) {
        await page.mouse.click(80 + Math.random() * 1120, 80 + Math.random() * 560);
        if (await page.$eval('#okTLOC', (b) => !b.disabled).catch(() => false)) break;
      }
      await page.keyboard.press('Enter');
      return true;
    }
    if (await page.$('#boussoleTLOC')) await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  console.log(`[${c.perso}] n'est pas entré (ni armoire, ni carte, ni arrivée)`);
  return false;
}
for (const p of pages) await entrer(p);
await Promise.all(pages.map(({ page }) => page.waitForTimeout(1500)));
const arrivees = await Promise.all(pages.map(({ page }) => page.evaluate(() => { const p = window.TLOC.player.pos; return [Math.round(p.x), Math.round(p.z)]; })));
console.log('arrivées : ' + arrivees.map((a) => `(${a})`).join(' '));

// la marche au hasard : W tenu, A ou D par moments
let marche = true;
const promeneurs = pages.map(({ page }) => (async () => {
  await page.keyboard.down('KeyW');
  while (marche) {
    const t = ['KeyA', 'KeyD', null, null][Math.floor(Math.random() * 4)];
    if (t) await page.keyboard.down(t);
    await page.waitForTimeout(1000 + Math.random() * 2500);
    if (t) await page.keyboard.up(t);
    await page.waitForTimeout(2000 + Math.random() * 5000);
  }
  await page.keyboard.up('KeyW');
})().catch(() => {}));

// on attend la manche (la minute d'ouverture du salon, puis le compte à rebours)
const etat = () => pages[0].page.evaluate(() => { const e = window.TLOC_MULTI && window.TLOC_MULTI.etat(); return e && e.manche ? e.manche.etat : null; });
const t0 = Date.now();
while ((await etat()) !== 'cours') {
  if (Date.now() - t0 > 240000) { console.log('la manche ne commence pas (4 min)'); break; }
  await pages[0].page.waitForTimeout(2000);
}
console.log('manche en cours : mesure sur ' + FENETRE + ' s');

// la mesure : toutes les secondes, chaque page dit où est son joueur et où sont les bots qu'elle pilote
const proches = new Set(), rencontres = { total: 0, humains: 0, mixtes: 0, bots: 0 }, dmin = [];
const debut = Date.now();
while (Date.now() - debut < FENETRE * 1000) {
  const vus = (await Promise.all(pages.map(({ page, c }) => page.evaluate((perso) => {
    const M = window.TLOC_MULTI, p = window.TLOC.player, l = [];
    if (!M.etat().elimine) l.push({ id: 'h:' + perso, h: 1, x: p.pos.x, z: p.pos.z });
    for (const b of M.bots.values()) if (b.pos && !(b.mortT > 0)) l.push({ id: 'b:' + b.id, h: 0, x: b.pos.x, z: b.pos.z });
    return l;
  }, c.perso).catch(() => [])))).flat();
  for (let i = 0; i < vus.length; i++) {
    let m = Infinity;
    for (let j = 0; j < vus.length; j++) {
      if (i === j) continue;
      const a = vus[i], b = vus[j], d = Math.hypot(a.x - b.x, a.z - b.z); m = Math.min(m, d);
      if (j < i) continue;
      const cle = [a.id, b.id].sort().join('|');
      if (d < PRES && !proches.has(cle)) {
        proches.add(cle); rencontres.total++;
        rencontres[a.h && b.h ? 'humains' : a.h || b.h ? 'mixtes' : 'bots']++;
      } else if (d > LOIN) proches.delete(cle);
    }
    if (vus[i].h && m < Infinity) dmin.push(m);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
marche = false;
await Promise.all(promeneurs);
const nObjets = await pages[0].page.evaluate(() => (window.TLOC_MULTI.equipement().objets || []).length).catch(() => '?');
console.log('objets posés dans l’arène : ' + nObjets);
// à regarder : ce que voient deux des joueurs, et la carte M (la limite de l'aire y est tracée)
const JOUR = new Date().toISOString().slice(0, 10);
for (const [k, { page }] of pages.slice(0, 2).entries()) await page.screenshot({ path: DIR + `rencontres-${JOUR}-${ETIQ}-joueur${k + 1}.jpg`, quality: 80 });
await pages[0].page.keyboard.press('KeyM'); await pages[0].page.waitForTimeout(1200);
await pages[0].page.screenshot({ path: DIR + `rencontres-${JOUR}-${ETIQ}-carte.jpg`, quality: 80 });
const med = (t) => { const s = [...t].sort((a, b) => a - b); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null; };
const res = { date: new Date().toISOString(), etiquette: ETIQ, regle: REGLE, duree: DUREE, fenetre: FENETRE, joueurs: JOUEURS, bots: BOTS,
  arene: inst.arene || null, arrivees, rencontres, voisinMedianM: med(dmin) };
console.log(`rencontres (< ${PRES} m) en ${FENETRE} s : ${rencontres.total} — entre joueurs ${rencontres.humains}, joueur-bot ${rencontres.mixtes}, entre bots ${rencontres.bots} ; voisin le plus proche d'un joueur (médiane) : ${res.voisinMedianM} m`);
fs.writeFileSync(DIR + `rencontres-${res.date.slice(0, 10)}-${ETIQ}.json`, JSON.stringify(res, null, 1));
await browser.close();
