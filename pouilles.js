// pouilles.js — les trois villes de la Cloche des Heures, et le petit train qui les relie
// =====================================================================
// Eugène, 1er octobre : « des villes fortifiées où, pour passer de l'une à l'autre, il faut
// prendre un petit train (Matera / Gallipoli hyper-centre / Alberobello) ». Chaque ville a sa
// page (matera.html, alberobello.html, gallipoli.html) et sa fiche ici ; la gare de chacune
// mène aux deux autres. Alberobello ouvre sur l'île du temps par la porte des Heures, dans un
// trullo (Eugène, 2 octobre) ; Gallipoli est la ville de Nunzia (docs/DECISIONS-RECIT.md).
// La lumière : midi méditerranéen, blanc, la brume chaude de la mer.
// =====================================================================
import { monde } from './monde.js';

const GARES = {
  matera:      { x: -849.8, z: 56.4 },
  alberobello: { x: 491.4, z: -559.5 },
  gallipoli:   { x: 1020.4, z: -218.7 },
};
const NOMS = { matera: 'Matera', alberobello: 'Alberobello', gallipoli: 'Gallipoli' };
const lignes = (ici) => Object.keys(GARES).filter((v) => v !== ici).map((v) => [`Descendre à ${NOMS[v]}`, v, [GARES[v].x + 5, 0, GARES[v].z + 5], 0]);
const COMMUN = {
  musique: 'jardins', ciel: [0x2f6ab8, 0x9ac4e8, 0xf2ead8], brume: [0xece6da, 420, 4200], soleil: [160, 300, 120, 3.0], soleilCouleur: 0xfff2dc,
  toit: { style: 'plat', slug: 'rocher_01', couleur: 0x8a8884, pente: 0.5 }, hMurs: [5.5, 8.5],
  chemin: ['worn_tile_floor', 0xd8ccb4], carteFond: '#c8b890',
};

const FICHES = {
  gallipoli: {
    ...COMMUN, name: 'gallipoli', titre: 'Gallipoli', plan: 'gallipoli.json', fin: 'relief-pouilles-gallipoli.json', mer: 0,
    sol: ['gravier', 0xd8c8a0], murs: ['chaux_craquelee', 0xf2eee4],
    arbres: { espece: 'chene', bois: 0.4, isoles: 0.01, h: [4, 6.5], max: 300 },
    depart: { x: -55, z: 116, yaw: Math.PI },
    portes: [],
    counts: 'Gallipoli, la vieille ville blanche sur son île. La gare, de l’autre côté du pont, pour Matera et Alberobello.',
    start: 'Le blanc des murs fait mal aux yeux. La mer monte… vite. Trop vite.',
    entry: { title: 'Gallipoli', sub: 'La Cloche des Heures — les Pouilles', cam: [700, 300, 700], at: [0, 0, 0], cam2: [80, 40, 260], at2: [-40, 0, 100], dur: 6 },
  },
  matera: {
    ...COMMUN, name: 'matera', titre: 'Matera', plan: 'matera.json', fin: 'relief-pouilles-matera.json',
    sol: ['terre_battue', 0xc8b088], murs: ['old_stone_wall_02', 0xdccca8],
    arbres: { espece: 'chene', bois: 0.5, isoles: 0.01, h: [4, 7], max: 500 },
    depart: { x: -40, z: 20, yaw: 0 },
    portes: [],
    counts: 'Matera, les Sassi creusés dans la falaise de tuf. La gare de Matera Centrale, à l’ouest, pour Alberobello et Gallipoli.',
    start: 'Des maisons creusées dans la roche, les unes sur les toits des autres.',
    entry: { title: 'Matera', sub: 'La Cloche des Heures — les Pouilles', cam: [600, 260, 700], at: [0, 0, 0], cam2: [120, 40, 200], at2: [0, -10, 0], dur: 6 },
  },
  alberobello: {
    ...COMMUN, name: 'alberobello', titre: 'Alberobello', plan: 'alberobello.json', fin: 'relief-pouilles-alberobello.json',
    sol: ['withered_grass', 0xc8b878], murs: ['chaux_craquelee', 0xf4f0e6],
    arbres: { espece: 'chene', bois: 0.5, isoles: 0.012, h: [4, 6], max: 500 },
    // (10, 10) tombait DANS un pâté de trulli d'OSM : on arrive dans la rue, via Monte San
    // Michele, et la porte de l'île s'adosse au mur du trullo qui la borde
    depart: { x: 6.8, z: 1.4, yaw: Math.PI },
    portes: [{ x: 6.5, z: 7.6, rot: 0, prompt: 'repasser la porte de l’île', vers: ['temple', [0, 0, -23.5], 0], label: 'Retour à l’île du temps…' }],
    counts: 'Alberobello, le Rione Monti et ses trulli. La porte de l’île, contre un trullo. La gare, au nord-est, pour Matera et Gallipoli.',
    start: 'Des cônes de pierre grise sur des murs blancs, à perte de vue.',
    entry: { title: 'Alberobello', sub: 'La Cloche des Heures — les Pouilles', cam: [400, 200, 500], at: [0, 0, 0], cam2: [60, 25, 120], at2: [0, 0, 0], dur: 6 },
  },
};

export function ville(nom) {
  const f = FICHES[nom];
  return monde({ ...f, gare: { ...GARES[nom], lignes: lignes(nom) } });
}
