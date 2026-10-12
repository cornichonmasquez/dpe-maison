// Validation du mapper sur des DPE réels (maisons individuelles du dépôt Open3CL).
//
//  R = résultat du logiciel du diagnostiqueur (sortie du XML)
//  E = moteur Open3CL appliqué au DPE d'origine (mesure la qualité du moteur seul)
//  M = notre mapper : XML -> saisie `Maison` -> moteur (mesure ce que le formulaire peut atteindre)
//
// Usage : node scripts/validate-ref.ts <dossier des XML> [sortie.json]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { calcul_3cl_xml } from '@open3cl/engine';
import { ademeVersMaison } from '../src/import/ademe.ts';
import { calculer } from '../src/engine/calculate.ts';
import { departementDepuisCodePostal } from '../src/mapper/buildDpe.ts';
import { ZONE_PAR_DEPARTEMENT } from '../src/data/departements.ts';

const [dossier, sortieJson] = process.argv.slice(2);
if (!dossier) {
  console.error('Usage : node scripts/validate-ref.ts <dossier> [sortie.json]');
  process.exit(1);
}

const parseur = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
const LETTRES = 'ABCDEFG';
const pire = (a: string, b: string) => (LETTRES.indexOf(a) >= LETTRES.indexOf(b) ? a : b);
const num = (v: any) => (v === undefined || v === '' ? NaN : Number(v));

function silencieux<T>(f: () => T): T {
  const s = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try {
    return f();
  } finally {
    Object.assign(console, s);
  }
}

interface Ligne {
  fichier: string;
  statut: 'importee' | 'hors_perimetre' | 'erreur';
  raisons?: string[];
  approximations?: number;
  surface?: number;
  annee?: number;
  R?: { ep: number; ges: number; finale: string; energie: string; climat: string; dep: Record<string, number> };
  E?: { ep: number; ges: number; finale: string };
  M?: { ep: number; ges: number; finale: string; energie: string; climat: string; dep: Record<string, number> };
  zoneTable?: string;
  zoneXml?: string;
  erreur?: string;
}

const lignes: Ligne[] = [];
for (const f of readdirSync(dossier).filter((x) => x.endsWith('.xml')).sort()) {
  const xml = readFileSync(`${dossier}/${f}`, 'utf8');
  let dpe: any;
  try {
    dpe = parseur.parse(xml).dpe;
  } catch {
    continue;
  }
  if (dpe?.logement?.caracteristique_generale?.enum_methode_application_dpe_log_id !== '1') continue;

  const imp = ademeVersMaison(dpe);
  if (!imp.maison) {
    lignes.push({ fichier: f, statut: 'hors_perimetre', raisons: imp.horsPerimetre });
    continue;
  }

  const s = dpe.logement.sortie;
  const dep = (x: any) => ({
    murs: num(x.deperdition_mur), planchersBas: num(x.deperdition_plancher_bas), planchersHauts: num(x.deperdition_plancher_haut),
    baies: num(x.deperdition_baie_vitree), portes: num(x.deperdition_porte), ponts: num(x.deperdition_pont_thermique),
    air: num(x.deperdition_renouvellement_air), total: num(x.deperdition_enveloppe)
  });
  const R = {
    ep: num(s.ep_conso.ep_conso_5_usages_m2), ges: num(s.emission_ges.emission_ges_5_usages_m2),
    energie: s.ep_conso.classe_bilan_dpe, climat: s.emission_ges.classe_emission_ges,
    finale: pire(s.ep_conso.classe_bilan_dpe, s.emission_ges.classe_emission_ges), dep: dep(s.deperdition)
  };

  const ligne: Ligne = {
    fichier: f, statut: 'importee', approximations: imp.approximations.length, raisons: imp.approximations,
    surface: imp.maison.surfaceHabitable, annee: imp.maison.anneeConstruction, R
  };

  // E : moteur sur le DPE d'origine
  try {
    const e = silencieux(() => calcul_3cl_xml(xml))?.logement?.sortie;
    if (e) {
      ligne.E = {
        ep: e.ep_conso.coeff_2_3_ep_conso_5_usages_m2 ?? e.ep_conso.ep_conso_5_usages_m2,
        ges: e.emission_ges.emission_ges_5_usages_m2,
        finale: pire(e.ep_conso.coeff_2_3_classe_bilan_dpe ?? e.ep_conso.classe_bilan_dpe, e.emission_ges.classe_emission_ges)
      };
    }
  } catch {
    /* E reste vide */
  }

  // M : notre mapper
  try {
    const r = silencieux(() =>
      calculer(imp.maison!, { dateCalcul: imp.meta.dateEtablissement, versionSchema: imp.meta.versionSchema })
    );
    ligne.M = {
      ep: r.variantes.ancien.energiePrimaireM2,
      ges: r.gesM2,
      energie: r.variantes.ancien.etiquetteEnergie,
      climat: r.etiquetteClimat,
      finale: r.variantes.ancien.etiquetteFinale,
      dep: {
        murs: r.deperditions.murs, planchersBas: r.deperditions.planchersBas, planchersHauts: r.deperditions.planchersHauts,
        baies: r.deperditions.baies, portes: r.deperditions.portes, ponts: r.deperditions.pontsThermiques,
        air: r.deperditions.renouvellementAir, total: r.deperditions.total
      }
    };
    try {
      ligne.zoneTable = ZONE_PAR_DEPARTEMENT[departementDepuisCodePostal(imp.maison.codePostal)];
    } catch {
      /* code postal absent */
    }
    ligne.zoneXml = imp.maison.zoneClimatique;
  } catch (e: any) {
    ligne.statut = 'erreur';
    ligne.erreur = String(e.message).slice(0, 160);
  }
  lignes.push(ligne);
}

