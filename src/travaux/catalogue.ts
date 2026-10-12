// Catalogue des travaux simulables. Chaque chantier transforme la saisie de la maison (`Maison`)
// puis le moteur recalcule : aucune valeur précalculée.
//
// Hypothèses de performance : valeurs courantes de rénovation (R en m².K/W, Uw en W/m².K), citées dans
// `detail` pour que l'utilisateur sache ce qui est simulé.

import type { ChauffagePrincipal, EmetteursEau, Maison, Mur, Toiture } from '../model/house.ts';

export type CategorieTravaux = 'isolation' | 'menuiseries' | 'ventilation' | 'chauffage' | 'eau_chaude';

export interface Chantier {
  id: string;
  categorie: CategorieTravaux;
  titre: string;
  /** Ce qui est simulé, en une phrase. */
  detail: string;
  /** Un seul chantier actif par groupe d'exclusion (ex. : un seul générateur de chauffage). */
  groupe?: string;
  /** Le chantier a-t-il un sens pour cette maison ? Sinon il n'est pas proposé. */
  applicable: (m: Maison) => boolean;
  appliquer: (m: Maison) => Maison;
}

export const LIBELLES_CATEGORIES: Record<CategorieTravaux, string> = {
  isolation: 'Isolation',
  menuiseries: 'Fenêtres, portes et volets',
  ventilation: 'Ventilation',
  chauffage: 'Chauffage',
  eau_chaude: 'Eau chaude'
};

const copie = (m: Maison): Maison => structuredClone(m);

const emetteursParDefaut: EmetteursEau = {
  type: 'radiateur_bitube',
  robinetsThermostatiques: true,
  temperature: 'basse_ou_moyenne',
  programmation: 'centrale'
};

function emetteursActuels(c: ChauffagePrincipal): EmetteursEau {
  return 'emetteurs' in c && c.emetteurs ? c.emetteurs : emetteursParDefaut;
}

const estCombustion = (c: ChauffagePrincipal) => c.kind === 'chaudiere_gaz' || c.kind === 'chaudiere_fioul';

// Résistance supposée de l'isolation intérieure déjà en place quand on ajoute une isolation extérieure.
const R_ITI_EXISTANT = 2;

