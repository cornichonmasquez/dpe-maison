// Importeur : DPE ADEME (XML converti en objet, valeurs en chaînes) -> modèle de saisie `Maison`.
//
// Usages : pré-remplir le formulaire depuis un DPE existant, et valider le mapper sur des DPE réels
// (comparaison des résultats du mapper à ceux du logiciel du diagnostiqueur).
//
// L'import est volontairement strict : ce que le modèle de saisie ne sait pas représenter est signalé,
// soit comme `horsPerimetre` (la maison n'est pas importable), soit comme `approximations`
// (la maison est importée, avec une donnée dégradée).

import type {
  AdjacenceMur,
  AdjacencePlancherBas,
  ChauffageAppoint,
  ChauffagePrincipal,
  Ecs,
  EmetteursEau,
  Fermeture,
  Isolation,
  Maison,
  Mur,
  MurMateriau,
  Ouverture,
  PlancherBas,
  PlancherBasType,
  Porte,
  PorteKind,
  TechnoChaudiere,
  Toiture,
  ToitureKind,
  ToitureStructure,
  Ventilation,
  VentilationKind
} from '../model/house.ts';

type N = Record<string, any>;

export interface ImportAdeme {
  maison?: Maison;
  /** Raisons pour lesquelles la maison ne peut pas être importée dans le périmètre v1. */
  horsPerimetre: string[];
  /** Données importées de façon dégradée (équivalent le plus proche). */
  approximations: string[];
  meta: { dateEtablissement?: string; versionSchema?: string; zoneClimatique?: string };
}

const arr = (x: any): any[] => (x === undefined || x === null || x === '' ? [] : Array.isArray(x) ? x : [x]);
const num = (v: any): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const ZONES = ['', 'H1a', 'H1b', 'H1c', 'H2a', 'H2b', 'H2c', 'H2d', 'H3'];
const ORIENTATION = { '1': 'sud', '2': 'nord', '3': 'est', '4': 'ouest' } as const;

const ANNEE_PERIODE: Record<string, number> = {
  '1': 1940, '2': 1960, '3': 1976, '4': 1980, '5': 1985, '6': 1995, '7': 2003, '8': 2009, '9': 2017, '10': 2022
};

const MATERIAU: Record<string, MurMateriau> = {
  '1': 'inconnu', '2': 'pierre_massive', '3': 'pierre_remplissage', '4': 'pise',
  '5': 'pan_de_bois_sans_remplissage', '6': 'pan_de_bois_remplissage', '7': 'bois_rondin',
  '8': 'brique_pleine', '9': 'brique_pleine_double', '10': 'brique_creuse', '11': 'parpaing_plein',
  '12': 'parpaing_creux', '13': 'beton_banche', '15': 'brique_alveolaire', '16': 'beton_cellulaire',
  '17': 'beton_cellulaire', '18': 'ossature_bois', '24': 'ossature_bois', '26': 'ossature_bois',
  '19': 'sandwich_beton'
};

const ADJ_MUR: Record<string, AdjacenceMur> = {
  '1': 'exterieur', '4': 'local_non_habitation', '6': 'sous_sol', '7': 'local_non_chauffe',
  '8': 'garage', '9': 'cellier', '10': 'veranda', '22': 'logement_voisin'
};
const ADJ_MUR_APPROX = new Set(['3', '11', '12', '13', '21']); // -> local non chauffé

const ADJ_PB: Record<string, AdjacencePlancherBas> = {
  '5': 'terre_plein', '3': 'vide_sanitaire', '6': 'sous_sol', '8': 'garage', '9': 'cellier',
  '7': 'local_non_chauffe', '1': 'exterieur', '22': 'logement_dessous'
};

const TYPE_PB: Record<string, PlancherBasType> = {
  '1': 'inconnu', '9': 'dalle_beton', '10': 'plancher_bois', '11': 'entrevous_terre_cuite',
  '12': 'entrevous_isolant', '8': 'voutains', '4': 'plancher_bois', '2': 'plancher_bois'
};

const STRUCTURE_PH: Record<string, ToitureStructure> = {
  '1': 'inconnu', '2': 'plafond_remplissage', '4': 'bois_entre_solives', '9': 'bois_sur_solives',
  '10': 'bois_sous_solives', '8': 'beton', '11': 'hourdis', '14': 'plaque_platre'
};

const FERMETURE: Record<string, Fermeture> = {
  '1': 'aucune', '2': 'persiennes_ajourees', '3': 'volet_roulant_alu', '4': 'volet_roulant_pvc_bois',
  '5': 'volet_battant_pvc_bois', '6': 'volet_roulant_pvc_bois_epais', '7': 'volet_battant_pvc_bois_epais',
  '8': 'volet_isole'
};

