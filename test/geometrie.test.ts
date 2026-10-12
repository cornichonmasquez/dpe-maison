import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { aire, aretes, cardinalDepuisAzimut, hauteurFacade, nettoyer, resume, valide, versMetres } from '../src/geo/geometrie.ts';
import type { Coord } from '../src/geo/geometrie.ts';

// Rectangles construits vers 47,5° N. 1 m ≈ 1/111 195 degré de latitude.
const LAT = 47.5;
const DLAT = 1 / 111195;
const DLON = DLAT / Math.cos((LAT * Math.PI) / 180);
const rectangle = (largeur: number, hauteur: number, antihoraire = true): Coord[] => {
  const o: Coord[] = [
    [0, LAT],
    [largeur * DLON, LAT],
    [largeur * DLON, LAT + hauteur * DLAT],
    [0, LAT + hauteur * DLAT]
  ];
  return antihoraire ? o : o.slice().reverse();
};

describe('géométrie du plan', () => {
  test('aire et périmètre d’un rectangle 10 × 6', () => {
    const r = resume(rectangle(10, 6));
    assert.ok(Math.abs(r.aireM2 - 60) < 0.2, `aire ${r.aireM2}`);
    assert.ok(Math.abs(r.perimetreM - 32) < 0.1, `périmètre ${r.perimetreM}`);
  });

  test('orientations des façades (rectangle antihoraire)', () => {
    const a = aretes(rectangle(10, 6));
    // sommets : SO, SE, NE, NO -> arêtes sud, est, nord, ouest
    assert.deepEqual(a.map((x) => x.orientation), ['sud', 'est', 'nord', 'ouest']);
    assert.ok(Math.abs(a[0].longueurM - 10) < 0.05);
    assert.ok(Math.abs(a[1].longueurM - 6) < 0.05);
  });

  test('le sens de dessin ne change pas les orientations', () => {
    const horaire = aretes(rectangle(10, 6, false)).map((x) => x.orientation).sort();
    assert.deepEqual(horaire, ['est', 'nord', 'ouest', 'sud']);
  });

  test('cardinal depuis un azimut', () => {
    assert.equal(cardinalDepuisAzimut(0), 'nord');
    assert.equal(cardinalDepuisAzimut(44.9), 'nord');
    assert.equal(cardinalDepuisAzimut(90), 'est');
    assert.equal(cardinalDepuisAzimut(180), 'sud');
    assert.equal(cardinalDepuisAzimut(270), 'ouest');
    assert.equal(cardinalDepuisAzimut(-10), 'nord');
  });

  test('un L est bien orienté : 6 façades reconnues', () => {
    const L: Coord[] = [
      [0, LAT],
      [12 * DLON, LAT],
      [12 * DLON, LAT + 4 * DLAT],
      [7 * DLON, LAT + 4 * DLAT],
      [7 * DLON, LAT + 8 * DLAT],
      [0, LAT + 8 * DLAT]
    ];
    const r = resume(L);
    assert.equal(r.aretes.length, 6);
    assert.ok(Math.abs(r.aireM2 - (12 * 4 + 7 * 4)) < 0.4, `aire ${r.aireM2}`);
    const c = r.aretes.map((a) => a.orientation);
    assert.equal(c.filter((x) => x === 'sud').length, 1);
    assert.equal(c.filter((x) => x === 'ouest').length, 1);
    assert.equal(c.filter((x) => x === 'nord').length, 2);
    assert.equal(c.filter((x) => x === 'est').length, 2);
  });

  test('nettoyage : sommet aligné et doublon de fermeture supprimés', () => {
    const r = rectangle(10, 6);
    const avecAligne: Coord[] = [r[0], [5 * DLON, LAT], r[1], r[2], r[3], r[0]];
    assert.equal(nettoyer(avecAligne).length, 4);
  });

  test('validité : trop petit, croisé, correct', () => {
    assert.equal(valide(rectangle(1, 1)).ok, false);
    assert.equal(valide(rectangle(10, 6)).ok, true);
    const noeud: Coord[] = [
      [0, LAT],
      [10 * DLON, LAT + 6 * DLAT],
      [10 * DLON, LAT],
      [0, LAT + 6 * DLAT]
    ];
    assert.equal(valide(noeud).ok, false);
  });

  test('hauteur de façade', () => {
    assert.equal(hauteurFacade(1, 2.5), 2.5);
    assert.ok(Math.abs(hauteurFacade(2, 2.5) - 5.3) < 1e-9);
  });

  test('conversion en mètres isotrope', () => {
    assert.ok(Math.abs(aire(versMetres(rectangle(10, 6))) - 60) < 0.2);
  });
});