export const CATALOGUE: Chantier[] = [
  // --- Isolation -------------------------------------------------------------------------------
  {
    id: 'combles',
    categorie: 'isolation',
    titre: 'Isoler les combles perdus',
    detail: 'Laine soufflée, R = 7 m².K/W',
    applicable: (m) => m.toitures.some((t) => t.kind === 'combles_perdus' || t.kind === 'combles_peu_ventiles'),
    appliquer: (m) => {
      const x = copie(m);
      for (const t of x.toitures) {
        if (t.kind === 'combles_perdus' || t.kind === 'combles_peu_ventiles') t.isolation = { type: 'ite', resistance: 7 };
      }
      return x;
    }
  },
  {
    id: 'rampants',
    categorie: 'isolation',
    titre: 'Isoler les rampants',
    detail: 'Isolation par l’intérieur, R = 6 m².K/W',
    applicable: (m) => m.toitures.some((t) => t.kind === 'rampants'),
    appliquer: (m) => {
      const x = copie(m);
      for (const t of x.toitures) if (t.kind === 'rampants') t.isolation = { type: 'iti', resistance: 6 };
      return x;
    }
  },
  {
    id: 'terrasse',
    categorie: 'isolation',
    titre: 'Isoler le toit-terrasse',
    detail: 'Isolation par l’extérieur, R = 5 m².K/W',
    applicable: (m) => m.toitures.some((t) => t.kind === 'terrasse'),
    appliquer: (m) => {
      const x = copie(m);
      for (const t of x.toitures) if (t.kind === 'terrasse') t.isolation = { type: 'ite', resistance: 5 };
      return x;
    }
  },
  {
    id: 'murs_ite',
    categorie: 'isolation',
    titre: 'Isoler les murs par l’extérieur',
    detail: 'Isolant ajouté R = 4,5 m².K/W (c’est la recommandation officielle)',
    applicable: (m) => m.murs.some((u) => u.adjacence === 'exterieur'),
    appliquer: (m) => {
      const x = copie(m);
      for (const mur of x.murs) {
        if (mur.adjacence !== 'exterieur') continue;
        const existant = mur.isolation.type === 'iti' ? (mur.isolation.resistance ?? R_ITI_EXISTANT) : 0;
        mur.isolation = { type: 'ite', resistance: 4.5 + existant };
        mur.doublage = 'aucun';
      }
      return x;
    }
  },
  {
    id: 'plancher_bas',
    categorie: 'isolation',
    titre: 'Isoler le plancher bas',
    detail: 'Isolant sous plancher ou sous chape, R = 3 m².K/W',
    applicable: (m) => m.planchersBas.some((p) => p.adjacence !== 'logement_dessous'),
    appliquer: (m) => {
      const x = copie(m);
      for (const p of x.planchersBas) {
        if (p.adjacence === 'logement_dessous') continue;
        p.isolation = { type: p.adjacence === 'terre_plein' ? 'iti' : 'ite', resistance: 3 };
      }
      return x;
    }
  },

  // --- Menuiseries ------------------------------------------------------------------------------
  {
    id: 'fenetres_double',
    categorie: 'menuiseries',
    titre: 'Changer les fenêtres (double vitrage performant)',
    detail: 'PVC, double vitrage argon peu émissif, Uw ≈ 1,3',
    groupe: 'fenetres',
    applicable: (m) => m.ouvertures.some((o) => o.kind !== 'brique_de_verre'),
    appliquer: (m) => {
      const x = copie(m);
      for (const o of x.ouvertures) {
        o.menuiserie = 'pvc';
        o.vitrage = 'double';
        o.gaz = 'argon';
        o.peuEmissif = true;
        o.laMm = 16;
      }
      return x;
    }
  },
  {
    id: 'fenetres_triple',
    categorie: 'menuiseries',
    titre: 'Changer les fenêtres (triple vitrage)',
    detail: 'PVC, triple vitrage argon peu émissif, Uw ≈ 0,9',
    groupe: 'fenetres',
    applicable: (m) => m.ouvertures.some((o) => o.kind !== 'brique_de_verre'),
    appliquer: (m) => {
      const x = copie(m);
      for (const o of x.ouvertures) {
        o.menuiserie = 'pvc';
        o.vitrage = 'triple';
        o.gaz = 'argon';
        o.peuEmissif = true;
        o.laMm = 12;
      }
      return x;
    }
  },
  {
    id: 'volets',
    categorie: 'menuiseries',
    titre: 'Poser des volets roulants isolés',
    detail: 'Fermeture isolée sans ajours sur toutes les ouvertures',
    applicable: (m) => m.ouvertures.some((o) => o.fermeture !== 'volet_isole'),
    appliquer: (m) => {
      const x = copie(m);
      for (const o of x.ouvertures) o.fermeture = 'volet_isole';
      return x;
    }
  },
  {
    id: 'porte',
    categorie: 'menuiseries',
    titre: 'Changer les portes extérieures',
    detail: 'Porte opaque pleine isolée',
    applicable: (m) => m.portes.some((p) => p.kind !== 'isolee' && porteSurMurExterieur(m, p.murId, p.orientation)),
    appliquer: (m) => {
      const x = copie(m);
      for (const p of x.portes) {
        if (porteSurMurExterieur(x, p.murId, p.orientation)) p.kind = 'isolee';
      }
      return x;
    }
  },

  // --- Ventilation ------------------------------------------------------------------------------
  {
    id: 'vmc_hygro_b',
    categorie: 'ventilation',
    titre: 'VMC simple flux hygroréglable B',
    detail: 'Débits modulés selon l’humidité',
    groupe: 'ventilation',
    applicable: (m) => m.ventilation.kind !== 'vmc_df_echangeur' && m.ventilation.kind !== 'vmc_sf_hygro_b',
    appliquer: (m) => {
      const x = copie(m);
      x.ventilation = { kind: 'vmc_sf_hygro_b', installAnnee: 2026 };
      return x;
    }
  },
  {
    id: 'vmc_df',
    categorie: 'ventilation',
    titre: 'VMC double flux',
    detail: 'Avec échangeur de chaleur',
    groupe: 'ventilation',
    applicable: (m) => m.ventilation.kind !== 'vmc_df_echangeur',
    appliquer: (m) => {
      const x = copie(m);
      x.ventilation = { kind: 'vmc_df_echangeur', installAnnee: 2026 };
      return x;
    }
  },

  // --- Chauffage --------------------------------------------------------------------------------
  {
    id: 'condensation',
    categorie: 'chauffage',
    titre: 'Chaudière à condensation neuve',
    detail: 'Même énergie, chaudière à condensation de dernière génération',
    groupe: 'generateur',
    applicable: (m) =>
      estCombustion(m.chauffage) && !((m.chauffage as any).techno === 'condensation' && (m.chauffage as any).annee > 2015),
    appliquer: (m) => {
      const x = copie(m);
      const c = x.chauffage as Extract<ChauffagePrincipal, { kind: 'chaudiere_gaz' | 'chaudiere_fioul' }>;
      c.techno = 'condensation';
      c.annee = 2026;
      return x;
    }
  },
  {
    id: 'pac_air_eau',
    categorie: 'chauffage',
    titre: 'Pompe à chaleur air/eau',
    detail: 'Remplace le générateur, conserve les radiateurs (chauffage et eau chaude)',
    groupe: 'generateur',
    applicable: (m) => !(m.chauffage.kind === 'pac' && m.chauffage.source === 'air_eau'),
    appliquer: (m) => {
      const x = copie(m);
      x.chauffage = { kind: 'pac', source: 'air_eau', annee: 2026, emetteurs: emetteursActuels(m.chauffage) };
      return x;
    }
  },
  {
    id: 'pac_air_air',
    categorie: 'chauffage',
    titre: 'Pompe à chaleur air/air',
    detail: 'Unités intérieures murales, remplace le générateur',
    groupe: 'generateur',
    applicable: (m) => !(m.chauffage.kind === 'pac' && m.chauffage.source === 'air_air'),
    appliquer: (m) => {
      const x = copie(m);
      x.chauffage = { kind: 'pac', source: 'air_air', annee: 2026 };
      if (x.ecs.kind === 'comme_le_chauffage') {
        x.ecs = { kind: 'ballon_electrique', volumeL: 200, dansVolumeChauffe: false };
      }
      return x;
    }
  },
  {
    id: 'regulation',
    categorie: 'chauffage',
    titre: 'Régulation pièce par pièce',
    detail: 'Robinets thermostatiques et programmation par pièce',
    applicable: (m) => {
      const c = m.chauffage;
      if (!('emetteurs' in c) || !c.emetteurs) return false;
      return !c.emetteurs.robinetsThermostatiques || c.emetteurs.programmation !== 'par_piece';
    },
    appliquer: (m) => {
      const x = copie(m);
      const c = x.chauffage as any;
      c.emetteurs = { ...c.emetteurs, robinetsThermostatiques: true, programmation: 'par_piece' };
      return x;
    }
  },
  {
    id: 'appoint_granules',
    categorie: 'chauffage',
    titre: 'Poêle à granulés en appoint',
    detail: 'Poêle à granulés flamme verte, en complément du chauffage principal',
    groupe: 'appoint',
    applicable: (m) => !m.appoint,
    appliquer: (m) => {
      const x = copie(m);
      x.appoint = { kind: 'poele_granules', annee: 2026, flammeVerte: true };
      return x;
    }
  },
  {
    id: 'appoint_buches',
    categorie: 'chauffage',
    titre: 'Poêle à bûches en appoint',
    detail: 'Poêle ou insert à bûches flamme verte, en complément du chauffage principal',
    groupe: 'appoint',
    applicable: (m) => !m.appoint,
    appliquer: (m) => {
      const x = copie(m);
      x.appoint = { kind: 'poele_buches', annee: 2026, flammeVerte: true };
      return x;
    }
  },

  // --- Eau chaude -------------------------------------------------------------------------------
  {
    id: 'cet',
    categorie: 'eau_chaude',
    titre: 'Chauffe-eau thermodynamique',
    detail: 'Ballon de 200 L sur air ambiant',
    applicable: (m) => m.ecs.kind !== 'chauffe_eau_thermodynamique',
    appliquer: (m) => {
      const x = copie(m);
      x.ecs = { kind: 'chauffe_eau_thermodynamique', source: 'air_ambiant', annee: 2026, volumeL: 200, dansVolumeChauffe: false };
      return x;
    }
  }
];

