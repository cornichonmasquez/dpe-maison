// Construit l'entrée du moteur 3CL-DPE (JSON ADEME) à partir de la saisie de l'utilisateur.
//
// Règles de conduite :
//  - toute donnée « inconnue » prend la valeur par défaut légale (table forfaitaire du moteur) ;
//  - toute valeur par défaut ou approximation est tracée dans `avertissements` ;
//  - jamais de résultat silencieux : une saisie incohérente lève une `ErreurSaisie`.

import { Inertie } from '@open3cl/engine/7_inertie.js';
import { ZONE_PAR_DEPARTEMENT } from '../data/departements.ts';
import type {
  ChauffagePrincipal,
  Ecs,
  Isolation,
  Maison,
  Mur,
  Ouverture,
  PlancherBas,
  Porte,
  Toiture
} from '../model/house.ts';
import * as C from './codes.ts';

export class ErreurSaisie extends Error {
  champs: string[];
  constructor(message: string, champs: string[] = []) {
    super(message);
    this.name = 'ErreurSaisie';
    this.champs = champs;
  }
}

export interface OptionsBuild {
  /** Date de calcul (AAAA-MM-JJ) : pilote le barème des coûts. Défaut : aujourd'hui. */
  dateCalcul?: string;
  /** Version du schéma ADEME : règles de calcul de la méthode. Défaut : la plus récente. */
  versionSchema?: string;
  /** Pondération des ponts thermiques estimés, par type de liaison (défaut 1 : méthode complète). */
  facteursPontsThermiques?: Partial<Record<'planchierBas' | 'intermediaire' | 'plancherHaut' | 'refend' | 'menuiserie', number>>;
}

export interface Deduit {
  departement: string;
  zoneClimatique: string;
  classeAltitude: 1 | 2 | 3;
  periodeConstruction: number;
  inertie: 'légère' | 'moyenne' | 'lourde' | 'très lourde';
  plusieursFacadesExposees: boolean;
}

export interface ResultatBuild {
  dpe: any;
  deduit: Deduit;
  avertissements: string[];
}

const NOMS_INERTIE = { 1: 'très lourde', 2: 'lourde', 3: 'moyenne', 4: 'légère' } as const;

// --- Localisation ------------------------------------------------------------------------------

export function departementDepuisCodePostal(codePostal: string): string {
  const cp = codePostal.trim().toUpperCase();
  if (/^(2A|2B)$/.test(cp)) return cp;
  if (!/^\d{2}(\d{3})?$/.test(cp)) {
    throw new ErreurSaisie('Code postal invalide : 5 chiffres attendus.', ['codePostal']);
  }
  const dep = cp.slice(0, 2);
  if (dep === '20') {
    if (cp.length < 5) throw new ErreurSaisie('Code postal complet requis pour la Corse.', ['codePostal']);
    return Number(cp) < 20200 ? '2A' : '2B';
  }
  return dep;
}

// --- Isolation ---------------------------------------------------------------------------------

const TYPE_ISOLATION = { aucune: 2, inconnue: 1, iti: 3, ite: 4, itr: 5, oui_type_inconnu: 9 } as const;

function champsIsolation(iso: Isolation, periodeIsolation?: number) {
  const type = TYPE_ISOLATION[iso.type];
  if (iso.type === 'aucune') return { enum_type_isolation_id: type, enum_methode_saisie_u_id: 1 };
  if (iso.type === 'inconnue') return { enum_type_isolation_id: type, enum_methode_saisie_u_id: 2 };
  if (iso.resistance && iso.resistance > 0) {
    return {
      enum_type_isolation_id: type,
      enum_methode_saisie_u_id: 5,
      resistance_isolation: iso.resistance
    };
  }
  if (iso.epaisseurCm && iso.epaisseurCm > 0) {
    return {
      enum_type_isolation_id: type,
      enum_methode_saisie_u_id: 3,
      epaisseur_isolation: iso.epaisseurCm
    };
  }
  if (iso.annee) {
    return {
      enum_type_isolation_id: type,
      enum_methode_saisie_u_id: 7,
      enum_periode_isolation_id: C.periodeDepuisAnnee(iso.annee)
    };
  }
  // Isolation présente, année inconnue : on suppose l'année de construction... sauf avant 1975, où la méthode
  // impose l'année d'isolation 1975-1977. On la saisit explicitement (méthode 7) : avec la méthode 8 le moteur,
  // en mode compatibilité, retombe sur l'année de construction et surestime les déperditions.
  if (periodeIsolation !== undefined && periodeIsolation <= 2) {
    return { enum_type_isolation_id: type, enum_methode_saisie_u_id: 7, enum_periode_isolation_id: 3 };
  }
  return {
    enum_type_isolation_id: type,
    enum_methode_saisie_u_id: 8,
    ...(periodeIsolation ? { enum_periode_isolation_id: periodeIsolation } : {})
  };
}

