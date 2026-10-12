// État de l'application : la maison en cours de saisie, l'étape, les chantiers actifs. Persisté localement.

import type {
  Cardinal,
  Maison,
  Mur,
  Ouverture,
  PlancherBas,
  Porte,
  Toiture
} from '../src/model/house.ts';

export interface Etat {
  maison: Maison;
  etape: number;
  chantiers: string[];
  /** Tant que l'utilisateur n'a pas touché aux parois, on peut régénérer des valeurs par défaut cohérentes. */
  paroisGenerees: boolean;
}

const CLE = 'dpe-maison:v1';
let compteur = 0;
export const nouvelId = (prefixe: string) => `${prefixe}${Date.now().toString(36)}${(compteur++).toString(36)}`;

// --- Accès par chemin ("murs.0.isolation.type") -----------------------------------------------

export function lire(obj: any, chemin: string): any {
  return chemin.split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}

export function ecrire(obj: any, chemin: string, valeur: unknown): void {
  const cles = chemin.split('.');
  const derniere = cles.pop()!;
  let o = obj;
  for (const k of cles) {
    if (o[k] === undefined || o[k] === null) o[k] = /^\d+$/.test(k) ? [] : {};
    o = o[k];
  }
  if (valeur === undefined) delete o[derniere];
  else o[derniere] = valeur;
}

// --- Valeurs par défaut -----------------------------------------------------------------------

const ORIENTATIONS: Cardinal[] = ['sud', 'nord', 'est', 'ouest'];

/** Murs, ouvertures, sol et toit plausibles à partir des seules dimensions de la maison. */
export function genererParois(m: Maison): void {
  const surfaceParNiveau = m.surfaceHabitable / Math.max(1, m.niveaux);
  const cote = Math.sqrt(surfaceParNiveau);
  const hauteur = m.niveaux * m.hauteurSousPlafondM + 0.3 * (m.niveaux - 1);
  const surfaceMur = Math.round(cote * hauteur * 10) / 10;
  const anneeIso = m.anneeConstruction;
  const isole = anneeIso >= 1975;

  m.murs = ORIENTATIONS.map<Mur>((o) => ({
    id: nouvelId('m'),
    orientation: o,
    surfaceBrute: surfaceMur,
    adjacence: 'exterieur',
    materiau: anneeIso < 1948 ? 'pierre_massive' : 'parpaing_creux',
    epaisseurCm: anneeIso < 1948 ? 50 : 20,
    isolation: isole ? { type: 'oui_type_inconnu' } : { type: 'inconnue' },
    doublage: 'inconnu'
  }));

  m.planchersBas = [
    {
      id: nouvelId('pb'),
      surface: Math.round(surfaceParNiveau * 10) / 10,
      adjacence: 'terre_plein',
      type: 'inconnu',
      isolation: { type: 'inconnue' }
    }
  ];
  m.toitures = [
    {
      id: nouvelId('t'),
      surface: Math.round(surfaceParNiveau * 10) / 10,
      kind: 'combles_perdus',
      structure: 'inconnu',
      isolation: { type: 'inconnue' }
    }
  ];

  const fenetre = (o: Cardinal): Ouverture => ({
    id: nouvelId('o'),
    orientation: o,
    surface: Math.round(surfaceMur * 0.12 * 10) / 10,
    kind: 'fenetre_battante',
    menuiserie: 'inconnue',
    vitrage: anneeIso < 1975 ? 'simple' : 'double',
    fermeture: 'aucune'
  });
  m.ouvertures = ORIENTATIONS.map(fenetre);
  m.portes = [{ id: nouvelId('p'), surface: 2, kind: 'bois_pleine', orientation: 'sud' }];
}

export function maisonVierge(): Maison {
  const m: Maison = {
    codePostal: '',
    anneeConstruction: 1990,
    surfaceHabitable: 100,
    niveaux: 1,
    hauteurSousPlafondM: 2.5,
    murs: [],
    planchersBas: [],
    toitures: [],
    ouvertures: [],
    portes: [],
    ventilation: { kind: 'ouverture_fenetres' },
    chauffage: {
      kind: 'chaudiere_gaz',
      techno: 'standard',
      annee: 2005,
      emetteurs: { type: 'radiateur_bitube', robinetsThermostatiques: false, temperature: 'moyenne', programmation: 'aucune' }
    },
    ecs: { kind: 'comme_le_chauffage' }
  };
  genererParois(m);
  return m;
}

export function nouveauMur(m: Maison): Mur {
  const modele = m.murs[0];
  return {
    id: nouvelId('m'),
    orientation: 'sud',
    surfaceBrute: 20,
    adjacence: 'exterieur',
    materiau: modele?.materiau ?? 'parpaing_creux',
    epaisseurCm: modele?.epaisseurCm ?? 20,
    isolation: structuredClone(modele?.isolation ?? { type: 'inconnue' }),
    doublage: modele?.doublage ?? 'inconnu'
  };
}

export const nouveauPlancher = (): PlancherBas => ({
  id: nouvelId('pb'),
  surface: 20,
  adjacence: 'terre_plein',
  type: 'inconnu',
  isolation: { type: 'inconnue' }
});

export const nouvelleToiture = (): Toiture => ({
  id: nouvelId('t'),
  surface: 20,
  kind: 'combles_perdus',
  structure: 'inconnu',
  isolation: { type: 'inconnue' }
});

export const nouvelleOuverture = (): Ouverture => ({
  id: nouvelId('o'),
  orientation: 'sud',
  surface: 2,
  kind: 'fenetre_battante',
  menuiserie: 'inconnue',
  vitrage: 'double',
  fermeture: 'aucune'
});

export const nouvellePorte = (): Porte => ({ id: nouvelId('p'), surface: 2, kind: 'bois_pleine', orientation: 'sud' });

// --- Persistance ------------------------------------------------------------------------------

export function charger(): Etat | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const e = JSON.parse(brut) as Etat;
    return e?.maison?.murs ? e : null;
  } catch {
    return null;
  }
}

export function sauver(e: Etat): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(e));
  } catch {
    /* stockage indisponible (navigation privée) : l'application reste utilisable */
  }
}

export function effacer(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* ignoré */
  }
}
