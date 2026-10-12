// Calcule un cas de test JS (module exportant l'objet DPE) et affiche le détail du résultat.
// Usage : node scripts/run-json.mjs test/fixtures/maison-temoin-gaz.mjs [--quiet]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { calcul_3cl } from '@open3cl/engine';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Usage : node scripts/run-json.mjs <fixture.mjs> [--quiet]');
  process.exit(1);
}
const quiet = flags.includes('--quiet');

const { default: input } = await import(pathToFileURL(resolve(file)).href);
// le moteur mute l'entrée (issue #161) : on travaille sur un clone
const dpe = structuredClone(input);

const original = { log: console.log, warn: console.warn, error: console.error };
const messages = [];
if (quiet) {
  for (const k of ['log', 'warn', 'error']) console[k] = (...a) => messages.push(`${k}: ${a.join(' ')}`);
}

let out;
try {
  out = calcul_3cl(dpe, { sanitize: true });
} finally {
  Object.assign(console, original);
}

if (!out) {
  console.error('Le moteur a renvoyé null : entrée invalide (enveloppe, murs ou planchers vides ?)');
  process.exit(2);
}

const s = out.logement.sortie;
const ep = s.ep_conso;
const ges = s.emission_ges;
const r = (v, d = 1) => (typeof v === 'number' ? Number(v.toFixed(d)) : v);

console.log('\n=== Résultat du moteur =====================================');
console.log('Coefficient 2,3 (ancien)   :', r(ep.coeff_2_3_ep_conso_5_usages_m2), 'kWh EP/m²/an  classe', ep.coeff_2_3_classe_bilan_dpe);
console.log('Coefficient 1,9 (en vigueur):', r(ep.ep_conso_5_usages_m2), 'kWh EP/m²/an  classe', ep.classe_bilan_dpe);
console.log('Coefficient 1,7 (2027)     :', r(ep.coeff_1_7_ep_conso_5_usages_m2), 'kWh EP/m²/an  classe', ep.coeff_1_7_classe_bilan_dpe);
console.log('GES                        :', r(ges.emission_ges_5_usages_m2), 'kgCO2/m²/an   classe', ges.classe_emission_ges);
console.log('Total EP (2,3)             :', r(ep.coeff_2_3_ep_conso_5_usages, 0), 'kWh   | EF :', r(s.ef_conso.conso_5_usages, 0), 'kWh');
console.log('Par poste (EP, 1,9)        :', {
  chauffage: r(ep.ep_conso_ch, 0),
  ecs: r(ep.ep_conso_ecs, 0),
  eclairage: r(ep.ep_conso_eclairage, 0),
  auxiliaires: r(ep.ep_conso_totale_auxiliaire, 0),
  ventilation: r(ep.ep_conso_auxiliaire_ventilation, 0)
});
console.log('Déperditions (W/K)         :', Object.fromEntries(
  Object.entries(s.deperdition).map(([k, v]) => [k.replace('deperdition_', ''), r(v, 1)])
));

if (quiet) {
  console.log(`\n(${messages.length} messages du moteur masqués ; relancer sans --quiet pour les voir)`);
}