/** Configuration d'isolation d'un local non chauffé (3.1 : coefficient b). */
function champsLnc(
  adjacenceId: number,
  surfaceParoi: number,
  lnc: { aiu?: number; aue?: number; paroisChauffeesIsolees?: boolean; paroisExterieuresIsolees?: boolean } | undefined,
  paroiIsolee: boolean
) {
  if (!C.ADJACENCES_AVEC_AIU_AUE.has(adjacenceId)) return {};
  const aiu = lnc?.aiu ?? surfaceParoi;
  const aue = lnc?.aue ?? aiu * 2;
  const chauffeesIsolees = lnc?.paroisChauffeesIsolees ?? paroiIsolee;
  const exterieuresIsolees = lnc?.paroisExterieuresIsolees ?? false;
  const cfg = chauffeesIsolees ? (exterieuresIsolees ? 5 : 4) : exterieuresIsolees ? 3 : 2;
  return { surface_aiu: aiu, surface_aue: aue, enum_cfg_isolation_lnc_id: cfg };
}

const estIsolee = (iso: Isolation) => iso.type !== 'aucune' && iso.type !== 'inconnue';

// --- Construction ------------------------------------------------------------------------------

export function buildDpe(maison: Maison, options: OptionsBuild = {}): ResultatBuild {
  const avertissements: string[] = [];
  const avertir = (m: string) => avertissements.push(m);

  validerMaison(maison);

  const dateCalcul = options.dateCalcul ?? new Date().toISOString().slice(0, 10);
  const versionSchema = options.versionSchema ?? '2.5';

  // Localisation et paramètres déduits
  const departement = departementDepuisCodePostal(maison.codePostal);
  const zone = maison.zoneClimatique ?? ZONE_PAR_DEPARTEMENT[departement];
  if (!zone || !(zone in C.ZONE_ID)) throw new ErreurSaisie(`Département ${departement} non pris en charge (métropole uniquement).`, ['codePostal']);

  let classeAltitude: 1 | 2 | 3 = 1;
  if (maison.altitudeM === undefined) {
    avertir('Altitude non renseignée : moins de 400 m supposé.');
  } else {
    classeAltitude = maison.altitudeM < 400 ? 1 : maison.altitudeM <= 800 ? 2 : 3;
  }
  const periodeConstruction = C.periodeDepuisAnnee(maison.anneeConstruction);
  const hsp = maison.hauteurSousPlafondM;

  // Ouvertures : placement sur un mur
  const placement = new Map<string, string>(); // id ouverture/porte -> id mur
  const murPourOrientation = (orientation: string, id?: string): Mur | undefined =>
    id
      ? maison.murs.find((m) => m.id === id)
      : (maison.murs.find((m) => m.orientation === orientation && m.adjacence === 'exterieur') ??
        maison.murs.find((m) => m.orientation === orientation));

  const surfaceOuvertePar = new Map<string, number>();
  const ajouteOuvert = (murId: string, s: number) =>
    surfaceOuvertePar.set(murId, (surfaceOuvertePar.get(murId) ?? 0) + s);

  for (const o of maison.ouvertures) {
    const mur = murPourOrientation(o.orientation, o.murId);
    if (!mur) {
      throw new ErreurSaisie(
        `L'ouverture « ${o.id} » (${o.orientation}) n'est posée sur aucun mur : ajoutez un mur orienté ${o.orientation}.`,
        [`ouvertures.${o.id}`]
      );
    }
    placement.set(o.id, mur.id);
    ajouteOuvert(mur.id, o.surface);
  }
  for (const p of maison.portes) {
    const mur = p.murId
      ? maison.murs.find((m) => m.id === p.murId)
      : p.orientation
        ? murPourOrientation(p.orientation)
        : maison.murs.find((m) => m.adjacence === 'exterieur');
    if (!mur) throw new ErreurSaisie(`La porte « ${p.id} » n'est posée sur aucun mur.`, [`portes.${p.id}`]);
    placement.set(p.id, mur.id);
    ajouteOuvert(mur.id, p.surface);
  }

  // Murs
  const murs = maison.murs.map((m) => construireMur(m, maison, surfaceOuvertePar, avertir));
  const referenceMur = (id: string) => `mur_${id}`;

  // Planchers bas
  const planchersBas = maison.planchersBas.map((p) => construirePlancherBas(p, maison, avertir));

  // Toitures / planchers hauts
  const planchersHauts = maison.toitures.map((t) => construireToiture(t, maison));

  // Ouvertures
  const baies = maison.ouvertures.map((o) =>
    construireBaie(o, maison, referenceMur(placement.get(o.id)!), murAdjacenceId(maison, placement.get(o.id)!), avertir)
  );
  const portes = maison.portes.map((p) =>
    construirePorte(p, maison, referenceMur(placement.get(p.id)!), placement.get(p.id)!)
  );

  const pontsThermiques = estimerPontsThermiques(maison, placement, hsp, avertir, options.facteursPontsThermiques);

  const enveloppe: any = {
    mur_collection: { mur: murs },
    plancher_bas_collection: { plancher_bas: planchersBas },
    plancher_haut_collection: { plancher_haut: planchersHauts },
    baie_vitree_collection: { baie_vitree: baies },
    porte_collection: { porte: portes },
    ets_collection: {},
    pont_thermique_collection: { pont_thermique: pontsThermiques }
  };

  // Inertie : même règle que le moteur (classe Inertie du moteur)
  const inertie = new Inertie().calculateInertie(structuredClone(enveloppe));
  enveloppe.inertie = inertie;
  const nomInertie = NOMS_INERTIE[Number(inertie.enum_classe_inertie_id) as 1 | 2 | 3 | 4];

  const facades = new Set(maison.murs.filter((m) => m.adjacence === 'exterieur').map((m) => m.orientation));
  const plusieursFacades = facades.size >= 2;

  const systemes = construireSystemes(maison, plusieursFacades, avertir);

  const dpe = {
    administratif: {
      date_visite_diagnostiqueur: dateCalcul,
      date_etablissement_dpe: dateCalcul,
      enum_modele_dpe_id: 1,
      enum_version_id: versionSchema
    },
    logement: {
      caracteristique_generale: {
        annee_construction: maison.anneeConstruction,
        enum_periode_construction_id: periodeConstruction,
        enum_methode_application_dpe_log_id: 1,
        surface_habitable_logement: maison.surfaceHabitable,
        nombre_niveau_logement: maison.niveaux,
        nombre_niveau_immeuble: maison.niveaux,
        hsp,
        nombre_appartement: 1,
        appartement_non_visite: 0
      },
      meteo: {
        enum_zone_climatique_id: C.ZONE_ID[zone],
        enum_classe_altitude_id: classeAltitude,
        batiment_materiaux_anciens: materiauxAnciens(maison) ? 1 : 0
      },
      enveloppe,
      ...systemes
    }
  };

  return {
    dpe,
    deduit: {
      departement,
      zoneClimatique: zone,
      classeAltitude,
      periodeConstruction,
      inertie: nomInertie,
      plusieursFacadesExposees: plusieursFacades
    },
    avertissements
  };
}