const PORTE: Record<string, PorteKind> = {
  '1': 'bois_pleine', '2': 'bois_vitree', '3': 'bois_vitree', '4': 'bois_vitree', '5': 'pvc_pleine',
  '6': 'pvc_vitree', '7': 'pvc_vitree', '8': 'pvc_vitree', '9': 'metal_pleine', '10': 'metal_vitree',
  '11': 'metal_vitree', '12': 'metal_vitree', '13': 'isolee', '14': 'isolee', '15': 'isolee', '16': 'autre'
};

const VENTILATION: Record<string, [VentilationKind, number, boolean?]> = {
  '1': ['ouverture_fenetres', 2000], '2': ['entrees_air', 2000], '25': ['conduit_naturel', 1975],
  '34': ['conduit_naturel', 1975],
  '3': ['vmc_sf_autoreglable', 1975], '4': ['vmc_sf_autoreglable', 1991], '5': ['vmc_sf_autoreglable', 2006],
  '6': ['vmc_sf_autoreglable', 2016],
  '7': ['vmc_sf_hygro_a', 1995], '8': ['vmc_sf_hygro_a', 2006], '9': ['vmc_sf_hygro_a', 2016],
  '13': ['vmc_sf_hygro_b', 1995], '14': ['vmc_sf_hygro_b', 2006], '15': ['vmc_sf_hygro_b', 2016],
  '19': ['vmc_df_echangeur', 2008], '20': ['vmc_df_echangeur', 2016],
  '21': ['vmc_df_echangeur', 2008, true], '22': ['vmc_df_echangeur', 2016, true],
  '23': ['vmc_df_sans_echangeur', 2008], '24': ['vmc_df_sans_echangeur', 2016],
  // équivalents approchés
  '10': ['vmc_sf_hygro_a', 1995, true], '11': ['vmc_sf_hygro_a', 2006, true], '12': ['vmc_sf_hygro_a', 2016, true],
  '16': ['vmc_sf_autoreglable', 2006, true], '17': ['vmc_sf_hygro_a', 2006, true], '18': ['vmc_sf_hygro_b', 2006, true],
  '26': ['vmc_sf_autoreglable', 1995, true], '27': ['vmc_sf_autoreglable', 2006, true],
  '28': ['vmc_sf_autoreglable', 2016, true], '29': ['vmc_sf_hygro_a', 1995, true],
  '30': ['vmc_sf_hygro_a', 2006, true], '31': ['vmc_sf_hygro_a', 2016, true],
  '32': ['vmc_sf_autoreglable', 2008, true], '33': ['vmc_sf_autoreglable', 2016, true]
};

const CHAUDIERE: Record<string, ['gaz' | 'fioul', TechnoChaudiere, number]> = {
  '85': ['gaz', 'classique', 1975], '86': ['gaz', 'classique', 1983], '87': ['gaz', 'classique', 1988],
  '88': ['gaz', 'standard', 1995], '89': ['gaz', 'standard', 2008], '90': ['gaz', 'standard', 2018],
  '91': ['gaz', 'basse_temperature', 1995], '92': ['gaz', 'basse_temperature', 2008], '93': ['gaz', 'basse_temperature', 2018],
  '94': ['gaz', 'condensation', 1983], '95': ['gaz', 'condensation', 1993], '96': ['gaz', 'condensation', 2008],
  '97': ['gaz', 'condensation', 2018],
  '75': ['fioul', 'classique', 1965], '76': ['fioul', 'classique', 1973], '77': ['fioul', 'classique', 1978],
  '78': ['fioul', 'classique', 1985], '79': ['fioul', 'standard', 2005], '80': ['fioul', 'standard', 2018],
  '81': ['fioul', 'basse_temperature', 2005], '82': ['fioul', 'basse_temperature', 2018],
  '83': ['fioul', 'condensation', 2005], '84': ['fioul', 'condensation', 2018]
};

const ELECTRIQUE: Record<string, ['convecteur' | 'panneau_rayonnant' | 'radiateur' | 'accumulation' | 'plancher_rayonnant', boolean?]> = {
  '98': ['convecteur'], '99': ['panneau_rayonnant'], '100': ['radiateur'], '101': ['radiateur', true],
  '102': ['plancher_rayonnant'], '103': ['plancher_rayonnant', true], '104': ['accumulation']
};

