// The Legend of Camille — l'Aveyron de la grande sécheresse : le lac de Saint-Gervais
// La Cloche du Midi (STORY.md) : « une grande carte vallonnée et sèche ; le soleil reste au
// sommet du ciel ; l'eau est la richesse ». Le lac, son barrage, et autour les trois grandes
// maisons des Roquette — le Batut, Beauregard, la grande maison du Pouget — posées là où la
// session des mondes les a proposées et Eugène validées (carte/mondes/README.md).
import { monde } from './monde.js';
import { THREE, phMat, mesh, boxG, showMessage } from './engine.js?v=41';

// une grande maison de noble aveyronnaise : un corps de logis à deux étages sous la lauze,
// et sa tour ronde coiffée d'une poivrière
function grandeMaison({ hauteur, scene, addInteract }, x, z, rot, nom, mot) {
  const g = new THREE.Group(), y = hauteur(x, z); g.position.set(x, y - 1, z); g.rotation.y = rot; scene.add(g);
  const pierre = phMat('old_stone_wall_02', 4, 4, { color: 0xb4a48e }), lauze = phMat('rocher_01', 1.5, 1.5, { color: 0x5e5e64, roughness: 0.85 });
  const L = 22, W = 11, H = 9;
  g.add(mesh(boxG(L, H, W), pierre, 0, H / 2, 0));
  // le toit : un prisme à trois pans couché le long du corps de logis, une arête en haut
  const toit = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.64, W * 0.64, L + 1, 3, 1), lauze);
  toit.rotation.order = 'ZXY'; toit.rotation.z = Math.PI / 2; toit.rotation.x = Math.PI / 2; toit.scale.set(0.55, 1, 1); toit.position.y = H + 1.6; g.add(toit);
  g.add(mesh(new THREE.CylinderGeometry(2.6, 2.8, H + 3, 18), pierre, L / 2, (H + 3) / 2, W / 2));
  g.add(mesh(new THREE.ConeGeometry(3.3, 5.5, 18), lauze, L / 2, H + 3 + 2.7, W / 2));
  for (let k = 0; k < 5; k++) for (const e of [0, 1]) g.add(mesh(boxG(1.1, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 }), -L / 2 + 3 + k * 4, 2.8 + e * 3.6, W / 2 + 0.05));
  g.add(mesh(boxG(1.8, 2.8, 0.25), phMat('wood_cabinet_worn_long', 1.8, 2.8, { color: 0x4a3828 }), 0, 1.4 + 1, W / 2 + 0.06));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  addInteract({ pos: new THREE.Vector3(x, y, z), r: 15, prompt: () => nom, fn: () => showMessage(mot, 6) });
}

monde({
  name: 'aveyron', titre: 'Le lac de Saint-Gervais', musique: 'campagne',
  plan: 'aveyron.json', fin: 'relief-aveyron-lac.json', loin: 'relief-aveyron-monde.json',
  // le soleil au sommet du ciel, qui ne bouge pas : la lumière de midi, la brume chaude
  ciel: [0x4f86c8, 0xb8d0e2, 0xf2e6c8], brume: [0xe8dcc0, 380, 3200], soleil: [20, 400, 30, 3.2], soleilCouleur: 0xfff4dc,
  sol: ['withered_grass', 0xc8b070], loinSol: ['withered_grass', 0xa89060],
  murs: ['old_stone_wall_02', 0xb0a090], toit: { style: 'deuxPans', slug: 'rocher_01', couleur: 0x5e5e64, pente: 0.85 }, hMurs: [4.6, 6.4],
  chemin: ['rocky_trail', 0xc0ac88],
  arbres: { espece: 'chene', bois: 0.6, isoles: 0.015, h: [7, 12], max: 700 },
  depart: { x: -120, z: 135, yaw: Math.atan2(120, -135) },
  portes: [{ x: -126, z: 146, rot: 0.7, prompt: 'repasser la porte de l’île', vers: ['temple', [20.35, 0, 11.75], Math.atan2(-20.35, -11.75)], label: 'Retour à l’île du temps…' }],
  counts: 'Le lac de Saint-Gervais, dans l’Aveyron de la grande sécheresse. Les trois grandes maisons des Roquette sont autour. La porte de l’île, derrière toi.',
  start: 'Le soleil est au sommet du ciel, et il n’en bouge pas. Le lac est bas.',
  entry: { title: 'Le lac de Saint-Gervais', sub: 'La Cloche du Midi — Aveyron', cam: [520, 260, 620], at: [0, 0, 0], cam2: [-60, 30, 260], at2: [0, 0, 0], dur: 6 },
  plus(ctx) {
    grandeMaison(ctx, -135, 170, 0.4, 'la grande maison du Batut', 'Le Batut. Les volets sont fermés au soleil ; derrière, on entend parler d’eau.');
    grandeMaison(ctx, 400, 150, -0.6, 'Beauregard', 'Beauregard, sur sa hauteur : de là, on voit tout le lac, et ce qu’il en reste.');
    grandeMaison(ctx, 185, -315, 1.2, 'la grande maison du Pouget', 'Le Pouget, la grande maison. La plus vieille des trois.');
  },
});
