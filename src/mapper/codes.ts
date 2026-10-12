// Tables de correspondance : vocabulaire de l'utilisateur -> codes d'énumération ADEME du moteur 3CL.
// Les codes viennent de @open3cl/engine/enums.js (vérifiés contre ce fichier).

import type {
  AdjacenceMur,
  AdjacencePlancherBas,
  Cardinal,
  Fermeture,
  MurMateriau,
  OuvertureKind,
  PlancherBasType,
  PorteKind,
  TechnoChaudiere,
  ToitureStructure,
  VentilationKind
} from '../model/house.ts';

export const ORIENTATION: Record<Cardinal, number> = { sud: 1, nord: 2, est: 3, ouest: 4 };

/** Période de construction / d'isolation (même énumération). */
export function periodeDepuisAnnee(annee: number): number {
  if (annee < 1948) return 1;
  if (annee <= 1974) return 2;
  if (annee <= 1977) return 3;
  if (annee <= 1982) return 4;
  if (annee <= 1988) return 5;
  if (annee <= 2000) return 6;
  if (annee <= 2005) return 7;
  if (annee <= 2012) return 8;
  if (annee <= 2021) return 9;
  return 10;
}

export const ZONE_ID: Record<string, number> = {
  H1a: 1,
  H1b: 2,
  H1c: 3,
  H2a: 4,
  H2b: 5,
  H2c: 6,
  H2d: 7,
  H3: 8
};

export const ADJACENCE_MUR: Record<AdjacenceMur, number> = {
  exterieur: 1,
  sous_sol: 6,
  local_non_chauffe: 7,
  garage: 8,
  cellier: 9,
  veranda: 8, // approximation v1 : traitée comme un garage (voir avertissement)
  logement_voisin: 22,
  local_non_habitation: 4
};

/** Adjacences pour lesquelles le moteur exige Aiu, Aue et la configuration d'isolation (3.1_b.js). */
export const ADJACENCES_AVEC_AIU_AUE = new Set([8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21]);

export const ADJACENCE_PLANCHER_BAS: Record<AdjacencePlancherBas, number> = {
  terre_plein: 5,
  vide_sanitaire: 3,
  sous_sol: 6,
  garage: 8,
  cellier: 9,
  local_non_chauffe: 7,
  exterieur: 1,
  logement_dessous: 22
};

export const MURS_MATERIAU: Record<MurMateriau, number> = {
  inconnu: 1,
  pierre_massive: 2,
  pierre_remplissage: 3,
  pise: 4,
  pan_de_bois_sans_remplissage: 5,
  pan_de_bois_remplissage: 6,
  bois_rondin: 7,
  brique_pleine: 8,
  brique_pleine_double: 9,
  brique_creuse: 10,
  parpaing_plein: 11,
  parpaing_creux: 12,
  beton_banche: 13,
  brique_alveolaire: 15,
  beton_cellulaire: 16, // 17 à partir de 2013 (voir materiauMurId)
  sandwich_beton: 19,
  ossature_bois: 26 // 24 : 2001-2005, 18 : ≥ 2006 (voir materiauMurId)
};

/** Épaisseur (cm) retenue quand l'utilisateur ne la connaît pas : valeur courante du matériau. */
export const EPAISSEUR_DEFAUT_CM: Partial<Record<MurMateriau, number>> = {
  pierre_massive: 50,
  pierre_remplissage: 50,
  pise: 50,
  bois_rondin: 15,
  brique_pleine: 22,
  brique_pleine_double: 22,
  brique_creuse: 20,
  parpaing_plein: 20,
  parpaing_creux: 20,
  beton_banche: 20,
  brique_alveolaire: 37,
  beton_cellulaire: 20,
  sandwich_beton: 20,
  ossature_bois: 15
};

export function materiauMurId(materiau: MurMateriau, anneeConstruction: number): number {
  if (materiau === 'beton_cellulaire') return anneeConstruction >= 2013 ? 17 : 16;
  if (materiau === 'ossature_bois') {
    if (anneeConstruction >= 2006) return 18;
    if (anneeConstruction >= 2001) return 24;
    return 26;
  }
  return MURS_MATERIAU[materiau];
}

export const DOUBLAGE: Record<string, number> = {
  inconnu: 1,
  aucun: 2,
  lame_air_inf_15mm: 3,
  lame_air_sup_15mm: 4,
  connu: 5
};

