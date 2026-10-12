import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { appliquerPlan, mursDepuisPlan } from '../src/geo/versMaison.ts';
import type { Coord } from '../src/geo/geometrie.ts';
import { calculer } from '../src/engine/calculate.ts';
import { buildDpe } from '../src/mapper/buildDpe.ts';
import { petiteMaison } from './fixtures/petite-maison.ts';

const LAT = 47.5;
const DLAT = 1 / 111195;
const DLON = DLAT / Math.cos((LAT * Math.PI) / 180);
// Maison de 12 × 8 m (96 m² d'empreinte), dessinée sens antihoraire depuis le coin sud-ouest.
const anneau: Coord[] = [
  [0, LAT],
  [12 * DLON, LAT],
  [12 * DLON, LAT + 8 * DLAT],
  [0, LAT + 8 * DLAT]
];

describe('plan dessiné -> saisie', () => {
  test('un mur par façade, longueur × hauteur, orientation correcte', () => {
    const murs = mursDepuisPlan({ anneau, adjacences: ['exterieur', 'exterieur', 'exterieur', 'garage'] }, { niveaux: 2, hauteurSousPlafondM: 2.5 });
    assert.equal(murs.length, 4);
    assert.deepEqual(murs.map((m) => m.orientation), ['sud', 'est', 'nord', 'ouest']);
    assert.ok(Math.abs(murs[0].longueurM! - 12) < 0.1);
    assert.ok(Math.abs(murs[0].surfaceBrute - 12 * 5.3) < 0.7, `surface ${murs[0].surfaceBrute}`);
    assert.equal(murs[3].adjacence, 'garage');
  });

  test('applique le plan : sol, toit, périmètre et ouvertures par façade', () => {
    const m = petiteMaison({ niveaux: 2 });
    appliquerPlan(m, { anneau, adjacences: ['exterieur', 'exterieur', 'exterieur', 'logement_voisin'] }, { regenererOuvertures: true });
    assert.equal(m.murs.length, 4);
    assert.ok(Math.abs(m.planchersBas[0].surface - 96) < 0.6);
    // le mur mitoyen n'entre pas dans le périmètre en contact avec l'extérieur : 12 + 8 + 12 = 32
    assert.ok(Math.abs(m.planchersBas[0].perimetre! - 32) < 0.4, `périmètre ${m.planchersBas[0].perimetre}`);
    assert.ok(Math.abs(m.toitures[0].surface - 96) < 0.6);
    assert.ok(m.ouvertures.length >= 3 && m.ouvertures.every((o) => o.surface > 0));
  });

  test('les caractéristiques du mur existant sont reprises', () => {
    const m = petiteMaison();
    m.murs[0].materiau = 'brique_creuse';
    m.murs[0].isolation = { type: 'ite', epaisseurCm: 12 };
    appliquerPlan(m, { anneau, adjacences: ['exterieur', 'exterieur', 'exterieur', 'exterieur'] }, { regenererOuvertures: true });
    assert.ok(m.murs.every((x) => x.materiau === 'brique_creuse' && x.isolation.type === 'ite'));
  });

  test('la maison issue du plan est calculable', () => {
    const m = petiteMaison({ niveaux: 2, surfaceHabitable: 150 });
    appliquerPlan(m, { anneau, adjacences: ['exterieur', 'exterieur', 'exterieur', 'exterieur'] }, { regenererOuvertures: true });
    const r = calculer(m, { dateCalcul: '2026-10-11' });
    assert.ok(Number.isFinite(r.energiePrimaireM2) && r.energiePrimaireM2 > 20);
    assert.match(r.etiquetteFinale, /^[A-G]$/);
  });

  test('les ponts thermiques utilisent les longueurs du plan', () => {
    const m = petiteMaison({ niveaux: 2, surfaceHabitable: 150 });
    appliquerPlan(m, { anneau, adjacences: ['exterieur', 'exterieur', 'exterieur', 'exterieur'] }, { regenererOuvertures: true });
    const dpe = buildDpe(m, { dateCalcul: '2026-10-11' }).dpe;
    const pts: any[] = dpe.logement.enveloppe.pont_thermique_collection.pont_thermique;
    const planchers = pts.filter((p) => p.donnee_entree.enum_type_liaison_id === 1);
    const total = planchers.reduce((s, p) => s + p.donnee_entree.l, 0);
    // plancher bas / mur : développé de l'empreinte = périmètre de 40 m
    assert.ok(Math.abs(total - 40) < 0.8, `somme ${total}`);
  });
});
