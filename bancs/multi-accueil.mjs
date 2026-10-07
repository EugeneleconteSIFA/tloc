// L'étape « Arène » de l'accueil en cartes (C8, 7 octobre) : neuf cartes, leurs vignettes chargées, un
// clic sur une carte coche son arène ; une capture en largeur d'ordinateur et de téléphone. Un compte
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
for (const [nom, l, h] of [['ordinateur', 1280, 900], ['telephone', 390, 844]]) {
  await page.setViewportSize({ width: l, height: h });
  await page.goto(ORIGINE + '/accueil.html'); await page.waitForTimeout(2500);
  // le formulaire de création peut être replié : on montre la grille et tout ce qui la contient
  const etat = await page.evaluate(async () => {
    const z = document.getElementById('choixArene'); if (!z) return null;
    for (let e = z; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).display === 'none') e.style.display = 'block'; if (e.hidden) e.hidden = false; e.removeAttribute && e.removeAttribute('inert'); }
    z.scrollIntoView({ block: 'start' });
    const imgs = [...z.querySelectorAll('img')]; await Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((f) => { i.onload = i.onerror = f; }))));
    return { cartes: z.querySelectorAll('.arene-carte').length, chargees: imgs.filter((i) => i.naturalWidth > 0).length };
  });
  ok(`${nom} : neuf cartes, leurs vignettes chargées`, etat && etat.cartes === 9 && etat.chargees === 9, JSON.stringify(etat));
  const carte = page.locator('.arene-carte', { hasText: 'Matera' });
  await carte.click();
  ok(`${nom} : un clic sur la carte de Matera la choisit`, await page.evaluate(() => (document.querySelector('input[name="areneInstance"]:checked') || {}).value === 'matera'));
  // tout l'écran, et non la seule grille : c'est ce qui l'entoure qui la recouvrait
  await page.evaluate(() => document.getElementById('choixArene').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: DIR + `multi-accueil-${JOUR}-${nom}.jpg`, type: 'jpeg', quality: 80 });
}
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 3).join(' | '));
console.log(pas.every(Boolean) ? 'TOUT EST PASSÉ' : 'des échecs');
await b.close();