const MATERIAUX_ANCIENS = new Set([
  'pierre_massive', 'pierre_remplissage', 'pise', 'pan_de_bois_sans_remplissage', 'pan_de_bois_remplissage',
  'bois_rondin', 'brique_pleine', 'brique_pleine_double'
]);

function materiauxAnciens(m: Maison): boolean {
  if (m.materiauxAnciens !== undefined) return m.materiauxAnciens;
  if (m.anneeConstruction >= 1948) return false;
  const total = m.murs.reduce((a, x) => a + x.surfaceBrute, 0);
  const anciens = m.murs.filter((x) => MATERIAUX_ANCIENS.has(x.materiau)).reduce((a, x) => a + x.surfaceBrute, 0);
  return total > 0 && anciens / total > 0.5;
}

// --- Validation --------------------------------------------------------------------------------

function validerMaison(m: Maison): void {
  const erreurs: string[] = [];
  const champs: string[] = [];
  const exige = (ok: boolean, msg: string, champ: string) => {
    if (!ok) {
      erreurs.push(msg);
      champs.push(champ);
    }
  };
  exige(m.surfaceHabitable >= 9 && m.surfaceHabitable <= 1000, 'Surface habitable : entre 9 et 1000 m².', 'surfaceHabitable');
  exige(m.anneeConstruction >= 1000 && m.anneeConstruction <= new Date().getFullYear(), 'Année de construction invalide.', 'anneeConstruction');
  exige(m.niveaux >= 1 && m.niveaux <= 6, 'Nombre de niveaux : entre 1 et 6.', 'niveaux');
  exige(m.hauteurSousPlafondM >= 1.8 && m.hauteurSousPlafondM <= 6, 'Hauteur sous plafond : entre 1,8 et 6 m.', 'hauteurSousPlafondM');
  exige(m.murs.length > 0, 'Décrivez au moins un mur.', 'murs');
  exige(m.planchersBas.length > 0, 'Décrivez au moins un plancher bas.', 'planchersBas');
  exige(m.toitures.length > 0, 'Décrivez au moins une toiture ou un plafond.', 'toitures');
  for (const mur of m.murs) {
    exige(mur.surfaceBrute > 0, `Mur « ${mur.id} » : surface requise.`, `murs.${mur.id}`);
  }
  if (erreurs.length) throw new ErreurSaisie(erreurs.join(' '), champs);
}

// --- Parois ------------------------------------------------------------------------------------

function murAdjacenceId(maison: Maison, murId: string): number {
  const m = maison.murs.find((x) => x.id === murId)!;
  return C.ADJACENCE_MUR[m.adjacence];
}

function construireMur(
  m: Mur,
  maison: Maison,
  ouvert: Map<string, number>,
  avertir: (s: string) => void
) {
  const adjacence = C.ADJACENCE_MUR[m.adjacence];
  if (m.adjacence === 'veranda') {
    avertir(`Mur « ${m.id} » sur véranda : traité comme un garage (approximation v1).`);
  }
  const sOuvert = ouvert.get(m.id) ?? 0;
  const opaque = m.surfaceBrute - sOuvert;
  if (opaque <= 0) {
    throw new ErreurSaisie(
      `Mur « ${m.id} » : les fenêtres et portes (${sOuvert.toFixed(1)} m²) occupent toute la surface du mur (${m.surfaceBrute} m²).`,
      [`murs.${m.id}`]
    );
  }
  const materiauId = C.materiauMurId(m.materiau, maison.anneeConstruction);
  let epaisseur = m.epaisseurCm;
  if (epaisseur === undefined && ![1, 6, 20, 27].includes(materiauId)) {
    epaisseur = C.EPAISSEUR_DEFAUT_CM[m.materiau];
    if (epaisseur !== undefined) {
      avertir(`Mur « ${m.id} » : épaisseur inconnue, ${epaisseur} cm supposé pour ce matériau.`);
    }
  }
  const periodeConstruction = C.periodeDepuisAnnee(maison.anneeConstruction);
  const iso = champsIsolation(m.isolation, periodeConstruction);
  if (m.isolation.type === 'inconnue') {
    avertir(`Mur « ${m.id} » : isolation inconnue, valeur forfaitaire selon l'année de construction.`);
  }
  return {
    donnee_entree: {
      reference: `mur_${m.id}`,
      description: `Mur ${m.id} (${m.materiau.replace(/_/g, ' ')})`,
      enum_type_adjacence_id: adjacence,
      enum_orientation_id: C.ORIENTATION[m.orientation],
      surface_paroi_totale: m.surfaceBrute,
      surface_paroi_opaque: opaque,
      enum_materiaux_structure_mur_id: materiauId,
      ...(epaisseur !== undefined ? { epaisseur_structure: epaisseur } : {}),
      enum_methode_saisie_u0_id: materiauId === 1 ? 1 : 2,
      paroi_ancienne: m.enduitIsolant ? 1 : 0,
      enum_type_doublage_id: C.DOUBLAGE[m.doublage ?? 'inconnu'],
      ...iso,
      ...champsLnc(adjacence, m.surfaceBrute, m.lnc, estIsolee(m.isolation))
    },
    donnee_intermediaire: {}
  };
}

