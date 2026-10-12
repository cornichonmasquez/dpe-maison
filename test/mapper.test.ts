// Tests du mapper formulaire -> moteur 3CL. Lancer : npm test
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculer } from '../src/engine/calculate.ts';
import { buildDpe, ErreurSaisie, departementDepuisCodePostal } from '../src/mapper/buildDpe.ts';
import type { Maison } from '../src/model/house.ts';
import { maisonTemoin } from './fixtures/maison-temoin-saisie.ts';
import { petiteMaison } from './fixtures/petite-maison.ts';

const DATE = '2026-10-11';
const clone = <T>(v: T): T => structuredClone(v);
const ecart = (obtenu: number, attendu: number) => Math.abs(obtenu - attendu) / attendu;

// Valeurs figées de la maison témoin : calcul du moteur sur la saisie détaillée (maison-temoin-gaz.mjs).
const REF = { ep_m2_2_3: 151, ges_m2: 31, enveloppe: 310.8, murs: 69.5, planchersBas: 22.8, baies: 58.7, portes: 7.9 };

describe('cas de référence : maison témoin saisie comme dans le formulaire', () => {
  const r = calculer(maisonTemoin, { dateCalcul: '2024-03-15', versionSchema: '2.3' });

  test('même étiquette finale que la saisie détaillée (D)', () => {
    assert.equal(r.etiquetteFinale, 'D');
    assert.equal(r.variantes.ancien.etiquetteEnergie, 'C');
  });

  test('énergie primaire (coefficient 2,3) à moins de 5 % de la référence', () => {
    const v = r.variantes.ancien.energiePrimaireM2;
    assert.ok(ecart(v, REF.ep_m2_2_3) <= 0.05, `obtenu ${v}, attendu ${REF.ep_m2_2_3}`);
  });

  test('GES à moins de 5 % de la référence', () => {
    assert.ok(ecart(r.gesM2, REF.ges_m2) <= 0.05, `obtenu ${r.gesM2}, attendu ${REF.ges_m2}`);
  });

  test('parois opaques et baies identiques à la saisie détaillée (aucune erreur de saisie)', () => {
    assert.ok(ecart(r.deperditions.murs, REF.murs) < 0.01, `murs ${r.deperditions.murs}`);
    assert.ok(ecart(r.deperditions.planchersBas, REF.planchersBas) < 0.01);
    assert.ok(ecart(r.deperditions.baies, REF.baies) < 0.01);
    assert.ok(ecart(r.deperditions.portes, REF.portes) < 0.01);
  });

  test('déperditions totales à moins de 5 % malgré des ponts thermiques estimés', () => {
    assert.ok(ecart(r.deperditions.total, REF.enveloppe) <= 0.05, `total ${r.deperditions.total}`);
  });

  test('paramètres déduits corrects (H2b, <400 m, période 1989-2000, inertie légère)', () => {
    assert.deepEqual(
      { z: r.deduit.zoneClimatique, a: r.deduit.classeAltitude, p: r.deduit.periodeConstruction, i: r.deduit.inertie },
      { z: 'H2b', a: 1, p: 6, i: 'légère' }
    );
  });

  test('les trois coefficients électricité sont fournis et ordonnés', () => {
    const { actuel, annee2027, ancien } = r.variantes;
    assert.ok(ancien.energiePrimaireM2 >= actuel.energiePrimaireM2);
    assert.ok(actuel.energiePrimaireM2 >= annee2027.energiePrimaireM2);
  });
});

describe('validation de la saisie : jamais de résultat silencieux', () => {
  test('code postal invalide', () => {
    assert.throws(() => departementDepuisCodePostal('abc'), ErreurSaisie);
    assert.equal(departementDepuisCodePostal('44000'), '44');
    assert.equal(departementDepuisCodePostal('20000'), '2A');
    assert.equal(departementDepuisCodePostal('20600'), '2B');
  });

  test("ouverture posée sur une orientation sans mur", () => {
    const m = clone(petiteMaison());
    m.murs = m.murs.filter((x) => x.orientation !== 'sud');
    assert.throws(() => buildDpe(m), (e: any) => e instanceof ErreurSaisie && e.champs.includes('ouvertures.f1'));
  });

  test('ouvertures plus grandes que le mur', () => {
    const m = clone(petiteMaison());
    m.ouvertures[0].surface = 40;
    assert.throws(() => buildDpe(m), ErreurSaisie);
  });

  test('surface habitable aberrante', () => {
    assert.throws(() => buildDpe(petiteMaison({ surfaceHabitable: 3 })), ErreurSaisie);
  });

  test('département hors métropole refusé', () => {
    assert.throws(() => buildDpe(petiteMaison({ codePostal: '97400' })), ErreurSaisie);
  });
});

describe('valeurs par défaut (« je ne sais pas »)', () => {
  test('isolation inconnue : avertissement et valeur forfaitaire', () => {
    const r = calculer(petiteMaison(), { dateCalcul: DATE });
    assert.ok(r.avertissements.some((a) => a.includes('isolation inconnue')));
    assert.ok(Number.isFinite(r.energiePrimaireM2) && r.energiePrimaireM2 > 0);
  });

  test('une isolation connue et récente améliore le résultat', () => {
    const base = calculer(petiteMaison(), { dateCalcul: DATE });
    const m = petiteMaison();
    for (const mur of m.murs) mur.isolation = { type: 'ite', epaisseurCm: 14 };
    const isole = calculer(m, { dateCalcul: DATE });
    assert.ok(isole.energiePrimaireM2 < base.energiePrimaireM2, `${isole.energiePrimaireM2} < ${base.energiePrimaireM2}`);
  });
});

