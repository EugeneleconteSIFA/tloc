// connexion.js — le portail : on entre par ici, on ressort vers l'accueil du compte.
import * as C from './tloc-compte.js?v=1';

const $ = (id) => document.getElementById(id);
let mode = 'connexion';

// déjà une session ouverte : on ne fait pas relire un formulaire pour rien
if (C.connecte()) location.replace('accueil.html');

// Une erreur surgit dans un toast, comme sur l'accueil : le joueur la voit où qu'il regarde,
// et le formulaire ne saute pas sous son curseur. Le champ fautif, lui, tremble.
let toastOuvert = null;
function message(texte, type = 'erreur') {
  if (toastOuvert) { toastOuvert.remove(); toastOuvert = null; }
  if (!texte) return;
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'erreur' ? ' erreur' : '');
  t.setAttribute('role', 'alert');
  t.innerHTML = '<svg class="toast-icone" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18v.5"/></svg><span></span><button type="button">Fermer</button>';
  t.querySelector('span').textContent = texte;
  t.querySelector('button').onclick = () => { t.remove(); toastOuvert = null; };
  $('toasts').appendChild(t); toastOuvert = t;
  setTimeout(() => { if (toastOuvert === t) { t.remove(); toastOuvert = null; } }, 6000);
  if (type === 'erreur') {
    const f = $('formCompte');
    f.classList.remove('faux'); void f.offsetWidth; f.classList.add('faux');
  }
}

function basculer(nouveau) {
  mode = nouveau;
  $('ongletConnexion').classList.toggle('actif', mode === 'connexion');
  $('ongletInscription').classList.toggle('actif', mode === 'inscription');
  $('valider').textContent = mode === 'connexion' ? 'Se connecter' : 'Créer le compte';
  $('mdp').autocomplete = mode === 'connexion' ? 'current-password' : 'new-password';
  $('aideCompte').textContent = mode === 'connexion'
    ? "Ton compte retrouve tes parties d'un ordinateur à l'autre et ouvre les instances à plusieurs."
    : 'Pseudo de 3 à 16 caractères, mot de passe de 6 au moins. Aucun courriel demandé.';
  message('');
}

async function valider() {
  const pseudo = $('pseudo').value.trim(), mdp = $('mdp').value;
  if (!pseudo || !mdp) return message('Pseudo et mot de passe, s’il te plaît.');
  $('valider').disabled = true;
  try {
    await (mode === 'connexion' ? C.connexion(pseudo, mdp) : C.inscription(pseudo, mdp));
    try { localStorage.removeItem('tloc_local'); } catch (e) {}
    location.href = 'accueil.html';
  } catch (e) {
    message(e.message);
    $('valider').disabled = false;
  }
}

$('ongletConnexion').onclick = () => basculer('connexion');
$('ongletInscription').onclick = () => basculer('inscription');
$('valider').onclick = valider;
$('pseudo').onkeydown = (e) => { if (e.key === 'Enter') $('mdp').focus(); };
$('mdp').onkeydown = (e) => { if (e.key === 'Enter') valider(); };
$('sansCompte').onclick = () => {
  try { localStorage.setItem('tloc_local', '1'); } catch (e) {}
  location.href = 'accueil.html';
};
$('pseudo').focus();

// Sur tloc-dev, seul le compte Createur entre : pas d'inscription, pas de jeu sans compte —
// le serveur les refuse de toute façon, autant ne pas les proposer.
C.env().then((e) => {
  if (e.env !== 'dev') return;
  document.title = '[DEV] ' + document.title;
  $('ongletInscription').classList.add('cache');
  $('ongletConnexion').parentElement.style.gridTemplateColumns = '1fr';
  const sans = $('sansCompte').closest('p');
  if (sans) { sans.classList.add('cache'); if (sans.nextElementSibling) sans.nextElementSibling.classList.add('cache'); }
  $('aideCompte').innerHTML = 'Version de développement, réservée au compte <b>Createur</b>. Le jeu est sur <a href="https://tloc.kernse.fr/">tloc.kernse.fr</a>.';
}).catch(() => {});