function construirePlancherBas(p: PlancherBas, maison: Maison, avertir: (s: string) => void) {
  const adjacence = C.ADJACENCE_PLANCHER_BAS[p.adjacence];
  const perimetre = p.perimetre ?? Math.round(4 * Math.sqrt(p.surface) * 1.1 * 10) / 10;
  if (p.perimetre === undefined && (p.adjacence === 'terre_plein' || p.adjacence === 'vide_sanitaire' || p.adjacence === 'sous_sol')) {
    avertir(`Plancher bas « ${p.id} » : périmètre estimé à ${perimetre} m (forme compacte supposée).`);
  }
  const periodeConstruction = C.periodeDepuisAnnee(maison.anneeConstruction);
  const iso = champsIsolation(p.isolation, periodeConstruction);
  return {
    donnee_entree: {
      reference: `plancher_bas_${p.id}`,
      description: `Plancher bas ${p.id}`,
      enum_type_adjacence_id: adjacence,
      surface_paroi_opaque: p.surface,
      surface_ue: p.surface,
      perimetre_ue: perimetre,
      calcul_ue: 1,
      enum_type_plancher_bas_id: C.PLANCHER_BAS_TYPE[p.type],
      enum_methode_saisie_u0_id: p.type === 'inconnu' ? 1 : 2,
      ...iso,
      ...champsLnc(adjacence, p.surface, p.lnc, estIsolee(p.isolation))
    },
    donnee_intermediaire: {}
  };
}

function construireToiture(t: Toiture, maison: Maison) {
  const adjacence = C.PLANCHER_HAUT_ADJACENCE[t.kind];
  const typeId = C.planchedHautTypeId(t.kind, t.structure);
  const periodeConstruction = C.periodeDepuisAnnee(maison.anneeConstruction);
  const iso = champsIsolation(t.isolation, periodeConstruction);
  return {
    donnee_entree: {
      reference: `plancher_haut_${t.id}`,
      description: `Toiture ${t.id} (${t.kind.replace(/_/g, ' ')})`,
      enum_type_adjacence_id: adjacence,
      surface_paroi_opaque: t.surface,
      enum_type_plancher_haut_id: typeId,
      enum_methode_saisie_u0_id: typeId === 1 ? 1 : 2,
      ...iso,
      ...champsLnc(adjacence, t.surface, t.lnc, estIsolee(t.isolation))
    },
    donnee_intermediaire: {}
  };
}

function construireBaie(
  o: Ouverture,
  maison: Maison,
  murRef: string,
  adjacenceId: number,
  avertir: (s: string) => void
) {
  if (o.menuiserie === 'inconnue') {
    avertir(`Ouverture « ${o.id} » : matériau de menuiserie inconnu, PVC supposé.`);
  }
  if (o.vitrage === 'inconnu') {
    avertir(`Ouverture « ${o.id} » : type de vitrage inconnu, double vitrage supposé.`);
  }
  const avecLame = o.vitrage === 'double' || o.vitrage === 'inconnu' || o.vitrage === 'triple';
  return {
    donnee_entree: {
      reference: `baie_${o.id}`,
      reference_paroi: murRef,
      description: `Ouverture ${o.id}`,
      enum_type_adjacence_id: adjacenceId === 22 ? 1 : adjacenceId === 8 ? 8 : 1,
      surface_totale_baie: o.surface,
      nb_baie: o.nombre ?? 1,
      enum_type_vitrage_id: C.VITRAGE[o.vitrage],
      enum_inclinaison_vitrage_id: 3,
      enum_type_gaz_lame_id: C.GAZ_LAME[o.gaz ?? 'air'],
      ...(avecLame ? { epaisseur_lame: o.laMm ?? 12 } : {}),
      vitrage_vir: o.peuEmissif ? 1 : 0,
      enum_methode_saisie_perf_vitrage_id: 1,
      enum_type_materiaux_menuiserie_id: C.MENUISERIE[o.menuiserie],
      enum_type_baie_id: C.TYPE_BAIE[o.kind],
      double_fenetre: 0,
      enum_type_fermeture_id: C.FERMETURE[o.fermeture],
      presence_retour_isolation: 0,
      largeur_dormant: o.dormantCm ?? 5,
      presence_joint: (o.joints ?? (o.vitrage === 'double' || o.vitrage === 'triple' || o.vitrage === 'inconnu')) ? 1 : 0,
      enum_type_pose_id: C.POSE[o.pose ?? 'nu_interieur'],
      enum_orientation_id: C.ORIENTATION[o.orientation],
      tv_coef_masque_proche_id: C.MASQUE_PROCHE_ID.aucun,
      tv_coef_masque_lointain_homogene_id: C.masqueLointainHomogeneId(o.orientation, o.masqueLointain ?? 'aucun')
    },
    donnee_intermediaire: {}
  };
}

