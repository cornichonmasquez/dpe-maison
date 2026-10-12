// Appelle le moteur Open3CL et en extrait un résultat lisible.

import { calcul_3cl } from '@open3cl/engine';
import { buildDpe, type OptionsBuild, type Deduit } from '../mapper/buildDpe.ts';
import type { Maison } from '../model/house.ts';

export type Lettre = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface VarianteCoefficient {
  coefficient: number;
  energiePrimaireM2: number;
  energiePrimaire: number;
  etiquetteEnergie: Lettre;
  etiquetteFinale: Lettre;
}

export interface Poste {
  energieFinale: number; // kWh/an
  energiePrimaire: number; // kWh/an, coefficient en vigueur
  ges: number; // kgCO2/an
  cout: number; // €/an
}

export interface Resultat {
  /** Coefficient électricité en vigueur (1,9 depuis le 01/01/2026). */
  etiquetteEnergie: Lettre;
  etiquetteClimat: Lettre;
  /** Pire des deux étiquettes. */
  etiquetteFinale: Lettre;
  energiePrimaireM2: number; // kWh EP/m²/an
  gesM2: number; // kgCO2/m²/an
  energiePrimaire: number; // kWh EP/an
  energieFinale: number; // kWh EF/an
  ges: number; // kgCO2/an
  coutAnnuel: number; // €/an
  variantes: { actuel: VarianteCoefficient; annee2027: VarianteCoefficient; ancien: VarianteCoefficient };
  postes: Record<'chauffage' | 'ecs' | 'eclairage' | 'auxiliaires' | 'refroidissement', Poste>;
  /** Déperditions de l'enveloppe en W/K. */
  deperditions: Record<
    'murs' | 'planchersBas' | 'planchersHauts' | 'baies' | 'portes' | 'pontsThermiques' | 'renouvellementAir' | 'total',
    number
  >;
  besoins: { chauffage: number; ecs: number };
  deduit: Deduit;
  avertissements: string[];
}

const LETTRES: Lettre[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const pire = (a: Lettre, b: Lettre): Lettre => (LETTRES.indexOf(a) >= LETTRES.indexOf(b) ? a : b);
const arrondi = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/** Exécute le moteur en silence (il journalise beaucoup quand il compare à un DPE d'origine). */
export function calculerBrut(dpe: unknown): any {
  const sauve = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try {
    // le moteur mute son entrée (issue Open3CL #161) : on lui donne un clone
    return calcul_3cl(structuredClone(dpe), { sanitize: true });
  } finally {
    Object.assign(console, sauve);
  }
}

export class ErreurCalcul extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurCalcul';
  }
}

/**
 * Le moteur ne valide presque rien : une entrée incomplète donne parfois NaN, converti en classe « G »
 * ou en 0. On refuse tout résultat contenant une valeur non finie plutôt que d'afficher une étiquette fausse.
 */
function verifierSortie(sortie: any): void {
  const invalides: string[] = [];
  const parcourir = (o: any, chemin: string) => {
    for (const [k, v] of Object.entries(o ?? {})) {
      if (typeof v === 'number' && !Number.isFinite(v)) invalides.push(chemin + k);
      else if (v && typeof v === 'object') parcourir(v, `${chemin}${k}.`);
    }
  };
  parcourir(sortie, '');
  const attendus = [
    sortie?.ep_conso?.ep_conso_5_usages_m2,
    sortie?.emission_ges?.emission_ges_5_usages_m2,
    sortie?.deperdition?.deperdition_enveloppe
  ];
  if (invalides.length > 0 || attendus.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new ErreurCalcul(
      `Calcul impossible : le moteur a produit des valeurs invalides (${invalides.slice(0, 3).join(', ') || 'résultat manquant'}). ` +
        'Une donnée du système de chauffage, de production d’eau chaude ou d’une paroi est probablement incohérente.'
    );
  }
}

