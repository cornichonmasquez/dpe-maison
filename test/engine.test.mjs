// Non-régression du moteur sur la maison témoin (fictive), décrite comme un diagnostiqueur (17 ponts
// thermiques mesurés). Les valeurs attendues sont FIGÉES : elles proviennent du moteur Open3CL 1.8.47 lui-même
// et servent à détecter toute dérive (mise à jour du moteur, modification des entrées).
// La validation contre de vrais DPE se fait avec : npm run valider-references -- <dossier>.
// Lancer : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcul_3cl } from '@open3cl/engine';
import maisonTemoin from './fixtures/maison-temoin-gaz.mjs';

const FIGE = {
  ep_m2_2_3: 151, // kWh EP/m²/an, coefficient électricité 2,3
  ges_m2: 31, // kgCO2/m²/an
  ep_total_2_3: 17607, // kWh EP
  chauffage_ef: 13919, // kWh EF gaz
  ecs_ef: 1973,
  enveloppe: 310.8 // W/K
};
const TOLERANCE = 0.01;

function calcule(entree) {
  const log = { ...console };
  console.log = console.warn = console.error = () => {};
  try {
    return calcul_3cl(structuredClone(entree), { sanitize: true });
  } finally {
    Object.assign(console, log);
  }
}

const sortie = calcule(maisonTemoin).logement.sortie;
const ecart = (obtenu, attendu) => Math.abs(obtenu - attendu) / attendu;
const proche = (v, ref, nom) => assert.ok(ecart(v, ref) <= TOLERANCE, `${nom} : obtenu ${v}, figé ${ref}`);

test('le moteur renvoie un résultat pour la maison témoin', () => {
  assert.ok(sortie);
  assert.equal(typeof sortie.ep_conso.ep_conso_5_usages_m2, 'number');
});

test('énergie primaire (coefficient 2,3), classe C', () => {
  proche(sortie.ep_conso.coeff_2_3_ep_conso_5_usages_m2, FIGE.ep_m2_2_3, 'kWh/m²');
  assert.equal(sortie.ep_conso.coeff_2_3_classe_bilan_dpe, 'C');
});

test('émissions de GES, classe D', () => {
  proche(sortie.emission_ges.emission_ges_5_usages_m2, FIGE.ges_m2, 'kgCO2/m²');
  assert.equal(sortie.emission_ges.classe_emission_ges, 'D');
});

test('énergie totale (coefficient 2,3)', () => {
  proche(sortie.ep_conso.coeff_2_3_ep_conso_5_usages, FIGE.ep_total_2_3, 'kWh EP');
});

test('chauffage et eau chaude', () => {
  proche(sortie.ef_conso.conso_ch, FIGE.chauffage_ef, 'chauffage');
  proche(sortie.ef_conso.conso_ecs, FIGE.ecs_ef, 'ECS');
});

test('déperditions de l’enveloppe', () => {
  proche(sortie.deperdition.deperdition_enveloppe, FIGE.enveloppe, 'enveloppe');
});

test('les trois variantes de coefficient électricité sont calculées', () => {
  const ep = sortie.ep_conso;
  for (const cle of ['ep_conso_5_usages_m2', 'coeff_1_7_ep_conso_5_usages_m2', 'coeff_2_3_ep_conso_5_usages_m2']) {
    assert.equal(typeof ep[cle], 'number', cle);
  }
  assert.ok(ep.coeff_2_3_ep_conso_5_usages_m2 >= ep.ep_conso_5_usages_m2);
  assert.ok(ep.ep_conso_5_usages_m2 >= ep.coeff_1_7_ep_conso_5_usages_m2);
});