function pacDepuisId(id: number): { source: 'air_air' | 'air_eau' | 'eau_eau' | 'geothermique'; annee: number; approx?: boolean } | null {
  if (id >= 1 && id <= 3) return { source: 'air_air', annee: [2005, 2011, 2018][id - 1] };
  if (id >= 4 && id <= 7) return { source: 'air_eau', annee: [2005, 2011, 2016, 2019][id - 4] };
  if (id >= 8 && id <= 11) return { source: 'eau_eau', annee: [2005, 2011, 2016, 2019][id - 8] };
  if (id >= 12 && id <= 15) return { source: 'eau_eau', annee: [2005, 2011, 2016, 2019][id - 12], approx: true };
  if (id >= 16 && id <= 19) return { source: 'geothermique', annee: [2005, 2011, 2016, 2019][id - 16] };
  return null;
}

function appointDepuisId(id: number): { kind: ChauffageAppoint['kind']; annee: number; flammeVerte: boolean; approx?: boolean } | null {
  if (id >= 44 && id <= 46) return { kind: 'poele_granules', annee: [2008, 2015, 2021][id - 44], flammeVerte: id > 44 };
  if (id < 20 || id > 43) return null;
  const offset = id - 20; // 0..23 : 6 groupes d'époque × 4 appareils
  const epoque = Math.floor(offset / 4);
  const appareil = offset % 4; // 0 cuisinière, 1 foyer fermé, 2 poêle bûche, 3 insert
  const annee = [1985, 1997, 2010, 2006, 2012, 2020][epoque];
  const flammeVerte = epoque >= 3;
  const kind: ChauffageAppoint['kind'] = appareil === 3 ? 'insert' : 'poele_buches';
  return { kind, annee, flammeVerte, approx: appareil < 2 };
}

// --- Fonctions utilitaires ---------------------------------------------------------------------

function isolation(de: N, approx: (s: string) => void, contexte: string): Isolation {
  const methode = de.enum_methode_saisie_u_id;
  const t = de.enum_type_isolation_id;
  if (methode === '1' || t === '2') return { type: 'aucune' };
  const types: Record<string, Isolation['type']> = {
    '1': 'inconnue', '3': 'iti', '4': 'ite', '5': 'itr', '6': 'ite', '7': 'iti', '8': 'ite', '9': 'oui_type_inconnu'
  };
  const type = types[t] ?? 'inconnue';
  if (t === '6' || t === '7' || t === '8') approx(`${contexte} : isolation combinée (type ${t}) ramenée à un seul type`);
  if (methode === '3' || methode === '4') {
    const e = num(de.epaisseur_isolation);
    return e ? { type, epaisseurCm: e } : { type };
  }
  if (methode === '5' || methode === '6') {
    const r = num(de.resistance_isolation);
    return r ? { type, resistance: r } : { type };
  }
  if (methode === '7') {
    const p = de.enum_periode_isolation_id;
    return p ? { type, annee: ANNEE_PERIODE[p] } : { type };
  }
  if (methode === '9' || methode === '10') {
    const u = num(de.umur_saisi ?? de.upb_saisi ?? de.uph_saisi);
    approx(`${contexte} : U saisi directement (${u ?? '?'}), converti en résistance équivalente`);
    if (u && u > 0) return { type: type === 'inconnue' ? 'oui_type_inconnu' : type, resistance: Math.max(0.2, 1 / u - 0.5) };
  }
  return { type };
}

/**
 * Le type de doublage est parfois seulement dans le texte de la description (anciens logiciels) :
 * le moteur de référence applique la même lecture.
 */
function doublageDepuis(de: N): Mur['doublage'] {
  const id = String(de.enum_type_doublage_id);
  const table = { '1': 'inconnu', '2': 'aucun', '3': 'lame_air_inf_15mm', '4': 'lame_air_sup_15mm', '5': 'connu' } as const;
  if (id === '1' || id === '2') {
    const d = String(de.description ?? '').toLowerCase();
    if (d.includes('doublage connu (plâtre, brique')) return 'connu';
    if (d.includes('doublage indéterminé avec lame')) return 'lame_air_sup_15mm';
    if (d.includes('doublage indéterminé ou lame')) return 'lame_air_inf_15mm';
  }
  return table[id as '1'] ?? 'inconnu';
}

function lnc(de: N) {
  const aiu = num(de.surface_aiu);
  const aue = num(de.surface_aue);
  if (aiu === undefined || aue === undefined) return undefined;
  const cfg: Record<string, [boolean, boolean]> = { '2': [false, false], '3': [false, true], '4': [true, false], '5': [true, true] };
  const c = cfg[de.enum_cfg_isolation_lnc_id];
  return { aiu, aue, ...(c ? { paroisChauffeesIsolees: c[0], paroisExterieuresIsolees: c[1] } : {}) };
}

