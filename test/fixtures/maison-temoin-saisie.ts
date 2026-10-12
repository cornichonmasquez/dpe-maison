// Maison témoin (fictive), décrite comme le ferait un utilisateur dans le formulaire :
// surfaces brutes, ouvertures posées sur des murs, aucune longueur de pont thermique.
// Même maison que maison-temoin-gaz.mjs : l'écart entre les deux mesure le coût de la saisie simplifiée.

import type { Maison, Mur, Ouverture } from '../../src/model/house.ts';

const iti1996 = { type: 'iti', annee: 1996 } as const;

const mur = (id: string, orientation: Mur['orientation'], surfaceBrute: number, extra: Partial<Mur> = {}): Mur => ({
  id,
  orientation,
  surfaceBrute,
  adjacence: 'exterieur',
  materiau: 'parpaing_creux',
  epaisseurCm: 20,
  isolation: iti1996,
  doublage: 'connu',
  ...extra
});

const garage = (id: string, orientation: Mur['orientation'], surfaceBrute: number, extra: Partial<Mur> = {}) =>
  mur(id, orientation, surfaceBrute, {
    adjacence: 'garage',
    lnc: { aiu: 20, aue: 48, paroisChauffeesIsolees: false, paroisExterieuresIsolees: false },
    ...extra
  });

const ouverture = (
  id: string,
  orientation: Ouverture['orientation'],
  surface: number,
  extra: Partial<Ouverture>
): Ouverture => ({
  id,
  orientation,
  surface,
  kind: 'fenetre_battante',
  menuiserie: 'alu_rupteur',
  vitrage: 'double',
  laMm: 12,
  gaz: 'air',
  fermeture: 'aucune',
  pose: 'nu_interieur',
  dormantCm: 5,
  joints: true,
  ...extra
});

export const maisonTemoin: Maison = {
  codePostal: '37000',
  altitudeM: 45,
  anneeConstruction: 1996,
  surfaceHabitable: 116,
  niveaux: 2,
  hauteurSousPlafondM: 2.5,
  murs: [
    mur('1', 'est', 31.2),
    mur('2', 'nord', 51.9),
    mur('3', 'ouest', 27.8),
    mur('4', 'sud', 26.9),
    garage('5', 'sud', 13.1),
    garage('6', 'ouest', 9.4, { doublage: 'lame_air_inf_15mm' })
  ],
  planchersBas: [
    { id: 'rdc', surface: 74, perimetre: 24, adjacence: 'terre_plein', type: 'dalle_beton', isolation: iti1996 }
  ],
  toitures: [
    {
      id: 'combles',
      surface: 22.1,
      kind: 'combles_perdus',
      structure: 'bois',
      isolation: { type: 'ite', annee: 1996 },
      lnc: { aiu: 22.1, aue: 30, paroisChauffeesIsolees: false, paroisExterieuresIsolees: false }
    },
    { id: 'rampants', surface: 37.5, kind: 'rampants', structure: 'inconnu', isolation: iti1996 },
    { id: 'terrasse', surface: 6, kind: 'terrasse', structure: 'bois', isolation: { type: 'ite', annee: 1996 } }
  ],
  ouvertures: [
    ouverture('f1', 'est', 2.4, { fermeture: 'volet_battant_pvc_bois' }),
    ouverture('f2', 'nord', 1.1, { kind: 'fenetre_coulissante' }),
    ouverture('f3', 'ouest', 1.2, { menuiserie: 'pvc', fermeture: 'volet_roulant_pvc_bois' }),
    ouverture('f4', 'ouest', 1.0, { menuiserie: 'pvc', fermeture: 'volet_roulant_pvc_bois' }),
    ouverture('f5', 'ouest', 2.4, { fermeture: 'volet_battant_pvc_bois' }),
    ouverture('pf1', 'est', 4.0, { kind: 'porte_fenetre_coulissante', fermeture: 'volet_roulant_alu' }),
    ouverture('pf2', 'est', 5.4, { kind: 'porte_fenetre_coulissante', fermeture: 'volet_roulant_alu' }),
    ouverture('pf3', 'nord', 3.9, { kind: 'porte_fenetre_coulissante', fermeture: 'volet_roulant_alu' })
  ],
  portes: [
    { id: 'entree', surface: 1.9, kind: 'isolee', murId: '4', joints: true },
    { id: 'garage', surface: 1.8, kind: 'bois_pleine', murId: '6', joints: false }
  ],
  ventilation: { kind: 'vmc_sf_autoreglable', installAnnee: 2013 },
  chauffage: {
    kind: 'chaudiere_gaz',
    techno: 'condensation',
    annee: 2012,
    emetteurs: {
      type: 'radiateur_bitube',
      robinetsThermostatiques: true,
      temperature: 'haute',
      annee: 1996,
      programmation: 'centrale'
    }
  },
  ecs: { kind: 'comme_le_chauffage', dansVolumeChauffe: false }
};