// --- Rapport -----------------------------------------------------------------------------------
const mediane = (v: number[]) => {
  const a = v.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : NaN;
};
const quantile = (v: number[], p: number) => {
  const a = v.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;
};
const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

const total = lignes.length;
const hors = lignes.filter((l) => l.statut === 'hors_perimetre');
const erreurs = lignes.filter((l) => l.statut === 'erreur');
const ok = lignes.filter((l) => l.statut === 'importee' && l.M);
console.log(`\nMaisons individuelles : ${total}`);
console.log(`  importées et calculées : ${ok.length}`);
console.log(`  hors périmètre v1      : ${hors.length}`);
console.log(`  erreurs de calcul      : ${erreurs.length}`);

const raisons: Record<string, number> = {};
for (const l of hors) for (const r of l.raisons!) {
  const cle = r.replace(/^(mur|baie|plancher bas|plancher haut) \d+/, '$1 N').replace(/^\d+ /, 'N ');
  raisons[cle] = (raisons[cle] ?? 0) + 1;
}
console.log('\nRaisons de mise hors périmètre :');
for (const [r, n] of Object.entries(raisons).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(n).padStart(3)}  ${r}`);
if (erreurs.length) {
  console.log('\nErreurs :');
  for (const l of erreurs.slice(0, 8)) console.log(`  ${l.fichier} : ${l.erreur}`);
}

function stats(titre: string, cle: 'E' | 'M') {
  const sous = ok.filter((l) => l[cle]);
  if (!sous.length) return;
  const errEp = sous.map((l) => Math.abs(l[cle]!.ep - l.R!.ep) / l.R!.ep);
  const errGes = sous.map((l) => Math.abs(l[cle]!.ges - l.R!.ges));
  const memeFinale = sous.filter((l) => l[cle]!.finale === l.R!.finale).length;
  console.log(`\n${titre} (${sous.length} maisons)`);
  console.log(`  énergie : ≤ 5 % : ${pct(errEp.filter((e) => e <= 0.05).length / sous.length)}   ≤ 10 % : ${pct(errEp.filter((e) => e <= 0.1).length / sous.length)}   médiane ${pct(mediane(errEp))}   p90 ${pct(quantile(errEp, 0.9))}`);
  console.log(`  GES     : ≤ 2 kg : ${pct(errGes.filter((e) => e <= 2).length / sous.length)}   médiane ${mediane(errGes).toFixed(1)} kg   p90 ${quantile(errGes, 0.9).toFixed(1)} kg`);
  console.log(`  même étiquette finale : ${memeFinale}/${sous.length} (${pct(memeFinale / sous.length)})`);
}
stats('E : moteur sur le DPE d\'origine', 'E');
stats('M : mapper (saisie traduite → moteur)', 'M');

// Biais : le mapper sous- ou sur-estime-t-il ?
const signes = ok.map((l) => (l.M!.ep - l.R!.ep) / l.R!.ep);
console.log(`\nBiais M vs R : médiane ${pct(mediane(signes))}  (négatif = sous-estime)`);

// Postes de déperdition
console.log('\nDéperditions, erreur relative médiane de M vs R (maisons où le poste existe) :');
for (const p of ['murs', 'planchersBas', 'planchersHauts', 'baies', 'portes', 'ponts', 'air', 'total']) {
  const e = ok.filter((l) => l.R!.dep[p] > 0.5).map((l) => (l.M!.dep[p] - l.R!.dep[p]) / l.R!.dep[p]);
  console.log(`  ${p.padEnd(16)} médiane ${pct(mediane(e)).padStart(8)}   |écart| médian ${pct(mediane(e.map(Math.abs))).padStart(7)}   p90 ${pct(quantile(e.map(Math.abs), 0.9)).padStart(7)}   (n=${e.length})`);
}

// Table des zones climatiques
const zones = ok.filter((l) => l.zoneTable && l.zoneXml);
const zoneOk = zones.filter((l) => l.zoneTable === l.zoneXml).length;
console.log(`\nZone climatique : table département = zone du DPE pour ${zoneOk}/${zones.length} maisons`);

console.log('\nLes 10 plus gros écarts d\'énergie (M vs R) :');
for (const l of [...ok].sort((a, b) => Math.abs(b.M!.ep / b.R!.ep - 1) - Math.abs(a.M!.ep / a.R!.ep - 1)).slice(0, 10)) {
  console.log(`  ${l.fichier}  R ${l.R!.ep} kWh ${l.R!.finale}  M ${l.M!.ep} ${l.M!.finale}  (${pct(l.M!.ep / l.R!.ep - 1)})  E ${l.E?.ep ?? '?'}  approx ${l.approximations}`);
}

if (sortieJson) writeFileSync(sortieJson, JSON.stringify(lignes, null, 1));
