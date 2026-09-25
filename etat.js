// etat.js — les objets de scène que plusieurs secteurs se partagent.
//
// Pourquoi un module pour ça : un module ES ne peut réassigner que ses propres
// variables. La grille du donjon est bâtie par le secteur Citadelle mais ouverte par
// le secteur Quêtes ; le chat est posé par le décor et ramassé par une quête. Plutôt
// que de multiplier les fonctions d'écriture, on met ces quelques références dans un
// seul objet mutable, que tout le monde lit et écrit.
//
// N'y mettre QUE ce qui traverse vraiment une frontière de secteur : tout ce qui reste
// dans un module doit rester une variable de ce module (cf. ORCHESTRATION.md).
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
