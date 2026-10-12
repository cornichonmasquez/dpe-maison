// Applique un plan dessiné (contour + nature de chaque façade) à la saisie de la maison.

import type { AdjacenceMur, Cardinal, Maison, Mur, Ouverture } from '../model/house.ts';
import { aretes, hauteurFacade, resume } from './geometrie.ts';
import type { Coord } from './geometrie.ts';

export interface PlanDessine {
  anneau: Coord[];
  /** Nature de chaque façade, dans l'ordre des arêtes de l'anneau. */
  adjacences: AdjacenceMur[];
}

export interface OptionsApplication {
  /** Remplace les ouvertures par un groupe par façade (à utiliser tant que l'utilisateur ne les a pas saisies). */
  regenererOuvertures: boolean;
}

const arrondi = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const ORIENTATIONS: Cardinal[] = ['sud', 'nord', 'est', 'ouest'];
/** Part de vitrage par défaut d'une façade (12 % de sa surface). */
const PART_VITRAGE = 0.12;

/** Un mur par façade du plan, avec les caractéristiques du premier mur existant comme point de départ. */
export function mursDepuisPlan(plan: PlanDessine, maison: Pick<Maison, 'niveaux' | 'hauteurSousPlafondM'>, modele?: Mur): Mur[] {
  const h = hauteurFacade(maison.niveaux, maison.hauteurSousPlafondM);
  return aretes(plan.anneau).map((a, i) => ({
    id: `plan${i + 1}`,
    orientation: a.orientation,
    surfaceBrute: arrondi(a.longueurM * h),
    longueurM: arrondi(a.longueurM),
    adjacence: plan.adjacences[i] ?? 'exterieur',
    materiau: modele?.materiau ?? 'inconnu',
    epaisseurCm: modele?.epaisseurCm,
    isolation: structuredClone(modele?.isolation ?? { type: 'inconnue' }),
    doublage: modele?.doublage ?? 'inconnu'
  }));
}

/** Met à jour `maison` (par mutation) d'après le plan : murs, et surface/périmètre du sol et du toit quand c'est sans ambiguïté. */
export function appliquerPlan(maison: Maison, plan: PlanDessine, opts: OptionsApplication): void {
  const modele = maison.murs.find((m) => m.adjacence === 'exterieur') ?? maison.murs[0];
  maison.murs = mursDepuisPlan(plan, maison, modele);

  const r = resume(plan.anneau);
  const perimetreExterieur = r.aretes.reduce(
    (s, a, i) => s + (['exterieur', 'garage', 'cellier', 'sous_sol', 'local_non_chauffe', 'veranda'].includes(plan.adjacences[i] ?? 'exterieur') ? a.longueurM : 0),
    0
  );

  if (maison.planchersBas.length === 1) {
    maison.planchersBas[0].surface = arrondi(r.aireM2);
    maison.planchersBas[0].perimetre = arrondi(perimetreExterieur);
  }
  if (maison.toitures.length === 1 && ['combles_perdus', 'terrasse', 'combles_peu_ventiles'].includes(maison.toitures[0].kind)) {
    maison.toitures[0].surface = arrondi(r.aireM2);
  }

  if (opts.regenererOuvertures) {
    const surfaceParOrientation = new Map<Cardinal, number>();
    for (const m of maison.murs) {
      if (m.adjacence !== 'exterieur') continue;
      surfaceParOrientation.set(m.orientation, (surfaceParOrientation.get(m.orientation) ?? 0) + m.surfaceBrute);
    }
    const modeleOuverture = maison.ouvertures[0];
    maison.ouvertures = ORIENTATIONS.filter((o) => surfaceParOrientation.has(o)).map<Ouverture>((o, i) => ({
      id: `fen${i + 1}`,
      orientation: o,
      surface: arrondi(surfaceParOrientation.get(o)! * PART_VITRAGE),
      kind: 'fenetre_battante',
      menuiserie: modeleOuverture?.menuiserie ?? 'inconnue',
      vitrage: modeleOuverture?.vitrage ?? 'double',
      fermeture: modeleOuverture?.fermeture ?? 'aucune'
    }));
  }
}
