// outils_ktx2.mjs — convertit les textures chargées par `chargerTexture` (assets.js) en KTX2
// (Basis Universal, ETC1S qualité 255, mipmaps), À CÔTÉ des .webp : le jeu ne les lit qu'avec
// ?ktx2 dans l'adresse, le temps de décider (essai du 29 septembre, PROMPT-REPRISE § 4.S).
//
// Pourquoi : une texture compressée pour la carte graphique s'envoie sans décodage ni
// conversion (texSubImage2D prenait 3 à 6 s au chargement) et prend 4 fois moins de mémoire
// graphique. ETC1S plutôt qu'UASTC : au même endroit, UASTC pesait 3 fois nos webp.
//
// L'encodeur n'est pas dans le dépôt (3,4 Mo) : basis_encoder.js et .wasm, pris dans
// github.com/BinomialLLC/basis_universal, webgl/encoder/build/. Le décodage des webp passe
// par Python (PIL), déjà là pour les autres outils.
//
//   BASIS_ENCODER=/chemin/vers/basis_encoder.js node outils_ktx2.mjs [--refaire]
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const ENC = process.env.BASIS_ENCODER;
if (!ENC || !fs.existsSync(ENC)) { console.error('BASIS_ENCODER : chemin de basis_encoder.js manquant'); process.exit(1); }
const REFAIRE = process.argv.includes('--refaire');
const DOSSIERS = ['assets_back/03_textures/polyhaven', 'assets_back/03_textures/foret'];
// les cartes de données (relief, rugosité, métal) restent linéaires ; les couleurs en sRGB
const LINEAIRE = /(normale|rugosite|metal)\.webp$/;

const fichiers = [];
const parcourir = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) parcourir(p); else if (e.name.endsWith('.webp')) fichiers.push(p); } };
DOSSIERS.forEach(parcourir);

const M = await createRequire(import.meta.url)(ENC)();
M.initializeBasis();
const tmp = path.join(os.tmpdir(), 'tloc-ktx2.rgba');
let fait = 0, octetsWebp = 0, octetsKtx = 0; const t0 = Date.now();
for (const f of fichiers) {
  const sortie = f.replace(/\.webp$/, '.ktx2');
  octetsWebp += fs.statSync(f).size;
  if (!REFAIRE && fs.existsSync(sortie) && fs.statSync(sortie).mtimeMs > fs.statSync(f).mtimeMs) { octetsKtx += fs.statSync(sortie).size; continue; }
  // largeur, hauteur, puis les pixels RGBA bruts
  const [w, h] = execFileSync('python3', ['-c', `from PIL import Image; im=Image.open(${JSON.stringify(f)}).convert('RGBA'); open(${JSON.stringify(tmp)},'wb').write(im.tobytes()); print(im.size[0], im.size[1])`]).toString().trim().split(' ').map(Number);
  const rgba = new Uint8Array(fs.readFileSync(tmp)), srgb = !LINEAIRE.test(f);
  const e = new M.BasisEncoder();
  e.setCreateKTX2File(true); e.setMipGen(true); e.setPerceptual(srgb); e.setKTX2AndBasisSRGBTransferFunc(srgb);
  e.setSliceSourceImage(0, rgba, w, h, M.ldr_image_type.cRGBA32.value);
  e.setFormatMode(M.basis_tex_format.cETC1S.value); e.setQualityLevel(255); e.setETC1SCompressionLevel(2);
  const out = new Uint8Array(w * h * 8 + (1 << 20));
  const n = e.encode(out); e.delete();
  if (!n) { console.error('échec :', f); continue; }
  fs.writeFileSync(sortie, out.subarray(0, n));
  octetsKtx += n; fait++;
  process.stdout.write(`\r${fait} converties…`);
}
console.log(`\n${fichiers.length} textures (${fait} converties en ${Math.round((Date.now() - t0) / 1000)} s) : webp ${(octetsWebp / 1e6).toFixed(1)} Mo → ktx2 ${(octetsKtx / 1e6).toFixed(1)} Mo`);
