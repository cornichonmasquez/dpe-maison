// Modèle de saisie : ce que l'utilisateur décrit de sa maison, dans son vocabulaire.
// Le mapper (src/mapper) le traduit en entrée du moteur 3CL-DPE (JSON ADEME).
//
// Principe « hybride » : chaque donnée peut être « inconnue ». Elle reçoit alors la valeur par défaut
// légale de la méthode (table forfaitaire selon l'année de construction), comme le ferait un diagnostiqueur.

export type Cardinal = 'sud' | 'nord' | 'est' | 'ouest';

// --- Isolation (murs, planchers, toitures) -----------------------------------------------------

export type IsolationType =
  | 'inconnue' // « je ne sais pas » : table forfaitaire
  | 'aucune'
  | 'iti' // par l'intérieur
  | 'ite' // par l'extérieur
  | 'itr' // répartie (ex. brique monomur)
  | 'oui_type_inconnu'; // isolé, mais on ne sait pas comment

export interface Isolation {
  type: IsolationType;
  /** Année des travaux d'isolation, si connue. Sinon on suppose l'année de construction. */
  annee?: number;
  /** Épaisseur d'isolant mesurée (cm). Prioritaire sur l'année. */
  epaisseurCm?: number;
  /** Résistance thermique R de l'isolant (m².K/W), si un justificatif la donne. Prioritaire. */
  resistance?: number;
}

// --- Parois ------------------------------------------------------------------------------------

export type MurMateriau =
  | 'inconnu'
  | 'pierre_massive'
  | 'pierre_remplissage'
  | 'pise'
  | 'pan_de_bois_sans_remplissage'
  | 'pan_de_bois_remplissage'
  | 'bois_rondin'
  | 'brique_pleine'
  | 'brique_pleine_double'
  | 'brique_creuse'
  | 'brique_alveolaire'
  | 'parpaing_plein'
  | 'parpaing_creux'
  | 'beton_banche'
  | 'beton_cellulaire'
  | 'ossature_bois'
  | 'sandwich_beton';

export type DoublageMur =
  | 'inconnu'
  | 'aucun'
  | 'lame_air_inf_15mm' // doublage indéterminé ou lame d'air < 15 mm
  | 'lame_air_sup_15mm'
  | 'connu'; // plâtre, brique, bois

export type AdjacenceMur =
  | 'exterieur'
  | 'garage'
  | 'cellier'
  | 'sous_sol'
  | 'local_non_chauffe'
  | 'veranda'
  | 'logement_voisin' // mitoyenneté avec un logement chauffé
  | 'local_non_habitation';

/** Configuration d'isolation d'un local non chauffé (garage, cellier, comble...). */
export interface LocalNonChauffe {
  /** Surface (m²) des parois du local donnant sur l'espace chauffé. Défaut : surface de la paroi décrite. */
  aiu?: number;
  /** Surface (m²) des parois du local donnant sur l'extérieur. Défaut : 2 × aiu. */
  aue?: number;
  /** Les parois côté espace chauffé sont-elles isolées ? Défaut : déduit de l'isolation de la paroi. */
  paroisChauffeesIsolees?: boolean;
  /** Les parois du local donnant sur l'extérieur sont-elles isolées ? Défaut : non. */
  paroisExterieuresIsolees?: boolean;
}

export interface Mur {
  id: string;
  orientation: Cardinal;
  /** Surface brute (m²), fenêtres et portes comprises : longueur × hauteur. */
  surfaceBrute: number;
  adjacence: AdjacenceMur;
  materiau: MurMateriau;
  /** Épaisseur du mur porteur en cm (hors isolant). Défaut selon le matériau. */
  epaisseurCm?: number;
  isolation: Isolation;
  doublage?: DoublageMur;
  /** Enduit isolant sur paroi ancienne. */
  enduitIsolant?: boolean;
  lnc?: LocalNonChauffe;
}

export type PlancherBasType =
  | 'inconnu'
  | 'dalle_beton'
  | 'plancher_bois'
  | 'entrevous_terre_cuite'
  | 'entrevous_isolant'
  | 'voutains';

export type AdjacencePlancherBas =
  | 'terre_plein'
  | 'vide_sanitaire'
  | 'sous_sol'
  | 'garage'
  | 'cellier'
  | 'local_non_chauffe'
  | 'exterieur'
  | 'logement_dessous';