/** Travaux que le moteur ne sait pas (encore) calculer : affichés, mais non activables. */
export const PAS_ENCORE_CALCULES = [
  'Panneaux photovoltaïques',
  'Chauffe-eau solaire',
  'Plancher chauffant',
  'Poêle ou chaudière à bois en chauffage principal'
];

function porteSurMurExterieur(m: Maison, murId?: string, orientation?: Mur['orientation']): boolean {
  const mur = murId
    ? m.murs.find((x) => x.id === murId)
    : orientation
      ? m.murs.find((x) => x.orientation === orientation)
      : m.murs.find((x) => x.adjacence === 'exterieur');
  return mur?.adjacence === 'exterieur';
}

/** Applique une sélection de chantiers dans l'ordre du catalogue. Les exclusions de groupe sont gérées par l'appelant. */
export function appliquerChantiers(maison: Maison, actifs: ReadonlySet<string>): Maison {
  let m = copie(maison);
  for (const c of CATALOGUE) {
    if (actifs.has(c.id) && c.applicable(m)) m = c.appliquer(m);
  }
  return m;
}

/** Active ou désactive un chantier en respectant l'exclusion de groupe. */
export function basculer(actifs: ReadonlySet<string>, id: string): Set<string> {
  const suivant = new Set(actifs);
  if (suivant.has(id)) {
    suivant.delete(id);
    return suivant;
  }
  const cible = CATALOGUE.find((c) => c.id === id);
  if (cible?.groupe) {
    for (const c of CATALOGUE) if (c.groupe === cible.groupe) suivant.delete(c.id);
  }
  suivant.add(id);
  return suivant;
}

export type { Toiture };