function construirePorte(p: Porte, maison: Maison, murRef: string, murId: string) {
  const mur = maison.murs.find((m) => m.id === murId)!;
  const adjacence = C.ADJACENCE_MUR[mur.adjacence];
  return {
    donnee_entree: {
      reference: `porte_${p.id}`,
      reference_paroi: murRef,
      description: `Porte ${p.id}`,
      enum_type_adjacence_id: adjacence,
      surface_porte: p.surface,
      presence_joint: (p.joints ?? p.kind !== 'bois_pleine') ? 1 : 0,
      enum_methode_saisie_uporte_id: 1,
      enum_type_porte_id: C.PORTE_TYPE[p.kind],
      enum_type_pose_id: 2,
      largeur_dormant: 5,
      ...champsLnc(adjacence, mur.surfaceBrute, mur.lnc, estIsolee(mur.isolation))
    },
    donnee_intermediaire: {}
  };
}

// --- Ponts thermiques --------------------------------------------------------------------------
// Le moteur n'estime pas les ponts thermiques depuis la géométrie : on fournit les longueurs.
// Estimation (mode « par défaut » ; le mode détaillé permettra de saisir les longueurs réelles) :
//   longueur d'un mur = surface brute / (niveaux × hauteur sous plafond)
//   plancher bas / mur         : longueur du mur
//   plancher intermédiaire/mur : longueur × (niveaux − 1) × 0,85 (les portes-fenêtres interrompent la liaison)
//   plancher haut lourd / mur  : longueur (toiture béton ou hourdis)
//   refend / mur               : 1 refend tous les ~8 m de mur (aucun sous 4 m), de hauteur 0,6 × niveaux × hsp
//   menuiserie / mur           : périmètre de chaque ouverture (forme 1:1,4, porte-fenêtre h = 2,15 m)
// Étalonnage : médiane ADEME des maisons de 90-150 m² à 2 niveaux construites en 1990-2005 = 0,29 W/K par m²
// habitable (p75 = 0,47) ; le DPE de référence (n°1) mesure 0,35. Voir test/mapper.test.ts.

function estimerPontsThermiques(
  maison: Maison,
  placement: Map<string, string>,
  hsp: number,
  avertir: (s: string) => void,
  facteurs: OptionsBuild['facteursPontsThermiques'] = {}
) {
  const f = { planchierBas: 1, intermediaire: 1, plancherHaut: 1, refend: 1, menuiserie: 1, ...facteurs };
  const pts: any[] = [];
  const hauteurTotale = maison.niveaux * hsp;
  const planchers = [...maison.planchersBas].sort((a, b) => b.surface - a.surface);
  const toitLourd = maison.toitures.find((t) => t.structure === 'beton' || t.structure === 'hourdis');
  let n = 0;
  const ajoute = (
    description: string,
    liaison: 1 | 2 | 3 | 4 | 5,
    l: number,
    ref1: string,
    ref2?: string
  ) => {
    if (l <= 0) return;
    n += 1;
    pts.push({
      donnee_entree: {
        reference: `pt_${n}`,
        description,
        reference_1: ref1,
        ...(ref2 ? { reference_2: ref2 } : {}),
        enum_type_liaison_id: liaison,
        enum_methode_saisie_pont_thermique_id: 1,
        // La valeur tabulée s'applique en entier (le moteur applique 0,5 par défaut aux liaisons
        // refend et plancher intermédiaire quand cette donnée est absente).
        pourcentage_valeur_pont_thermique: 1,
        l: Math.round(l * 10) / 10
      },
      donnee_intermediaire: {}
    });
  };

  for (const mur of maison.murs) {
    if (mur.adjacence === 'logement_voisin' || mur.adjacence === 'local_non_habitation') continue;
    const longueur = mur.surfaceBrute / hauteurTotale;
    const ref = `mur_${mur.id}`;
    if (planchers[0]) {
      ajoute(`Mur ${mur.id} / Plancher bas`, 1, longueur * f.planchierBas, ref, `plancher_bas_${planchers[0].id}`);
    }
    if (maison.niveaux > 1) {
      ajoute(`Mur ${mur.id} / Plancher intermédiaire`, 2, longueur * (maison.niveaux - 1) * 0.85 * f.intermediaire, ref);
    }
    if (toitLourd) {
      ajoute(`Mur ${mur.id} / Plancher haut`, 3, longueur * f.plancherHaut, ref, `plancher_haut_${toitLourd.id}`);
    }
    const refends = longueur >= 4 ? Math.max(1, Math.round(longueur / 8)) : 0;
    ajoute(`Mur ${mur.id} / Refend`, 4, refends * hauteurTotale * 0.6 * f.refend, ref);
  }

  for (const o of maison.ouvertures) {
    const murId = placement.get(o.id)!;
    const nb = o.nombre ?? 1;
    const unite = o.surface / nb;
    const portefenetre = o.kind.startsWith('porte_fenetre');
    const perimetreUnite = portefenetre ? 2 * (2.15 + unite / 2.15) : 4.057 * Math.sqrt(unite);
    ajoute(`Ouverture ${o.id} / Mur ${murId}`, 5, perimetreUnite * nb * f.menuiserie, `mur_${murId}`, `baie_${o.id}`);
  }
  for (const p of maison.portes) {
    const murId = placement.get(p.id)!;
    const perimetre = 2 * (2.04 + p.surface / 2.04);
    ajoute(`Porte ${p.id} / Mur ${murId}`, 5, perimetre * f.menuiserie, `mur_${murId}`, `porte_${p.id}`);
  }
  if (pts.length > 0) {
    avertir('Ponts thermiques estimés depuis la géométrie (longueurs de murs déduites de leur surface).');
  }
  return pts;
}

