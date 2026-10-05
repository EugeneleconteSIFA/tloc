// etat.js — les objets de scène que plusieurs secteurs se partagent.
//
// Pourquoi un module pour ça : un module ES ne peut réassigner que ses propres
// variables. La grille du donjon est bâtie par le secteur Citadelle mais ouverte par
// le secteur Quêtes ; le chat est posé par le décor et ramassé par une quête. Plutôt
// que de multiplier les fonctions d'écriture, on met ces quelques références dans un
// seul objet mutable, que tout le monde lit et écrit.
//
// N'y mettre QUE ce qui traverse vraiment une frontière de secteur : tout ce qui reste
// dans un module doit rester une variable de ce module (cf. docs/ORCHESTRATION.md).
export const PARTAGE = {
  // citadelle
  waterMat: null, donjonGate: null, poterneGrille: null, keyChest: null, bowChest: null,
  follets: [],
  // campagne
  houseRoof: null, windmillBlades: null,
  lavoir: null, hameau: null,          // emplacements trouvés à la pose, lus par zoneName()
  // village
  villagers: [], fontaineEau: null,
  // personnages de quête
  lyderic: null, prince: null, pralin: null,
  // ciel
  skyBirds: [],
};

// L'ACTE I (STORY.md, docs/DECOUPAGE-ACTE1.md) : ses étapes dans l'ordre, et le pas en avant.
// Ici et pas dans quetes.js (5 octobre) : la chapelle et les galeries — d'autres pages, d'autres
// niveaux — font avancer l'acte elles aussi, sans charger quetes.js (le niveau de Lille). On
// passe l'état (`state`, engine.js) : ce module n'importe rien. La sauvegarde reste à l'appelant.
export const ETAPES_ACTE1 = ['grille', 'canne', 'cle', 'lanterne', 'souterrains', 'arc', 'citadelle', 'bombes', 'donjon', 'temple'];
// l'étape en cours, ou null avant la fin du prologue (une ancienne sauvegarde garde l'ancienne histoire)
export const etapeActe1 = (state) => (state.prologueFait ? (state.acte1 || 'grille') : null);
export const atteintActe1 = (state, e) => etapeActe1(state) !== null && ETAPES_ACTE1.indexOf(etapeActe1(state)) >= ETAPES_ACTE1.indexOf(e);
// avance à l'étape `e` si elle est plus loin que l'étape en cours (jamais en arrière) ; vrai si l'on a avancé
export function passerActe1(state, e) {
  if (etapeActe1(state) === null || ETAPES_ACTE1.indexOf(e) <= ETAPES_ACTE1.indexOf(etapeActe1(state))) return false;
  state.acte1 = e; return true;
}