export interface PlancherBas {
  id: string;
  surface: number;
  /** Périmètre (m) en contact avec l'extérieur, utilisé pour le calcul sur terre-plein. Défaut estimé. */
  perimetre?: number;
  adjacence: AdjacencePlancherBas;
  type: PlancherBasType;
  isolation: Isolation;
  lnc?: LocalNonChauffe;
}

export type ToitureKind =
  | 'combles_perdus' // grenier non aménagé, plafond isolé
  | 'combles_peu_ventiles'
  | 'rampants' // combles aménagés sous rampants
  | 'terrasse' // toit-terrasse
  | 'plafond_sous_logement_ou_local'; // plafond donnant sur un local chauffé voisin

export type ToitureStructure =
  | 'inconnu'
  | 'bois' // plafond bois ; type exact choisi selon la toiture
  | 'bois_entre_solives'
  | 'bois_sous_solives'
  | 'bois_sur_solives'
  | 'plafond_remplissage' // plafond avec ou sans remplissage
  | 'beton'
  | 'hourdis'
  | 'plaque_platre';

export interface Toiture {
  id: string;
  surface: number;
  kind: ToitureKind;
  structure: ToitureStructure;
  isolation: Isolation;
  lnc?: LocalNonChauffe;
}

// --- Ouvertures --------------------------------------------------------------------------------

export type OuvertureKind =
  | 'fenetre_battante'
  | 'fenetre_coulissante'
  | 'porte_fenetre_battante'
  | 'porte_fenetre_battante_soubassement'
  | 'porte_fenetre_coulissante'
  | 'brique_de_verre';

export type Menuiserie = 'inconnue' | 'pvc' | 'bois' | 'alu_rupteur' | 'alu_sans_rupteur' | 'bois_metal';
export type Vitrage = 'inconnu' | 'simple' | 'double' | 'triple' | 'survitrage';
export type Fermeture =
  | 'aucune'
  | 'persiennes_ajourees'
  | 'volet_roulant_alu'
  | 'volet_roulant_pvc_bois'
  | 'volet_roulant_pvc_bois_epais'
  | 'volet_battant_pvc_bois'
  | 'volet_battant_pvc_bois_epais'
  | 'volet_isole';
export type PoseMenuiserie = 'nu_interieur' | 'nu_exterieur' | 'tunnel';

export interface Ouverture {
  id: string;
  orientation: Cardinal;
  /** Surface totale du groupe (m²). */
  surface: number;
  /** Nombre d'ouvertures du groupe (pour estimer le périmètre des ponts thermiques). Défaut 1. */
  nombre?: number;
  kind: OuvertureKind;
  menuiserie: Menuiserie;
  vitrage: Vitrage;
  /** Épaisseur de la lame de gaz (mm). Défaut 12. */
  laMm?: number;
  gaz?: 'air' | 'argon' | 'inconnu';
  /** Vitrage à isolation renforcée (couche peu émissive). */
  peuEmissif?: boolean;
  fermeture: Fermeture;
  pose?: PoseMenuiserie;
  /** Largeur du dormant (cm). Défaut 5. */
  dormantCm?: number;
  /** Joints d'étanchéité sur les ouvrants. Défaut : oui pour un double vitrage ou mieux, non sinon. */
  joints?: boolean;
  /** Mur sur lequel l'ouverture est posée. Défaut : premier mur de même orientation. */
  murId?: string;
  /** Masque solaire proche (balcon, auvent...). Défaut : aucun. */
  masqueProche?: 'aucun' | 'balcon_auvent' | 'loggia';
  /** Masque solaire lointain (bâtiment, relief, végétation) : hauteur apparente. */
  masqueLointain?: 'aucun' | 'moins_15' | '15_30' | '30_60' | 'plus_60';
}

export type PorteKind =
  | 'bois_pleine'
  | 'bois_vitree'
  | 'pvc_pleine'
  | 'pvc_vitree'
  | 'metal_pleine'
  | 'metal_vitree'
  | 'isolee'
  | 'autre';