export const PLANCHER_BAS_TYPE: Record<PlancherBasType, number> = {
  inconnu: 1,
  dalle_beton: 9,
  plancher_bois: 10,
  entrevous_terre_cuite: 11,
  entrevous_isolant: 12,
  voutains: 8
};

/** Type de plancher haut selon la structure ; les rampants sont traités à part. */
export function planchedHautTypeId(kind: string, structure: ToitureStructure): number {
  if (kind === 'rampants') return 12; // combles aménagés sous rampant
  switch (structure) {
    case 'bois_entre_solives':
      return 4;
    case 'bois_sur_solives':
      return 9;
    case 'bois_sous_solives':
      return 10;
    case 'plafond_remplissage':
      return 2;
    case 'beton':
      return 8; // dalle béton
    case 'hourdis':
      return 11; // entrevous terre cuite, poutrelles béton
    case 'plaque_platre':
      return 14;
    case 'bois':
      return kind === 'terrasse' ? 4 : 10;
    default:
      return 1;
  }
}

export const PLANCHER_HAUT_ADJACENCE: Record<string, number> = {
  combles_perdus: 11, // comble fortement ventilé
  combles_peu_ventiles: 12, // comble faiblement ventilé
  rampants: 1,
  terrasse: 1,
  plafond_sous_logement_ou_local: 22
};

// --- Baies -------------------------------------------------------------------------------------

export const TYPE_BAIE: Record<OuvertureKind, number> = {
  fenetre_battante: 4,
  fenetre_coulissante: 5,
  porte_fenetre_coulissante: 6,
  porte_fenetre_battante: 7, // sans soubassement
  porte_fenetre_battante_soubassement: 8,
  brique_de_verre: 2
};

export const MENUISERIE: Record<string, number> = {
  inconnue: 5, // pvc : valeur courante, signalée en avertissement
  pvc: 5,
  bois: 3,
  bois_metal: 4,
  alu_rupteur: 6,
  alu_sans_rupteur: 7
};

export const VITRAGE: Record<string, number> = { simple: 1, double: 2, triple: 3, survitrage: 4, inconnu: 2 };
export const GAZ_LAME: Record<string, number> = { air: 1, argon: 2, inconnu: 3 };
export const POSE: Record<string, number> = { nu_exterieur: 1, nu_interieur: 2, tunnel: 3 };

export const FERMETURE: Record<Fermeture, number> = {
  aucune: 1,
  persiennes_ajourees: 2,
  volet_roulant_alu: 3,
  volet_roulant_pvc_bois: 4, // épaisseur < 12 mm
  volet_roulant_pvc_bois_epais: 6, // épaisseur ≥ 12 mm
  volet_battant_pvc_bois: 5, // épaisseur < 22 mm
  volet_battant_pvc_bois_epais: 7, // épaisseur ≥ 22 mm
  volet_isole: 8
};

/**
 * Masque lointain homogène : ligne de la table pour l'orientation et la hauteur apparente.
 * Orientations : 1 sud, 2 nord, 3/4 est-ouest. Ids dans tv.coef_masque_lointain_homogene.
 */
export function masqueLointainHomogeneId(
  orientation: Cardinal,
  hauteur: 'aucun' | 'moins_15' | '15_30' | '30_60' | 'plus_60'
): number {
  const rang = { aucun: 0, moins_15: 0, '15_30': 1, '30_60': 2, plus_60: 3 }[hauteur];
  const base = orientation === 'nord' ? 1 : orientation === 'sud' ? 5 : 9;
  return base + rang;
}

export const MASQUE_PROCHE_ID = { aucun: 19 } as const;

export const PORTE_TYPE: Record<PorteKind, number> = {
  bois_pleine: 1,
  bois_vitree: 4,
  pvc_pleine: 5,
  pvc_vitree: 8,
  metal_pleine: 9,
  metal_vitree: 11,
  isolee: 13,
  autre: 16
};

// --- Ventilation -------------------------------------------------------------------------------

export function ventilationId(kind: VentilationKind, annee: number): number {
  const avant1982 = annee < 1982;
  const avant2001 = annee < 2001;
  const avant2013 = annee < 2013;
  switch (kind) {
    case 'ouverture_fenetres':
      return 1;
    case 'entrees_air':
      return 2;
    case 'conduit_naturel':
      return 25;
    case 'vmc_sf_autoreglable':
      return avant1982 ? 3 : avant2001 ? 4 : annee <= 2012 ? 5 : 6;
    case 'vmc_sf_hygro_a':
      return avant2001 ? 7 : annee <= 2012 ? 8 : 9;
    case 'vmc_sf_hygro_b':
      return avant2001 ? 13 : annee <= 2012 ? 14 : 15;
    case 'vmc_df_echangeur':
      return avant2013 ? 19 : 20;
    case 'vmc_df_sans_echangeur':
      return avant2013 ? 23 : 24;
  }
}