// --- Systèmes ----------------------------------------------------------------------------------

function construireSystemes(maison: Maison, plusieursFacades: boolean, avertir: (s: string) => void) {
  const ventilation = construireVentilation(maison, plusieursFacades);
  const chauffage = construireChauffage(maison, avertir);
  const ecs = construireEcs(maison, chauffage.generateurPrincipal, avertir);

  return {
    ventilation_collection: { ventilation: [ventilation] },
    climatisation_collection: {},
    production_elec_enr: {
      donnee_entree: { presence_production_pv: 0, enum_type_enr_id: 1 },
      donnee_intermediaire: {},
      panneaux_pv_collection: {}
    },
    installation_ecs_collection: { installation_ecs: [ecs] },
    installation_chauffage_collection: { installation_chauffage: [chauffage.installation] }
  };
}

function construireVentilation(maison: Maison, plusieursFacades: boolean) {
  const annee = maison.ventilation.installAnnee ?? maison.anneeConstruction;
  return {
    donnee_entree: {
      reference: 'ventilation_1',
      description: `Ventilation ${maison.ventilation.kind.replace(/_/g, ' ')}`,
      surface_ventile: maison.surfaceHabitable,
      plusieurs_facade_exposee: plusieursFacades ? 1 : 0,
      enum_methode_saisie_q4pa_conv_id: 1,
      enum_type_ventilation_id: C.ventilationId(maison.ventilation.kind, annee),
      ventilation_post_2012: annee > 2012 ? 1 : 0
    },
    donnee_intermediaire: {}
  };
}

interface GenerateurPrincipal {
  kind: 'chaudiere' | 'pac' | 'electrique';
  idCh: number;
  energieId: number;
  annee?: number;
}