export function calculer(maison: Maison, options: OptionsBuild = {}): Resultat {
  const construit = buildDpe(maison, options);
  const sortie = calculerBrut(construit.dpe)?.logement?.sortie;
  if (!sortie) {
    throw new ErreurCalcul("Le moteur n'a pas pu calculer ce logement (entrée incomplète ou incohérente).");
  }
  verifierSortie(sortie);
  const { ep_conso: ep, ef_conso: ef, emission_ges: ges, cout, deperdition: dep, apport_et_besoin: ab } = sortie;

  const finale = (energie: Lettre) => pire(energie, ges.classe_emission_ges as Lettre);
  const variante = (c: number, m2: number, total: number, classe: Lettre): VarianteCoefficient => ({
    coefficient: c,
    energiePrimaireM2: arrondi(m2),
    energiePrimaire: Math.round(total),
    etiquetteEnergie: classe,
    etiquetteFinale: finale(classe)
  });

  const poste = (efv: number, epv: number, gesv: number, coutv: number): Poste => ({
    energieFinale: Math.round(efv ?? 0),
    energiePrimaire: Math.round(epv ?? 0),
    ges: Math.round(gesv ?? 0),
    cout: Math.round(coutv ?? 0)
  });

  const aux = (x: any, p: string) =>
    (x[`${p}auxiliaire_generation_ch`] ?? 0) +
    (x[`${p}auxiliaire_distribution_ch`] ?? 0) +
    (x[`${p}auxiliaire_generation_ecs`] ?? 0) +
    (x[`${p}auxiliaire_distribution_ecs`] ?? 0) +
    (x[`${p}auxiliaire_ventilation`] ?? 0) +
    (x[`${p}auxiliaire_distribution_fr`] ?? 0);

  return {
    etiquetteEnergie: ep.classe_bilan_dpe,
    etiquetteClimat: ges.classe_emission_ges,
    etiquetteFinale: finale(ep.classe_bilan_dpe),
    energiePrimaireM2: arrondi(ep.ep_conso_5_usages_m2),
    gesM2: arrondi(ges.emission_ges_5_usages_m2),
    energiePrimaire: Math.round(ep.ep_conso_5_usages),
    energieFinale: Math.round(ef.conso_5_usages),
    ges: Math.round(ges.emission_ges_5_usages),
    coutAnnuel: Math.round(cout.cout_5_usages ?? 0),
    variantes: {
      actuel: variante(1.9, ep.ep_conso_5_usages_m2, ep.ep_conso_5_usages, ep.classe_bilan_dpe),
      annee2027: variante(1.7, ep.coeff_1_7_ep_conso_5_usages_m2, ep.coeff_1_7_ep_conso_5_usages, ep.coeff_1_7_classe_bilan_dpe),
      ancien: variante(2.3, ep.coeff_2_3_ep_conso_5_usages_m2, ep.coeff_2_3_ep_conso_5_usages, ep.coeff_2_3_classe_bilan_dpe)
    },
    postes: {
      chauffage: poste(ef.conso_ch, ep.ep_conso_ch, ges.emission_ges_ch, cout.cout_ch),
      ecs: poste(ef.conso_ecs, ep.ep_conso_ecs, ges.emission_ges_ecs, cout.cout_ecs),
      eclairage: poste(ef.conso_eclairage, ep.ep_conso_eclairage, ges.emission_ges_eclairage, cout.cout_eclairage),
      auxiliaires: poste(aux(ef, 'conso_'), aux(ep, 'ep_conso_'), aux(ges, 'emission_ges_'), aux(cout, 'cout_')),
      refroidissement: poste(ef.conso_fr, ep.ep_conso_fr, ges.emission_ges_fr, cout.cout_fr)
    },
    deperditions: {
      murs: arrondi(dep.deperdition_mur),
      planchersBas: arrondi(dep.deperdition_plancher_bas),
      planchersHauts: arrondi(dep.deperdition_plancher_haut),
      baies: arrondi(dep.deperdition_baie_vitree),
      portes: arrondi(dep.deperdition_porte),
      pontsThermiques: arrondi(dep.deperdition_pont_thermique),
      renouvellementAir: arrondi(dep.deperdition_renouvellement_air),
      total: arrondi(dep.deperdition_enveloppe)
    },
    besoins: { chauffage: Math.round(ab.besoin_ch), ecs: Math.round(ab.besoin_ecs) },
    deduit: construit.deduit,
    avertissements: construit.avertissements
  };
}