describe('scénario « et si » sur la maison témoin', () => {
  const base = calculer(maisonTemoin, { dateCalcul: DATE });

  test("isoler les combles (R = 7) réduit la consommation", () => {
    const m = clone(maisonTemoin);
    m.toitures[0].isolation = { type: 'ite', resistance: 7 };
    const apres = calculer(m, { dateCalcul: DATE });
    assert.ok(apres.energiePrimaireM2 < base.energiePrimaireM2);
    assert.ok(apres.deperditions.planchersHauts < base.deperditions.planchersHauts);
  });

  test('passer à une PAC air/eau fait passer en classe A ou B côté climat', () => {
    const m = clone(maisonTemoin);
    m.chauffage = {
      kind: 'pac',
      source: 'air_eau',
      annee: 2025,
      emetteurs: { type: 'radiateur_bitube', robinetsThermostatiques: true, temperature: 'haute', annee: 1996, programmation: 'centrale' }
    };
    m.ecs = { kind: 'chauffe_eau_thermodynamique', source: 'air_ambiant', annee: 2025, volumeL: 200 };
    const apres = calculer(m, { dateCalcul: DATE });
    assert.ok(['A', 'B'].includes(apres.etiquetteClimat), `climat ${apres.etiquetteClimat}`);
    assert.ok(apres.gesM2 < base.gesM2 / 3);
  });

  test('remplacer les fenêtres par du double vitrage performant réduit les déperditions des baies', () => {
    const m = clone(maisonTemoin);
    for (const o of m.ouvertures) {
      o.menuiserie = 'pvc';
      o.vitrage = 'double';
      o.gaz = 'argon';
      o.peuEmissif = true;
      o.laMm = 16;
    }
    const apres = calculer(m, { dateCalcul: DATE });
    assert.ok(apres.deperditions.baies < base.deperditions.baies);
  });
});

describe('matrice des systèmes pris en charge en v1', () => {
  const cas: [string, Partial<Maison>][] = [
    ['chaudière fioul standard + ECS mixte', { chauffage: { kind: 'chaudiere_fioul', techno: 'standard', annee: 1995, emetteurs: { type: 'radiateur_monotube', robinetsThermostatiques: false, temperature: 'haute', programmation: 'aucune' } } }],
    ['convecteurs électriques + ballon électrique', { chauffage: { kind: 'electrique_direct', emetteur: 'convecteur' }, ecs: { kind: 'ballon_electrique', volumeL: 200 } }],
    ['panneaux rayonnants + ballon thermodynamique', { chauffage: { kind: 'electrique_direct', emetteur: 'panneau_rayonnant' }, ecs: { kind: 'chauffe_eau_thermodynamique', annee: 2018 } }],
    ['PAC air/air + ballon électrique', { chauffage: { kind: 'pac', source: 'air_air', annee: 2019 }, ecs: { kind: 'ballon_electrique' } }],
    ['PAC air/eau double service', { chauffage: { kind: 'pac', source: 'air_eau', annee: 2022, emetteurs: { type: 'plancher_chauffant', robinetsThermostatiques: false, temperature: 'basse_ou_moyenne', programmation: 'centrale' } }, ecs: { kind: 'comme_le_chauffage' } }],
    ['chaudière gaz + chauffe-eau gaz instantané', { ecs: { kind: 'chauffe_eau_gaz_instantane', annee: 2010 } }],
    ['chaudière gaz + poêle à bûches en appoint', { appoint: { kind: 'poele_buches', annee: 2012, flammeVerte: true } }],
    ['VMC double flux', { ventilation: { kind: 'vmc_df_echangeur', installAnnee: 2020 } }]
  ];

  for (const [nom, surcharge] of cas) {
    test(nom, () => {
      const r = calculer(petiteMaison(surcharge), { dateCalcul: DATE });
      assert.ok(Number.isFinite(r.energiePrimaireM2) && r.energiePrimaireM2 > 20 && r.energiePrimaireM2 < 900, `${r.energiePrimaireM2}`);
      assert.ok(Number.isFinite(r.gesM2));
      assert.match(r.etiquetteFinale, /^[A-G]$/);
      assert.ok(r.postes.chauffage.energieFinale > 0, 'chauffage non nul');
      assert.ok(r.postes.ecs.energieFinale > 0, 'ECS non nulle');
    });
  }
});

describe('appoint bois et garde-fou NaN', () => {
  test("un poêle à bûches en appoint réduit la consommation de gaz", () => {
    const sans = calculer(petiteMaison(), { dateCalcul: DATE });
    const avec = calculer(petiteMaison({ appoint: { kind: 'poele_buches', annee: 2012, flammeVerte: true } }), { dateCalcul: DATE });
    assert.ok(avec.postes.chauffage.energieFinale > 0);
    assert.ok(avec.gesM2 < sans.gesM2, `GES ${avec.gesM2} < ${sans.gesM2}`);
  });
});