export interface Porte {
  id: string;
  surface: number;
  kind: PorteKind;
  /** Joints d'étanchéité. Défaut : oui (porte récente supposée), non pour une porte bois pleine simple. */
  joints?: boolean;
  murId?: string;
  orientation?: Cardinal;
}

// --- Systèmes ----------------------------------------------------------------------------------

export type VentilationKind =
  | 'ouverture_fenetres'
  | 'entrees_air'
  | 'conduit_naturel'
  | 'vmc_sf_autoreglable'
  | 'vmc_sf_hygro_a'
  | 'vmc_sf_hygro_b'
  | 'vmc_df_echangeur'
  | 'vmc_df_sans_echangeur';

export interface Ventilation {
  kind: VentilationKind;
  installAnnee?: number;
}

export type TechnoChaudiere = 'classique' | 'standard' | 'basse_temperature' | 'condensation';
export type EmetteurEau =
  | 'radiateur_bitube'
  | 'radiateur_monotube'
  | 'plancher_chauffant';

export interface EmetteursEau {
  type: EmetteurEau;
  robinetsThermostatiques: boolean;
  /** Température de l'eau dans les émetteurs : haute (≥ 65 °C), moyenne ou basse. 'basse_ou_moyenne' vaut moyenne. */
  temperature: 'haute' | 'moyenne' | 'basse' | 'basse_ou_moyenne';
  /** Année d'installation des émetteurs ; défaut année de construction. */
  annee?: number;
  /** Programmation de la température. */
  programmation: 'aucune' | 'centrale' | 'par_piece';
}

export type ChauffagePrincipal =
  | { kind: 'chaudiere_gaz'; techno: TechnoChaudiere; annee: number; emetteurs: EmetteursEau }
  | { kind: 'chaudiere_fioul'; techno: TechnoChaudiere; annee: number; emetteurs: EmetteursEau }
  | {
      kind: 'electrique_direct';
      emetteur: 'convecteur' | 'panneau_rayonnant' | 'radiateur' | 'accumulation' | 'plancher_rayonnant';
    }
  | {
      kind: 'pac';
      source: 'air_air' | 'air_eau' | 'eau_eau' | 'geothermique';
      annee: number;
      emetteurs?: EmetteursEau;
      /** Coefficient de performance saisi si connu (SCOP). */
      scop?: number;
    };

export interface ChauffageAppoint {
  kind: 'poele_buches' | 'insert' | 'poele_granules';
  annee: number;
  flammeVerte?: boolean;
}

export type Ecs =
  | { kind: 'comme_le_chauffage'; dansVolumeChauffe?: boolean }
  | { kind: 'ballon_electrique'; volumeL?: number; dansVolumeChauffe?: boolean }
  | {
      kind: 'chauffe_eau_thermodynamique';
      source?: 'air_ambiant' | 'air_exterieur' | 'air_extrait';
      annee?: number;
      volumeL?: number;
      dansVolumeChauffe?: boolean;
    }
  | { kind: 'chauffe_eau_gaz_instantane'; annee: number; dansVolumeChauffe?: boolean }
  | { kind: 'accumulateur_gaz'; annee: number; volumeL?: number; dansVolumeChauffe?: boolean };

// --- La maison ---------------------------------------------------------------------------------

export interface Maison {
  /** Code postal (5 chiffres) ou département. */
  codePostal: string;
  /** Altitude réelle (m) ou classe : < 400, 400-800, > 800. */
  altitudeM?: number;
  /** Zone climatique forcée (H1a à H3), si la zone déduite du code postal est contestée. */
  zoneClimatique?: string;
  /**
   * Bâtiment ancien en matériaux anciens (pierre, pisé, brique pleine, pan de bois...) : il est alors traité
   * à inertie lourde. Défaut : construit avant 1948 et murs majoritairement en matériaux anciens.
   */
  materiauxAnciens?: boolean;
  anneeConstruction: number;
  surfaceHabitable: number;
  niveaux: number;
  hauteurSousPlafondM: number;
  murs: Mur[];
  planchersBas: PlancherBas[];
  toitures: Toiture[];
  ouvertures: Ouverture[];
  portes: Porte[];
  ventilation: Ventilation;
  chauffage: ChauffagePrincipal;
  appoint?: ChauffageAppoint;
  ecs: Ecs;
}
