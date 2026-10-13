// L'étape « Arène » de l'accueil (C8, 7 octobre ; refaite le 13 octobre, Eugène) : l'arène choisie et un bouton
// « Choisir l'arène » qui ouvre la liste ; seules les arènes des lieux découverts en solo s'ouvrent (sans partie
// solo : Lille seule ; une partie qui a vu l'Aveyron et Matera ouvre leurs trois arènes) ; les autres sont
// verrouillées, sans nom. Un clic sur Matera la choisit et ferme la liste. Captures en largeur d'ordinateur et de
// téléphone, liste fermée et ouverte. Un compte
// de test sur le serveur LOCAL (pseudo banc_xxxxxx, mot de passe tiré au hasard, jamais écrit).
//
//   bancs/tour.sh node bancs/multi-accueil.mjs
import { navigateur, DIR, JOUR } from './acte1-outils.mjs';
import crypto from 'crypto';
const ORIGINE = 'http://127.0.0.1:8000';
const r = await fetch(ORIGINE + '/api/inscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pseudo: 'banc_' + crypto.randomBytes(3).toString('hex'), mdp: crypto.randomBytes(12).toString('hex') }) });
const compte = await r.json();
const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push(!!vrai); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
await page.goto(ORIGINE + '/connexion.html');
await page.evaluate((c) => { localStorage.clear(); localStorage.setItem('tloc_compte', JSON.stringify({ jeton: c.jeton, pseudo: c.pseudo })); }, compte);
const ouvertes = () => page.evaluate(() => [...document.querySelectorAll('#choixArene input[name="areneInstance"]:not([disabled])')].map((i) => i.value).sort().join(','));
// sans partie solo : Lille seule
await page.goto(ORIGINE + '/accueil.html'); await page.waitForTimeout(2500);
ok('sans partie solo : Lille seule ouverte', (await ouvertes()) === 'lille', await ouvertes());
ok('les arènes fermées n’ont pas de nom', await page.evaluate(() => [...document.querySelectorAll('.arene-carte.fermee')].every((c) => !/Matera|Gallipoli|Pouget|Batut/.test(c.textContent))));
// une partie solo qui a vu l'Aveyron et Matera
await page.evaluate(() => localStorage.setItem('tloc_save_v2:banc', JSON.stringify({ v: 2, level: 'matera', levels: { citadel: {}, aveyron: {}, matera: {} }, flags: {} })));
for (const [nom, l, h] of [['ordinateur', 1280, 900], ['telephone', 390, 844]]) {
  await page.setViewportSize({ width: l, height: h });
  await page.goto(ORIGINE + '/accueil.html'); await page.waitForTimeout(2500);
  ok(`${nom} : l’Aveyron et Matera ouvrent leurs arènes`, (await ouvertes()) === 'batut,lille,matera,roquette', await ouvertes());
  // le formulaire de création peut être replié : on montre l'étape et tout ce qui la contient
  await page.evaluate(() => { const z = document.getElementById('btnArene');
    for (let e = z; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).display === 'none') e.style.display = 'block'; if (e.hidden) e.hidden = false; e.removeAttribute && e.removeAttribute('inert'); }
    z.scrollIntoView({ block: 'center' }); });
  ok(`${nom} : l’emblème de l’arène choisie`, await page.evaluate(() => !!document.querySelector('#areneIcone svg path')));
  await page.screenshot({ path: DIR + `multi-accueil-${JOUR}-${nom}-ferme.jpg`, type: 'jpeg', quality: 80 });
  await page.click('#btnArene'); await page.waitForTimeout(600);
  ok(`${nom} : le bouton ouvre la liste`, await page.evaluate(() => document.getElementById('dlgArene').open));
  await page.screenshot({ path: DIR + `multi-accueil-${JOUR}-${nom}-liste.jpg`, type: 'jpeg', quality: 80 });
  await page.locator('.arene-carte', { hasText: 'Matera' }).click(); await page.waitForTimeout(400);
  ok(`${nom} : les vignettes de la liste chargées`, await page.evaluate(async () => { const l = [...document.querySelectorAll('#choixArene img')]; await Promise.all(l.map((i) => (i.complete ? 0 : new Promise((f) => { i.onload = i.onerror = f; })))); return l.length > 0 && l.every((i) => i.naturalWidth > 0); }));
  ok(`${nom} : un clic sur Matera la choisit et ferme la liste`, await page.evaluate(() => (document.querySelector('input[name="areneInstance"]:checked') || {}).value === 'matera'
    && !document.getElementById('dlgArene').open && /Matera/.test(document.getElementById('areneNom').textContent)));
}
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 3).join(' | '));
console.log(pas.every(Boolean) ? 'TOUT EST PASSÉ' : 'des échecs');
await b.close();
