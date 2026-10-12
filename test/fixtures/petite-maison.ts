import type { Maison } from '../../src/model/house.ts';

// Maison simple d'un niveau, pour les tests de matrice de systèmes.
export function petiteMaison(surcharge: Partial<Maison> = {}): Maison {
  return {
    codePostal: '35000',
    altitudeM: 40,
    anneeConstruction: 1975,
    surfaceHabitable: 90,
    niveaux: 1,
    hauteurSousPlafondM: 2.5,
    murs: [
      { id: 'n', orientation: 'nord', surfaceBrute: 28, adjacence: 'exterieur', materiau: 'parpaing_creux', epaisseurCm: 20, isolation: { type: 'inconnue' } },
      { id: 's', orientation: 'sud', surfaceBrute: 28, adjacence: 'exterieur', materiau: 'parpaing_creux', epaisseurCm: 20, isolation: { type: 'inconnue' } },
      { id: 'e', orientation: 'est', surfaceBrute: 22, adjacence: 'exterieur', materiau: 'parpaing_creux', epaisseurCm: 20, isolation: { type: 'inconnue' } },
      { id: 'o', orientation: 'ouest', surfaceBrute: 22, adjacence: 'exterieur', materiau: 'parpaing_creux', epaisseurCm: 20, isolation: { type: 'inconnue' } }
    ],
    planchersBas: [{ id: 'rdc', surface: 90, adjacence: 'vide_sanitaire', type: 'plancher_bois', isolation: { type: 'inconnue' } }],
    toitures: [{ id: 'toit', surface: 90, kind: 'combles_perdus', structure: 'bois', isolation: { type: 'iti', epaisseurCm: 10 } }],
    ouvertures: [
      { id: 'f1', orientation: 'sud', surface: 6, kind: 'fenetre_battante', menuiserie: 'pvc', vitrage: 'double', fermeture: 'volet_roulant_pvc_bois' },
      { id: 'f2', orientation: 'nord', surface: 3, kind: 'fenetre_battante', menuiserie: 'pvc', vitrage: 'double', fermeture: 'volet_roulant_pvc_bois' },
      { id: 'f3', orientation: 'est', surface: 2, kind: 'fenetre_battante', menuiserie: 'pvc', vitrage: 'double', fermeture: 'aucune' }
    ],
    portes: [{ id: 'p', surface: 2, kind: 'bois_pleine', orientation: 'nord' }],
    ventilation: { kind: 'ouverture_fenetres' },
    chauffage: {
      kind: 'chaudiere_gaz',
      techno: 'standard',
      annee: 2005,
      emetteurs: { type: 'radiateur_bitube', robinetsThermostatiques: true, temperature: 'moyenne' as any, annee: 1975, programmation: 'aucune' } as any
    },
    ecs: { kind: 'comme_le_chauffage' },
    ...surcharge
  };
}