// --- Générateurs -------------------------------------------------------------------------------

/** Chaudière gaz (id générateur chauffage). La chaudière ECS correspondante a l'id − 40. */
export function chaudiereGazId(techno: TechnoChaudiere, annee: number): number {
  switch (techno) {
    case 'classique':
      return annee < 1981 ? 85 : annee < 1986 ? 86 : 87;
    case 'standard':
      return annee <= 2000 ? 88 : annee <= 2015 ? 89 : 90;
    case 'basse_temperature':
      return annee <= 2000 ? 91 : annee <= 2015 ? 92 : 93;
    case 'condensation':
      return annee < 1986 ? 94 : annee <= 2000 ? 95 : annee <= 2015 ? 96 : 97;
  }
}

export function chaudiereFioulId(techno: TechnoChaudiere, annee: number): number {
  switch (techno) {
    case 'classique':
      return annee < 1970 ? 75 : annee < 1976 ? 76 : annee < 1981 ? 77 : 78;
    case 'standard':
      return annee <= 2015 ? 79 : 80;
    case 'basse_temperature':
      return annee <= 2015 ? 81 : 82;
    case 'condensation':
      return annee <= 2015 ? 83 : 84;
  }
}

export function pacId(source: string, annee: number): number {
  switch (source) {
    case 'air_air':
      return annee < 2008 ? 1 : annee <= 2014 ? 2 : 3;
    case 'air_eau':
      return annee < 2008 ? 4 : annee <= 2014 ? 5 : annee <= 2016 ? 6 : 7;
    case 'eau_eau':
      return annee < 2008 ? 8 : annee <= 2014 ? 9 : annee <= 2016 ? 10 : 11;
    default: // géothermique
      return annee < 2008 ? 16 : annee <= 2014 ? 17 : annee <= 2016 ? 18 : 19;
  }
}

export const ELECTRIQUE_DIRECT_GENERATEUR: Record<string, number> = {
  convecteur: 98,
  panneau_rayonnant: 99,
  radiateur: 100,
  plancher_rayonnant: 102,
  accumulation: 104
};

export const ELECTRIQUE_DIRECT_EMETTEUR: Record<string, number> = {
  convecteur: 1,
  panneau_rayonnant: 2,
  radiateur: 3,
  plancher_rayonnant: 8,
  accumulation: 10
};

/** Émetteur à eau, réseau individuel. */
export function emetteurEauId(
  type: string,
  thermostatique: boolean,
  temperature: 'haute' | 'basse_ou_moyenne'
): number {
  const haute = temperature === 'haute';
  switch (type) {
    case 'plancher_chauffant':
      return haute ? 13 : 14;
    case 'radiateur_monotube':
      return thermostatique ? (haute ? 30 : 31) : haute ? 26 : 27;
    default: // radiateur_bitube
      return thermostatique ? (haute ? 38 : 39) : haute ? 34 : 35;
  }
}

export function appointBoisId(kind: string, annee: number, flammeVerte: boolean): number {
  if (kind === 'poele_granules') return annee < 2012 ? 44 : annee < 2020 ? 45 : 46;
  const base = kind === 'insert' ? 23 : 22; // poêle bûche / insert avant 1990
  const decalage = annee < 1990 ? 0 : annee < 2005 ? 4 : !flammeVerte ? 8 : annee <= 2006 ? 12 : annee <= 2017 ? 16 : 20;
  return base + decalage;
}

export function cetId(source: 'air_ambiant' | 'air_exterieur' | 'air_extrait', annee: number): number {
  const base = { air_ambiant: 1, air_exterieur: 4, air_extrait: 7 }[source];
  return base + (annee < 2010 ? 0 : annee <= 2014 ? 1 : 2);
}

export function chauffeEauGazInstantaneId(annee: number): number {
  if (annee < 1981) return 63;
  if (annee < 1990) return 64;
  if (annee <= 2000) return 65;
  if (annee <= 2015) return 66;
  return 67;
}

export function accumulateurGazId(annee: number): number {
  if (annee < 1990) return 58;
  if (annee <= 2000) return 59;
  return 60;
}