// --- Import ------------------------------------------------------------------------------------

export function ademeVersMaison(dpe: N): ImportAdeme {
  const hors: string[] = [];
  const approximations: string[] = [];
  const approx = (s: string) => approximations.push(s);
  const l = dpe.logement ?? {};
  const g = l.caracteristique_generale ?? {};
  const env = l.enveloppe ?? {};

  const meta = {
    dateEtablissement: dpe.administratif?.date_etablissement_dpe,
    versionSchema: dpe.administratif?.enum_version_id,
    zoneClimatique: ZONES[Number(l.meteo?.enum_zone_climatique_id)] || undefined
  };

  if (g.enum_methode_application_dpe_log_id !== '1') hors.push('pas une maison individuelle');

  // Localisation
  const adresses = arr(dpe.administratif?.geolocalisation?.adresses?.adresse_bien);
  const cp = String(adresses[0]?.ban_postcode ?? adresses[0]?.code_postal_brut ?? '').trim();
  const classeAlt = l.meteo?.enum_classe_altitude_id;
  const altitudeM = classeAlt === '3' ? 1000 : classeAlt === '2' ? 600 : 200;

  // --- Murs
  const mursXml = arr(env.mur_collection?.mur);
  const baiesXml = arr(env.baie_vitree_collection?.baie_vitree);
  const portesXml = arr(env.porte_collection?.porte);

  const murs: Mur[] = [];
  const indexMurXml: number[] = []; // index XML -> index dans `murs` (ou -1)
  mursXml.forEach((m: N, i: number) => {
    const de = m.donnee_entree ?? {};
    const adj = String(de.enum_type_adjacence_id);
    let adjacence = ADJ_MUR[adj];
    if (!adjacence) {
      if (ADJ_MUR_APPROX.has(adj)) {
        adjacence = 'local_non_chauffe';
        approx(`mur ${i + 1} : adjacence ${adj} ramenée à « local non chauffé »`);
      } else {
        hors.push(`mur ${i + 1} : adjacence ${adj} non prise en charge`);
        indexMurXml.push(-1);
        return;
      }
    }
    if (adjacence === 'veranda') approx(`mur ${i + 1} : véranda traitée comme un garage`);
    const mat = String(de.enum_materiaux_structure_mur_id);
    let materiau = MATERIAU[mat];
    if (!materiau) {
      materiau = 'inconnu';
      approx(`mur ${i + 1} : matériau ${mat} ramené à « inconnu »`);
    }
    const orient = ORIENTATION[String(de.enum_orientation_id) as keyof typeof ORIENTATION];
    murs.push({
      id: String(i + 1),
      orientation: orient ?? 'sud',
      surfaceBrute: num(de.surface_paroi_opaque) ?? num(de.surface_paroi_totale) ?? 0, // complété plus bas
      adjacence,
      materiau,
      epaisseurCm: num(de.epaisseur_structure),
      isolation: isolation(de, approx, `mur ${i + 1}`),
      doublage: doublageDepuis(de),
      // `paroi_ancienne` (anciens schémas) désigne seulement une paroi ancienne ; seul
      // `enduit_isolant_paroi_ancienne` indique la présence d'un enduit isolant.
      enduitIsolant: de.enduit_isolant_paroi_ancienne === '1',
      lnc: lnc(de)
    });
    indexMurXml.push(murs.length - 1);
  });
  if (murs.length === 0) hors.push('aucun mur importable');

  // Placement d'une ouverture : par référence si elle existe, sinon par orientation (mur extérieur d'abord)
  const murPour = (orientation: string, adjacenceId: string | undefined, refParoi?: string): Mur | undefined => {
    if (refParoi !== undefined && refParoi !== '') {
      const i = mursXml.findIndex((m: N) => m.donnee_entree?.reference === refParoi);
      if (i >= 0 && indexMurXml[i] >= 0) return murs[indexMurXml[i]];
    }
    const adjacence = adjacenceId ? (ADJ_MUR[adjacenceId] ?? 'local_non_chauffe') : 'exterieur';
    return (
      murs.find((m) => m.orientation === orientation && m.adjacence === adjacence) ??
      murs.find((m) => m.adjacence === adjacence) ??
      murs.find((m) => m.orientation === orientation) ??
      murs[0]
    );
  };

  // --- Ouvertures
  const ouvertures: Ouverture[] = [];
  const ouvertParMur = new Map<string, number>();
  baiesXml.forEach((b: N, i: number) => {
    const de = b.donnee_entree ?? {};
    const adj = String(de.enum_type_adjacence_id);
    if (adj !== '1') {
      hors.push(`baie ${i + 1} : adjacence ${adj} (véranda ou local non chauffé) non prise en charge`);
      return;
    }
    const orientation = ORIENTATION[String(de.enum_orientation_id) as keyof typeof ORIENTATION] ?? 'sud';
    if (!(String(de.enum_orientation_id) in ORIENTATION)) approx(`baie ${i + 1} : orientation horizontale ramenée au sud`);
    if (de.enum_inclinaison_vitrage_id && de.enum_inclinaison_vitrage_id !== '3') {
      approx(`baie ${i + 1} : vitrage incliné/horizontal traité comme vertical`);
    }
    const mur = murPour(orientation, '1', de.reference_paroi);
    if (!mur) return;
    const surface = num(de.surface_totale_baie) ?? 0;
    ouvertParMur.set(mur.id, (ouvertParMur.get(mur.id) ?? 0) + surface);

    const tb = String(de.enum_type_baie_id);
    const kind = ({ '4': 'fenetre_battante', '5': 'fenetre_coulissante', '6': 'porte_fenetre_coulissante', '7': 'porte_fenetre_battante', '8': 'porte_fenetre_battante_soubassement' } as const)[
      tb as '4'
    ] ?? 'brique_de_verre';
    if (!(tb in { '4': 1, '5': 1, '6': 1, '7': 1, '8': 1 })) approx(`baie ${i + 1} : paroi en verre/polycarbonate (type ${tb})`);
    const menuiserie = ({ '3': 'bois', '4': 'bois_metal', '5': 'pvc', '6': 'alu_rupteur', '7': 'alu_sans_rupteur' } as const)[
      String(de.enum_type_materiaux_menuiserie_id) as '3'
    ] ?? 'inconnue';
    const vitrage = ({ '1': 'simple', '2': 'double', '3': 'triple', '4': 'survitrage' } as const)[String(de.enum_type_vitrage_id) as '1'] ?? 'inconnu';
    const gaz = ({ '1': 'air', '2': 'argon', '3': 'inconnu' } as const)[String(de.enum_type_gaz_lame_id) as '1'] ?? 'air';
    const proche = Number(de.tv_coef_masque_proche_id);
    if (de.masque_lointain_non_homogene_collection && arr(de.masque_lointain_non_homogene_collection.masque_lointain_non_homogene).length) {
      approx(`baie ${i + 1} : masque lointain non homogène ignoré`);
    }
    const idLointain = Number(de.tv_coef_masque_lointain_homogene_id);
    const hauteurs = ['moins_15', '15_30', '30_60', 'plus_60'] as const;
    ouvertures.push({
      id: String(i + 1),
      orientation,
      surface,
      nombre: num(de.nb_baie) ?? 1,
      kind,
      menuiserie,
      vitrage,
      gaz,
      laMm: num(de.epaisseur_lame),
      peuEmissif: de.vitrage_vir === '1',
      fermeture: FERMETURE[String(de.enum_type_fermeture_id)] ?? 'aucune',
      pose: ({ '1': 'nu_exterieur', '2': 'nu_interieur', '3': 'tunnel' } as const)[String(de.enum_type_pose_id) as '1'] ?? 'nu_interieur',
      dormantCm: num(de.largeur_dormant) ?? 5,
      joints: de.presence_joint === undefined ? undefined : de.presence_joint === '1',
      murId: mur.id,
      masqueProche: !proche || proche === 19 ? 'aucun' : proche <= 12 ? 'loggia' : proche <= 16 ? 'balcon_auvent' : 'aucun',
      masqueLointain: idLointain >= 1 && idLointain <= 12 ? hauteurs[(idLointain - 1) % 4] : 'aucun'
    });
  });

  // --- Portes
  const portes: Porte[] = [];
  portesXml.forEach((p: N, i: number) => {
    const de = p.donnee_entree ?? {};
    const adj = String(de.enum_type_adjacence_id ?? '1');
    const mur = murPour('sud', adj, de.reference_paroi);
    if (!mur) return;
    const surface = num(de.surface_porte) ?? 0;
    ouvertParMur.set(mur.id, (ouvertParMur.get(mur.id) ?? 0) + surface);
    portes.push({
      id: String(i + 1),
      surface,
      kind: PORTE[String(de.enum_type_porte_id)] ?? 'autre',
      murId: mur.id,
      joints: de.presence_joint === undefined ? undefined : de.presence_joint === '1'
    });
  });

  // surface brute = opaque + ouvertures posées sur le mur
  for (const m of murs) m.surfaceBrute = Math.round((m.surfaceBrute + (ouvertParMur.get(m.id) ?? 0)) * 100) / 100;

  // --- Planchers bas
  const planchersBas: PlancherBas[] = [];
  arr(env.plancher_bas_collection?.plancher_bas).forEach((p: N, i: number) => {
    const de = p.donnee_entree ?? {};
    const adj = String(de.enum_type_adjacence_id);
    let adjacence = ADJ_PB[adj];
    if (!adjacence) {
      if (adj === '2') {
        adjacence = 'sous_sol';
        approx(`plancher bas ${i + 1} : paroi enterrée ramenée à un sous-sol`);
      } else if (adj === '21') {
        adjacence = 'local_non_chauffe';
        approx(`plancher bas ${i + 1} : « autres dépendances » ramené à un local non chauffé`);
      } else {
        hors.push(`plancher bas ${i + 1} : adjacence ${adj} non prise en charge`);
        return;
      }
    }
    const t = String(de.enum_type_plancher_bas_id);
    let type = TYPE_PB[t];
    if (!type) {
      type = 'inconnu';
      approx(`plancher bas ${i + 1} : type ${t} ramené à « inconnu »`);
    }
    planchersBas.push({
      id: String(i + 1),
      surface: num(de.surface_paroi_opaque) ?? 0,
      perimetre: num(de.perimetre_ue),
      adjacence,
      type,
      isolation: isolation(de, approx, `plancher bas ${i + 1}`),
      lnc: lnc(de)
    });
  });
  if (planchersBas.length === 0) hors.push('aucun plancher bas importable');

  // --- Toitures
  const toitures: Toiture[] = [];
  arr(env.plancher_haut_collection?.plancher_haut).forEach((p: N, i: number) => {
    const de = p.donnee_entree ?? {};
    const adj = String(de.enum_type_adjacence_id);
    const t = String(de.enum_type_plancher_haut_id);
    let kind: ToitureKind;
    if (t === '12') kind = 'rampants';
    else if (adj === '11') kind = 'combles_perdus';
    else if (adj === '12' || adj === '13') kind = 'combles_peu_ventiles';
    else if (adj === '22') kind = 'plafond_sous_logement_ou_local';
    else if (adj === '1') {
      kind = 'terrasse';
      if (!['1', '2', '4', '8', '9', '10'].includes(t)) approx(`toiture ${i + 1} : type ${t} sur l'extérieur traité comme toit-terrasse`);
    } else if (['6', '7', '8', '9', '21'].includes(adj)) {
      kind = 'combles_peu_ventiles';
      approx(`toiture ${i + 1} : adjacence ${adj} ramenée à un comble peu ventilé`);
    } else {
      hors.push(`plancher haut ${i + 1} : adjacence ${adj} non prise en charge`);
      return;
    }
    let structure = STRUCTURE_PH[t];
    if (!structure) {
      structure = 'inconnu';
      if (t !== '12') approx(`toiture ${i + 1} : structure ${t} ramenée à « inconnu »`);
    }
    toitures.push({
      id: String(i + 1),
      surface: num(de.surface_paroi_opaque) ?? 0,
      kind,
      structure,
      isolation: isolation(de, approx, `toiture ${i + 1}`),
      lnc: lnc(de)
    });
  });
  if (toitures.length === 0) hors.push('aucune toiture importable');

  // --- Ventilation
  const vent = arr(l.ventilation_collection?.ventilation);
  let ventilation: Ventilation = { kind: 'ouverture_fenetres' };
  if (vent.length !== 1) {
    hors.push(`${vent.length} systèmes de ventilation (un seul est pris en charge)`);
  } else {
    const id = String(vent[0].donnee_entree?.enum_type_ventilation_id);
    const v = VENTILATION[id];
    if (!v) hors.push(`ventilation ${id} non prise en charge`);
    else {
      ventilation = { kind: v[0], installAnnee: v[1] };
      if (v[2]) approx(`ventilation ${id} ramenée à ${v[0]}`);
    }
  }

  // --- Chauffage
  const installs = arr(l.installation_chauffage_collection?.installation_chauffage);
  let chauffage: ChauffagePrincipal | undefined;
  let appoint: ChauffageAppoint | undefined;
  let generateurMixte = false;
  if (installs.length !== 1) {
    hors.push(`${installs.length} installations de chauffage (une seule est prise en charge)`);
  } else {
    const inst = installs[0];
    const gens = arr(inst.generateur_chauffage_collection?.generateur_chauffage).map((x: N) => x.donnee_entree ?? {});
    const ems = arr(inst.emetteur_chauffage_collection?.emetteur_chauffage).map((x: N) => x.donnee_entree ?? {});
    const principaux = gens.filter((x: N) => (x.enum_lien_generateur_emetteur_id ?? '1') === '1');
    const appoints = gens.filter((x: N) => x.enum_lien_generateur_emetteur_id === '2');
    const sdb = gens.filter((x: N) => x.enum_lien_generateur_emetteur_id === '3');
    if (sdb.length) hors.push("appoint électrique de salle de bain (non pris en charge)");
    if (principaux.length !== 1) {
      hors.push(`${principaux.length} générateurs principaux (un seul est pris en charge)`);
    } else {
      const pg = principaux[0];
      const id = String(pg.enum_type_generateur_ch_id);
      generateurMixte = pg.enum_usage_generateur_id === '3';
      const em = ems.find((x: N) => (x.enum_lien_generateur_emetteur_id ?? '1') === '1') ?? ems[0] ?? {};
      const emId = Number(em.enum_type_emission_distribution_id);
      const emetteurs = (): EmetteursEau | undefined => {
        const monotube = emId >= 24 && emId <= 31;
        const bitube = emId >= 32 && emId <= 39;
        const plancher = (emId >= 11 && emId <= 14) || (emId >= 15 && emId <= 18);
        const vent = emId >= 46 && emId <= 49;
        if (!monotube && !bitube && !plancher && !vent) return undefined;
        if ([11, 12, 15, 16, 24, 25, 28, 29, 32, 33, 36, 37, 46, 47].includes(emId)) approx(`émetteur ${emId} : réseau collectif ramené à individuel`);
        if (vent) approx(`émetteur ${emId} : ventiloconvecteur ramené à un radiateur`);
        const thermo = monotube ? emId >= 28 : bitube ? emId >= 36 : false;
        const tdist = String(em.enum_temp_distribution_ch_id);
        const haute = tdist === '4' || (tdist !== '2' && tdist !== '3' && (monotube || bitube ? emId % 2 === 0 : emId % 2 === 1));
        const interm = String(em.enum_equipement_intermittence_id);
        return {
          type: plancher ? 'plancher_chauffant' : monotube ? 'radiateur_monotube' : 'radiateur_bitube',
          robinetsThermostatiques: thermo || em.enum_type_regulation_id === '2',
          temperature: tdist === '2' ? 'basse' : tdist === '3' ? 'moyenne' : haute ? 'haute' : 'moyenne',
          annee: ({ '1': 1975, '2': 1990, '3': 2005 } as Record<string, number>)[String(em.enum_periode_installation_emetteur_id)],
          programmation: interm === '1' || interm === 'undefined' ? 'aucune' : ['4', '5'].includes(interm) ? 'par_piece' : 'centrale'
        };
      };

      if (CHAUDIERE[id]) {
        const [energie, techno, annee] = CHAUDIERE[id];
        const e = emetteurs();
        if (!e) hors.push(`chaudière avec émetteur ${emId} non pris en charge`);
        else chauffage = { kind: energie === 'gaz' ? 'chaudiere_gaz' : 'chaudiere_fioul', techno, annee, emetteurs: e };
      } else if (ELECTRIQUE[id]) {
        const [emetteur, approche] = ELECTRIQUE[id];
        if (approche) approx(`chauffage électrique ${id} ramené à ${emetteur}`);
        chauffage = { kind: 'electrique_direct', emetteur };
      } else if (pacDepuisId(Number(id))) {
        const p = pacDepuisId(Number(id))!;
        if (p.approx) approx(`PAC ${id} ramenée à eau/eau`);
        const e = p.source === 'air_air' ? undefined : emetteurs();
        if (p.source !== 'air_air' && !e) hors.push(`PAC avec émetteur ${emId} non pris en charge`);
        else chauffage = { kind: 'pac', source: p.source, annee: p.annee, ...(e ? { emetteurs: e } : {}) };
      } else {
        hors.push(`générateur de chauffage ${id} non pris en charge`);
      }
    }
    if (appoints.length > 1) hors.push(`${appoints.length} appoints (un seul est pris en charge)`);
    else if (appoints.length === 1) {
      const a = appointDepuisId(Number(appoints[0].enum_type_generateur_ch_id));
      if (!a) hors.push(`appoint ${appoints[0].enum_type_generateur_ch_id} non pris en charge`);
      else {
        if (a.approx) approx(`appoint ${appoints[0].enum_type_generateur_ch_id} ramené à un poêle à bûches`);
        appoint = { kind: a.kind, annee: a.annee, flammeVerte: a.flammeVerte };
      }
    }
  }

  // --- ECS
  const ecsInstalls = arr(l.installation_ecs_collection?.installation_ecs);
  let ecs: Ecs = { kind: 'comme_le_chauffage' };
  if (ecsInstalls.length !== 1) {
    hors.push(`${ecsInstalls.length} installations d'eau chaude (une seule est prise en charge)`);
  } else {
    const inst = ecsInstalls[0];
    const cfg = String(inst.donnee_entree?.enum_cfg_installation_ecs_id);
    const gens = arr(inst.generateur_ecs_collection?.generateur_ecs).map((x: N) => x.donnee_entree ?? {});
    if (cfg === '2' || cfg === '3') hors.push(`ECS avec solaire ou deux systèmes (configuration ${cfg})`);
    else if (gens.length !== 1) hors.push(`${gens.length} générateurs d'eau chaude`);
    else {
      const g0 = gens[0];
      const id = Number(g0.enum_type_generateur_ecs_id);
      const volume = num(g0.volume_stockage);
      const dansVolumeChauffe = g0.position_volume_chauffe === '1';
      if (g0.enum_usage_generateur_id === '3' && generateurMixte) {
        ecs = { kind: 'comme_le_chauffage', dansVolumeChauffe };
      } else if (id >= 68 && id <= 71) {
        ecs = { kind: 'ballon_electrique', volumeL: volume, dansVolumeChauffe };
      } else if (id >= 1 && id <= 9) {
        ecs = {
          kind: 'chauffe_eau_thermodynamique',
          source: (['air_ambiant', 'air_exterieur', 'air_extrait'] as const)[Math.floor((id - 1) / 3)],
          annee: [2005, 2012, 2018][(id - 1) % 3],
          volumeL: volume,
          dansVolumeChauffe
        };
      } else if (id >= 10 && id <= 12) {
        if (chauffage?.kind === 'pac') ecs = { kind: 'comme_le_chauffage', dansVolumeChauffe };
        else {
          approx(`ECS PAC double service ${id} avec chauffage non PAC : ramenée à un chauffe-eau thermodynamique`);
          ecs = { kind: 'chauffe_eau_thermodynamique', source: 'air_ambiant', annee: 2012, volumeL: volume, dansVolumeChauffe };
        }
      } else if (id === 82) {
        approx('ECS « autre système thermodynamique électrique » ramené à un chauffe-eau thermodynamique');
        ecs = { kind: 'chauffe_eau_thermodynamique', source: 'air_ambiant', annee: 2012, volumeL: volume, dansVolumeChauffe };
      } else if (id >= 63 && id <= 67) {
        ecs = { kind: 'chauffe_eau_gaz_instantane', annee: [1975, 1985, 1995, 2008, 2018][id - 63], dansVolumeChauffe };
      } else if (id >= 58 && id <= 62) {
        ecs = { kind: 'accumulateur_gaz', annee: [1985, 1995, 2008, 1998, 2008][id - 58], volumeL: volume, dansVolumeChauffe };
      } else {
        hors.push(`générateur d'eau chaude ${id} non pris en charge`);
      }
    }
  }

  const surface = num(g.surface_habitable_logement);
  // Les anciens DPE ne donnent que la période de construction : on prend le milieu de la période.
  const annee = num(g.annee_construction) ?? ANNEE_PERIODE[String(g.enum_periode_construction_id)];
  if (!surface || !annee) hors.push('surface habitable ou année de construction manquante');

  if (hors.length > 0 || !chauffage) {
    return { horsPerimetre: hors.length ? hors : ['chauffage non importable'], approximations, meta };
  }

  const maison: Maison = {
    codePostal: /^\d{5}$/.test(cp) ? cp : '00000',
    altitudeM,
    zoneClimatique: meta.zoneClimatique,
    materiauxAnciens: l.meteo?.batiment_materiaux_anciens === '1',
    anneeConstruction: annee!,
    surfaceHabitable: surface!,
    niveaux: num(g.nombre_niveau_logement) ?? 1,
    hauteurSousPlafondM: num(g.hsp) ?? 2.5,
    murs,
    planchersBas,
    toitures,
    ouvertures,
    portes,
    ventilation,
    chauffage,
    ...(appoint ? { appoint } : {}),
    ecs
  };
  return { maison, horsPerimetre: [], approximations, meta };
}
