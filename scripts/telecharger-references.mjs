// Télécharge les DPE de référence du dépôt Open3CL dans un dossier local (jamais commité : ce sont des
// données de tiers, avec adresses). Ensuite : node scripts/validate-ref.ts <dossier>
// Usage : node scripts/telecharger-references.mjs <dossier>
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const dossier = process.argv[2];
if (!dossier) {
  console.error('Usage : node scripts/telecharger-references.mjs <dossier>');
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const liste = await (await fetch('https://api.github.com/repos/Open3CL/engine/contents/test/fixtures')).json();
const noms = liste.filter((e) => e.name.endsWith('.xml')).map((e) => e.name);
console.log(`${noms.length} fichiers à télécharger`);

let i = 0;
async function travailleur() {
  while (i < noms.length) {
    const nom = noms[i++];
    const cible = `${dossier}/${nom}`;
    if (existsSync(cible)) continue;
    const r = await fetch(`https://raw.githubusercontent.com/Open3CL/engine/master/test/fixtures/${nom}`);
    if (r.ok) writeFileSync(cible, await r.text());
  }
}
await Promise.all(Array.from({ length: 8 }, travailleur));
console.log('terminé');
