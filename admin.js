// admin.js — la page /admin du créateur : joueurs, parties en ligne, manches, badges, retours.
// Tout vient de /api/admin/detail, que le serveur ne sert qu'au compte créateur ; la page
// n'affiche donc rien d'autre qu'un refus à qui n'y a pas droit.
import * as C from './tloc-compte.js?v=2';

const $ = (id) => document.getElementById(id);
const ECH = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NOM_REGLE = { balade: 'Balade', survie: 'Match à mort', temps: 'Chrono', drapeaux: 'Drapeaux' };
const NOM_QUETE = { arc: 'arc', chat: 'chat', corbeaux: 'corbeaux', fantomes: 'fantômes', carte: 'carte', boss: 'Phinaert', eugene: 'Eugène' };
const NOM_RANG = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };

// « il y a 3 h » : plus parlant qu'une date pour savoir qui joue en ce moment
function ilya(t, maintenant) {
  if (!t) return '—';
  const s = maintenant - t;
  if (s < 90) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  if (s < 30 * 86400) return `il y a ${Math.round(s / 86400)} j`;
  return new Date(t * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
const date = (t) => (t ? new Date(t * 1000).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const heures = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.round(m)} min`);
const octets = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.round(n / 1e3)} ko`);

// Un tableau triable : un clic sur l'en-tête trie par cette colonne, un second inverse.
// `cols` : [titre, clé de tri, rendu de la cellule]
function tableau(id, lignes, cols, triInitial) {
  let tri = triInitial, sens = -1;
  const peindre = () => {
    const l = lignes.slice().sort((a, b) => {
      const x = a[tri], y = b[tri];
      return (x === y ? 0 : (x ?? -Infinity) > (y ?? -Infinity) ? 1 : -1) * sens;
    });
    $(id).innerHTML = `<table><thead><tr>${cols.map(([t, k]) => `<th scope="col"${k ? ` data-tri="${k}" aria-sort="${k === tri ? (sens > 0 ? 'ascending' : 'descending') : 'none'}"` : ''}>${t}${k === tri ? (sens > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${l.map((r) => `<tr${r.createur ? ' class="moi"' : ''}>${cols.map(([, , f]) => `<td>${f(r)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="vide">Rien pour l’instant.</td></tr>`}</tbody></table>`;
    $(id).querySelectorAll('th[data-tri]').forEach((th) => {
      th.onclick = () => { if (tri === th.dataset.tri) sens = -sens; else { tri = th.dataset.tri; sens = -1; } peindre(); };
    });
  };
  peindre();
}

async function charger() {
  const zone = $('admin');
  if (!C.connecte()) { zone.innerHTML = '<p class="refus">Connecte-toi avec le compte créateur. <a href="connexion.html">Se connecter</a></p>'; return; }
  let a;
  try { a = await C.appel('/api/admin/detail'); }
  catch (e) { zone.innerHTML = `<p class="refus">${ECH(e.message)} <a href="accueil.html">Retour à l’accueil</a></p>`; return; }
  // les comptes des bancs d'essai (bancs/*.mjs, « banc » + six caractères) : masqués par défaut,
  // ils noieraient les vrais testeurs
  const test = (p) => /^banc[0-9a-f]{6}$/.test(p);
  let masquer = true;
  const T = a.maintenant, TOUS = a.joueurs, J = TOUS.filter((j) => !test(j.pseudo)), autres = J.filter((j) => !j.createur);
  const actifs = (s) => autres.filter((j) => j.vu && T - j.vu < s).length;
  const carte = (chiffre, titre, detail) => `<div class="stat"><b>${chiffre}</b><span>${titre}</span><small>${detail}</small></div>`;
  const nManches = a.manches.length ? Object.values(a.par_regle).reduce((s, n) => s + n, 0) : 0;
  const decernes = a.badges.reduce((s, b) => s + b.total, 0);
  zone.innerHTML = `
    <h1>Le tableau de bord</h1>
    <div class="stats">
      ${carte(autres.length, 'joueurs inscrits', `toi exclu · ${autres.filter((j) => T - j.cree < 7 * 86400).length} cette semaine`)}
      ${carte(J.filter((j) => j.en_ligne).length, 'en ligne', `${a.salons.length} partie${a.salons.length > 1 ? 's' : ''} ouverte${a.salons.length > 1 ? 's' : ''} en ce moment`)}
      ${carte(actifs(86400), 'venus aujourd’hui', `${actifs(7 * 86400)} sur 7 jours`)}
      ${carte(heures(autres.reduce((s, j) => s + j.minutes, 0)), 'de jeu en solo', `${autres.reduce((s, j) => s + j.parties, 0)} parties sauvegardées`)}
      ${carte(nManches, 'manches jouées', Object.entries(a.par_regle).map(([r, n]) => `${NOM_REGLE[r] || r} ${n}`).join(' · ') || '—')}
      ${carte(decernes, 'badges décernés', `${a.badges.filter((b) => b.porteurs).length} / ${a.badges.length} déjà gagnés par quelqu’un`)}
      ${carte(autres.reduce((s, j) => s + j.km, 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km', 'parcourus', 'solo et multi, toi exclu')}
      ${carte(a.version ? ECH(a.version.commit || a.version.v || '?') : '—', 'version en ligne', `serveur lancé ${ilya(a.demarre, T)} · base ${octets(a.base_octets)}`)}
    </div>

    <h2>Joueurs <small>${J.length}</small></h2>
    <div class="filtres"><input type="search" id="filtreJoueurs" placeholder="Chercher un pseudo" aria-label="Chercher un pseudo">
      <label><input type="checkbox" id="masquerTests" checked> Masquer les comptes de test (${TOUS.length - J.length})</label></div>
    <div class="table" id="tJoueurs"></div>

    <h2>En ce moment <small>${a.salons.length} partie${a.salons.length > 1 ? 's' : ''}</small></h2>
    <div class="table" id="tSalons"></div>

    <h2>Dernières manches <small>${a.manches.length}</small></h2>
    <div class="table" id="tManches"></div>

    <h2>Parties ouvertes <small>${a.instances.length}</small></h2>
    <div class="table" id="tInstances"></div>

    <h2>Badges <small>qui les a</small></h2>
    <div class="table" id="tBadges"></div>

    <h2>Retours des testeurs <small>${a.retours.length}</small></h2>
    <div class="table" id="tRetours"></div>`;

  const colsJoueurs = [
    ['Pseudo', 'pseudo', (j) => `<b>${ECH(j.pseudo)}</b>${j.createur ? ' <span class="pastille">toi</span>' : ''}${j.en_ligne ? ' <span class="pastille vif">en ligne</span>' : ''}`],
    ['Dernière visite', 'vu', (j) => ilya(j.vu, T)],
    ['Inscrit', 'cree', (j) => ilya(j.cree, T)],
    ['Solo', 'minutes', (j) => `${heures(j.minutes)} · ${j.parties} partie${j.parties > 1 ? 's' : ''}`],
    ['Quêtes', 'nq', (j) => j.quetes.map((q) => NOM_QUETE[q] || q).join(', ') || '—'],
    ['Km', 'km', (j) => j.km.toLocaleString('fr-FR')],
    ['Manches', 'manches', (j) => `${j.manches}${j.victoires ? ` · ${j.victoires} gagnée${j.victoires > 1 ? 's' : ''}` : ''}`],
    ['Badges', 'badges', (j) => `${j.badges} (${j.distincts} différents)`],
    ['Parties créées', 'instances', (j) => j.instances],
  ];
  TOUS.forEach((j) => { j.nq = j.quetes.length; });
  const peindreJoueurs = () => {
    const f = $('filtreJoueurs').value.trim().toLowerCase();
    tableau('tJoueurs', (masquer ? J : TOUS).filter((j) => !f || j.pseudo.toLowerCase().includes(f)), colsJoueurs, 'vu');
  };
  $('filtreJoueurs').oninput = peindreJoueurs;
  $('masquerTests').onchange = (e) => { masquer = e.target.checked; peindreJoueurs(); };
  peindreJoueurs();

  tableau('tSalons', a.salons, [
    ['Code', 'code', (s) => `<code>${ECH(s.code)}</code>`],
    ['Règle', 'regle', (s) => `${NOM_REGLE[s.regle] || s.regle}${s.equipes ? ' · équipes' : ''}`],
    ['Joueurs', null, (s) => s.humains.map(ECH).join(', ') || '—'],
    ['Bots', 'bots', (s) => s.bots],
    ['Manche', 'manche', (s) => s.manche || '—'],
    ['Points', null, (s) => (s.equipes ? `${s.points.garnison ?? 0} – ${s.points.bourg ?? 0}` : '—')],
  ], 'code');
  tableau('tManches', a.manches, [
    ['Quand', 't', (m) => date(m.t)],
    ['Règle', 'regle', (m) => NOM_REGLE[m.regle] || m.regle],
    ['Partie', 'code', (m) => `<code>${ECH(m.code)}</code>`],
    ['Joueurs', 'joueurs', (m) => `${m.joueurs} dont ${m.humains} humain${m.humains > 1 ? 's' : ''}`],
  ], 't');
  tableau('tInstances', a.instances, [
    ['Nom', 'nom', (i) => `<b>${ECH(i.nom)}</b> <code>${ECH(i.code)}</code>`],
    ['Hôte', 'hote', (i) => ECH(i.hote)],
    ['Réglages', 'regle', (i) => `${NOM_REGLE[i.regle] || i.regle}${i.mode === 'equipes' ? ' · équipes' : ''}${i.regle === 'survie' ? ` · ${i.vies} vie${i.vies > 1 ? 's' : ''}` : ''}${['temps', 'drapeaux'].includes(i.regle) ? ` · ${Math.round(i.duree / 60)} min` : ''}${i.bots ? ` · ${i.bots} bot${i.bots > 1 ? 's' : ''} ${ECH(i.niveau)}` : ''}`],
    ['Membres', null, (i) => i.membres.map(ECH).join(', ') || '—'],
    ['Créée', 'cree', (i) => ilya(i.cree, T)],
    ['Vue', 'vu', (i) => ilya(i.vu, T)],
  ], 'vu');
  const RANGS = ['commun', 'rare', 'epique', 'legendaire'];
  a.badges.forEach((b) => { b.r = RANGS.indexOf(b.rang); });
  tableau('tBadges', a.badges, [
    ['Badge', 'nom', (b) => `<b>${ECH(b.nom)}</b>`],
    ['Famille', 'famille', (b) => ECH(b.famille)],
    ['Rang', 'r', (b) => `<span class="rang rang-${b.rang}">${NOM_RANG[b.rang]}</span>`],
    ['Joueurs qui l’ont', 'porteurs', (b) => b.porteurs],
    ['Décerné', 'total', (b) => `${b.total} fois`],
  ], 'total');
  tableau('tRetours', a.retours, [
    ['Testeur', 'pseudo', (r) => `<b>${ECH(r.pseudo)}</b>`],
    ['Messages', 'messages', (r) => r.messages],
    ['Dernier', 'dernier', (r) => ilya(r.dernier, T)],
    ['Extrait', null, (r) => `<span class="extrait">${ECH(r.extrait) || '—'}</span>`],
  ], 'dernier');
}

$('rafraichir').onclick = charger;
charger();
