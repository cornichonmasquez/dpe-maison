// Balayage des facteurs de pondération des ponts thermiques sur les maisons de référence importables.
import { readdirSync, readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { ademeVersMaison } from '../src/import/ademe.ts';
import { calculer } from '../src/engine/calculate.ts';

const dossier = process.argv[2];
const parseur = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
const cas: { maison: any; meta: any; R: number; ges: number; finale: string }[] = [];
const LETTRES = 'ABCDEFG';
for (const f of readdirSync(dossier).filter((x) => x.endsWith('.xml'))) {
  const dpe = parseur.parse(readFileSync(`${dossier}/${f}`, 'utf8')).dpe;
  const imp = ademeVersMaison(dpe);
  if (!imp.maison) continue;
  const s = dpe.logement.sortie;
  const e = s.ep_conso.classe_bilan_dpe, c = s.emission_ges.classe_emission_ges;
  cas.push({ maison: imp.maison, meta: imp.meta, R: Number(s.ep_conso.ep_conso_5_usages_m2), ges: Number(s.emission_ges.emission_ges_5_usages_m2), finale: LETTRES.indexOf(e) >= LETTRES.indexOf(c) ? e : c });
}
const med = (v: number[]) => { const a = v.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
function evalue(facteurs: any) {
  const err: number[] = [], sgn: number[] = [];
  let memeFinale = 0;
  const s = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  for (const c of cas) {
    const r = calculer(c.maison, { dateCalcul: c.meta.dateEtablissement, versionSchema: c.meta.versionSchema, facteursPontsThermiques: facteurs });
    const m = r.variantes.ancien.energiePrimaireM2;
    err.push(Math.abs(m - c.R) / c.R); sgn.push((m - c.R) / c.R);
    if (r.variantes.ancien.etiquetteFinale === c.finale) memeFinale++;
  }
  Object.assign(console, s);
  return { n: cas.length, med: med(err), p5: err.filter((e) => e <= 0.05).length / cas.length, p10: err.filter((e) => e <= 0.1).length / cas.length, biais: med(sgn), finale: memeFinale / cas.length };
}
const g = (x: number, i: number, r: number, m: number, h = 1) => ({ planchierBas: x, intermediaire: i, refend: r, menuiserie: m, plancherHaut: h });
const grilles: [string, any][] = [
  ['méthode complète', g(1, 1, 1, 1)],
  ['tout × 0,8', g(0.8, 0.8, 0.8, 0.8, 0.8)],
  ['tout × 0,65', g(0.65, 0.65, 0.65, 0.65, 0.65)],
  ['tout × 0,5', g(0.5, 0.5, 0.5, 0.5, 0.5)],
  ['pb 0,8 / int 0,3 / refend 0,3 / men 0,8', g(0.8, 0.3, 0.3, 0.8)],
  ['pb 0,7 / int 0,3 / refend 0,3 / men 0,7', g(0.7, 0.3, 0.3, 0.7)],
  ['pb 0,6 / int 0,25 / refend 0,25 / men 0,6', g(0.6, 0.25, 0.25, 0.6)],
  ['pb 0,8 / int 0 / refend 0,4 / men 0,7', g(0.8, 0, 0.4, 0.7)],
  ['pb 0,7 / int 0,2 / refend 0,2 / men 0,6', g(0.7, 0.2, 0.2, 0.6)]
];
console.log(`${cas.length} maisons`);
console.log('configuration'.padEnd(46), 'médiane|err|  ≤5 %   ≤10 %   biais   même étiquette');
for (const [nom, f] of grilles) {
  const r = evalue(f);
  console.log(nom.padEnd(46), (r.med * 100).toFixed(1).padStart(8) + ' %', (r.p5 * 100).toFixed(0).padStart(5) + ' %', (r.p10 * 100).toFixed(0).padStart(5) + ' %', (r.biais * 100).toFixed(1).padStart(6) + ' %', (r.finale * 100).toFixed(0).padStart(8) + ' %');
}