function construireChauffage(maison: Maison, avertir: (s: string) => void) {
  const c: ChauffagePrincipal = maison.chauffage;
  const anneeBase = maison.anneeConstruction;
  const emetteurs: any[] = [];
  const generateurs: any[] = [];
  let principal: GenerateurPrincipal;

  const emetteurEau = (e: NonNullable<Extract<ChauffagePrincipal, { kind: 'chaudiere_gaz' }>['emetteurs']>) => ({
    donnee_entree: {
      reference: 'emetteur_1',
      description: `Émetteur ${e.type.replace(/_/g, ' ')}`,
      surface_chauffee: maison.surfaceHabitable,
      enum_type_emission_distribution_id: C.emetteurEauId(
        e.type,
        e.robinetsThermostatiques,
        e.temperature === 'haute' ? 'haute' : 'basse_ou_moyenne'
      ),
      reseau_distribution_isole: 0,
      enum_equipement_intermittence_id: { aucune: 1, centrale: 3, par_piece: 4 }[e.programmation],
      enum_type_chauffage_id: 2,
      enum_type_regulation_id: e.robinetsThermostatiques ? 2 : 1,
      enum_temp_distribution_ch_id: e.temperature === 'haute' ? 4 : e.temperature === 'basse' ? 2 : 3,
      enum_periode_installation_emetteur_id: ((): number => {
        const a = e.annee ?? anneeBase;
        return a < 1981 ? 1 : a <= 2000 ? 2 : 3;
      })(),
      enum_lien_generateur_emetteur_id: 1
    },
    donnee_intermediaire: {}
  });

  const usagePrincipal = maison.ecs.kind === 'comme_le_chauffage' ? 3 : 1;

  if (c.kind === 'chaudiere_gaz' || c.kind === 'chaudiere_fioul') {
    const idCh = c.kind === 'chaudiere_gaz' ? C.chaudiereGazId(c.techno, c.annee) : C.chaudiereFioulId(c.techno, c.annee);
    const energieId = c.kind === 'chaudiere_gaz' ? 2 : 3;
    emetteurs.push(emetteurEau(c.emetteurs));
    generateurs.push({
      donnee_entree: {
        reference: 'generateur_ch_1',
        reference_generateur_mixte: usagePrincipal === 3 ? 'generateur_ecs_1' : undefined,
        description: `Chaudière ${c.kind === 'chaudiere_gaz' ? 'gaz' : 'fioul'} ${c.techno.replace(/_/g, ' ')} (${c.annee})`,
        enum_type_generateur_ch_id: idCh,
        enum_usage_generateur_id: usagePrincipal,
        enum_type_energie_id: energieId,
        position_volume_chauffe: 0,
        presence_ventouse: 0,
        presence_regulation_combustion: 1,
        ventilateur: 0,
        enum_methode_saisie_carac_sys_id: 1,
        enum_lien_generateur_emetteur_id: 1
      },
      donnee_intermediaire: {}
    });
    principal = { kind: 'chaudiere', idCh, energieId, annee: c.annee };
  } else if (c.kind === 'electrique_direct') {
    emetteurs.push({
      donnee_entree: {
        reference: 'emetteur_1',
        description: `Émetteur électrique ${c.emetteur.replace(/_/g, ' ')}`,
        surface_chauffee: maison.surfaceHabitable,
        enum_type_emission_distribution_id: C.ELECTRIQUE_DIRECT_EMETTEUR[c.emetteur],
        enum_equipement_intermittence_id: 1,
        enum_type_chauffage_id: 1,
        enum_type_regulation_id: 1,
        enum_temp_distribution_ch_id: 1,
        enum_periode_installation_emetteur_id: anneeBase < 1981 ? 1 : anneeBase <= 2000 ? 2 : 3,
        enum_lien_generateur_emetteur_id: 1
      },
      donnee_intermediaire: {}
    });
    const idCh = C.ELECTRIQUE_DIRECT_GENERATEUR[c.emetteur];
    generateurs.push({
      donnee_entree: {
        reference: 'generateur_ch_1',
        description: `Chauffage électrique ${c.emetteur.replace(/_/g, ' ')}`,
        enum_type_generateur_ch_id: idCh,
        enum_usage_generateur_id: 1,
        enum_type_energie_id: 1,
        position_volume_chauffe: 1,
        enum_methode_saisie_carac_sys_id: 1,
        enum_lien_generateur_emetteur_id: 1
      },
      donnee_intermediaire: {}
    });
    principal = { kind: 'electrique', idCh, energieId: 1 };
  } else {
    const idCh = C.pacId(c.source, c.annee);
    if (c.scop) avertir('SCOP saisi ignoré en v1 : valeur forfaitaire utilisée.');
    if (c.source === 'air_air') {
      emetteurs.push({
        donnee_entree: {
          reference: 'emetteur_1',
          description: 'Émetteurs de la PAC air/air',
          surface_chauffee: maison.surfaceHabitable,
          enum_type_emission_distribution_id: 42, // soufflage d'air chaud, distribution par fluide frigorigène
          enum_equipement_intermittence_id: 1,
          enum_type_chauffage_id: 1,
          enum_type_regulation_id: 1,
          enum_temp_distribution_ch_id: 1,
          enum_periode_installation_emetteur_id: 3,
          enum_lien_generateur_emetteur_id: 1
        },
        donnee_intermediaire: {}
      });
    } else {
      const e = c.emetteurs ?? {
        type: 'radiateur_bitube',
        robinetsThermostatiques: true,
        temperature: 'basse_ou_moyenne',
        programmation: 'centrale'
      };
      emetteurs.push(emetteurEau(e as any));
    }
    generateurs.push({
      donnee_entree: {
        reference: 'generateur_ch_1',
        reference_generateur_mixte: usagePrincipal === 3 ? 'generateur_ecs_1' : undefined,
        description: `PAC ${c.source.replace(/_/g, '/')} (${c.annee})`,
        enum_type_generateur_ch_id: idCh,
        enum_usage_generateur_id: usagePrincipal === 3 && c.source === 'air_eau' ? 3 : 1,
        enum_type_energie_id: 1,
        position_volume_chauffe: 0,
        enum_methode_saisie_carac_sys_id: 1,
        enum_lien_generateur_emetteur_id: 1
      },
      donnee_intermediaire: {}
    });
    principal = { kind: 'pac', idCh, energieId: 1, annee: c.annee };
  }

  // Appoint bois
  let cfg = 1;
  if (maison.appoint) {
    const a = maison.appoint;
    cfg = 3; // installation de chauffage avec insert ou poêle bois en appoint
    const id = C.appointBoisId(a.kind, a.annee, a.flammeVerte ?? true);
    emetteurs.push({
      donnee_entree: {
        reference: 'emetteur_appoint',
        description: 'Poêle ou insert bois (appoint)',
        surface_chauffee: maison.surfaceHabitable,
        enum_type_emission_distribution_id: 21,
        enum_equipement_intermittence_id: 1,
        enum_type_chauffage_id: 1,
        enum_type_regulation_id: 1,
        enum_temp_distribution_ch_id: 1,
        enum_periode_installation_emetteur_id: 3,
        enum_lien_generateur_emetteur_id: 2
      },
      donnee_intermediaire: {}
    });
    generateurs.push({
      donnee_entree: {
        reference: 'generateur_appoint',
        description: `Appoint ${a.kind.replace(/_/g, ' ')} (${a.annee})`,
        enum_type_generateur_ch_id: id,
        enum_usage_generateur_id: 1,
        enum_type_energie_id: a.kind === 'poele_granules' ? 5 : 4,
        position_volume_chauffe: 1,
        enum_methode_saisie_carac_sys_id: 1,
        enum_lien_generateur_emetteur_id: 2
      },
      donnee_intermediaire: {}
    });
  }

  const installation = {
    donnee_entree: {
      reference: 'installation_chauffage_1',
      description: 'Installation de chauffage',
      surface_chauffee: maison.surfaceHabitable,
      nombre_niveau_installation_ch: maison.niveaux,
      enum_cfg_installation_ch_id: cfg,
      cle_repartition_ch: 1,
      enum_type_installation_id: 1,
      enum_methode_calcul_conso_id: 1
    },
    donnee_intermediaire: {},
    emetteur_chauffage_collection: { emetteur_chauffage: emetteurs },
    generateur_chauffage_collection: { generateur_chauffage: generateurs }
  };
  return { installation, generateurPrincipal: principal };
}

function construireEcs(maison: Maison, principal: GenerateurPrincipal, avertir: (s: string) => void) {
  const e: Ecs = maison.ecs;
  const dansVolume = (e as any).dansVolumeChauffe ? 1 : 0;
  let gen: any;

  if (e.kind === 'comme_le_chauffage') {
    if (principal.kind === 'chaudiere') {
      gen = {
        reference: 'generateur_ecs_1',
        reference_generateur_mixte: 'generateur_ch_1',
        description: 'Générateur mixte (chauffage + ECS)',
        enum_type_generateur_ecs_id: principal.idCh - 40,
        enum_usage_generateur_id: 3,
        enum_type_energie_id: principal.energieId,
        enum_methode_saisie_carac_sys_id: 1,
        enum_type_stockage_ecs_id: 1,
        position_volume_chauffe: dansVolume,
        presence_ventouse: 0,
        ventilateur: 0
      };
    } else if (principal.kind === 'pac') {
      const annee = principal.annee ?? maison.anneeConstruction;
      gen = {
        reference: 'generateur_ecs_1',
        reference_generateur_mixte: 'generateur_ch_1',
        description: 'PAC double service',
        enum_type_generateur_ecs_id: annee < 2010 ? 10 : annee <= 2014 ? 11 : 12,
        enum_usage_generateur_id: 3,
        enum_type_energie_id: 1,
        enum_methode_saisie_carac_sys_id: 1,
        enum_type_stockage_ecs_id: 3,
        volume_stockage: 200,
        position_volume_chauffe: dansVolume
      };
    } else {
      avertir("ECS « comme le chauffage » impossible avec un chauffage électrique direct : ballon électrique supposé.");
      gen = ballonElectrique(150, dansVolume);
    }
  } else if (e.kind === 'ballon_electrique') {
    gen = ballonElectrique(e.volumeL ?? 150, dansVolume);
  } else if (e.kind === 'chauffe_eau_thermodynamique') {
    gen = {
      reference: 'generateur_ecs_1',
      description: 'Chauffe-eau thermodynamique',
      enum_type_generateur_ecs_id: C.cetId(e.source ?? 'air_ambiant', e.annee ?? maison.anneeConstruction),
      enum_usage_generateur_id: 2,
      enum_type_energie_id: 1,
      enum_methode_saisie_carac_sys_id: 1,
      enum_type_stockage_ecs_id: 3,
      volume_stockage: e.volumeL ?? 200,
      position_volume_chauffe: dansVolume
    };
  } else if (e.kind === 'chauffe_eau_gaz_instantane') {
    gen = {
      reference: 'generateur_ecs_1',
      description: 'Chauffe-eau gaz instantané',
      enum_type_generateur_ecs_id: C.chauffeEauGazInstantaneId(e.annee),
      enum_usage_generateur_id: 2,
      enum_type_energie_id: 2,
      enum_methode_saisie_carac_sys_id: 1,
      enum_type_stockage_ecs_id: 1,
      position_volume_chauffe: dansVolume,
      presence_ventouse: 0,
      ventilateur: 0
    };
  } else {
    gen = {
      reference: 'generateur_ecs_1',
      description: 'Accumulateur gaz',
      enum_type_generateur_ecs_id: C.accumulateurGazId(e.annee),
      enum_usage_generateur_id: 2,
      enum_type_energie_id: 2,
      enum_methode_saisie_carac_sys_id: 1,
      enum_type_stockage_ecs_id: 2,
      volume_stockage: e.volumeL ?? 100,
      position_volume_chauffe: dansVolume,
      presence_ventouse: 0,
      ventilateur: 0
    };
  }

  return {
    donnee_entree: {
      reference: 'installation_ecs_1',
      description: 'Installation ECS',
      enum_cfg_installation_ecs_id: 1,
      enum_type_installation_id: 1,
      enum_methode_calcul_conso_id: 1,
      surface_habitable: maison.surfaceHabitable,
      nombre_logement: 1,
      nombre_niveau_installation_ecs: maison.niveaux,
      enum_bouclage_reseau_ecs_id: 1,
      reseau_distribution_isole: 0
    },
    donnee_intermediaire: {},
    generateur_ecs_collection: { generateur_ecs: [{ donnee_entree: gen, donnee_intermediaire: {} }] }
  };
}

function ballonElectrique(volumeL: number, dansVolume: number) {
  return {
    reference: 'generateur_ecs_1',
    description: 'Ballon électrique à accumulation',
    enum_type_generateur_ecs_id: 69, // vertical, catégorie inconnue
    enum_usage_generateur_id: 2,
    enum_type_energie_id: 1,
    enum_methode_saisie_carac_sys_id: 1,
    enum_type_stockage_ecs_id: 3,
    volume_stockage: volumeL,
    position_volume_chauffe: dansVolume
  };
}
