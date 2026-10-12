// Compare, par type de liaison, les longueurs de ponts thermiques réelles (DPE) et estimées (mapper).
import { readdirSync, readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { ademeVersMaison } from '../src/import/ademe.ts';
import { buildDpe } from '../src/mapper/buildDpe.ts';

const dossier = process.argv[2];
const p = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
const arr = (x: any) => (x === undefined || x === '' ? [] : Array.isArray(x) ? x : [x]);
const NOM: Record<string, string> = { '1': 'plancher bas', '2': 'plancher interm.', '3': 'plancher haut', '4': 'refend', '5': 'menuiserie' };

const lignes: any[] = [];
for (const f of readdirSync(dossier).filter((x) => x.endsWith('.xml'))) {
  const dpe = p.parse(readFileSync(`${dossier}/${f}`, 'utf8')).dpe;
  const imp = ademeVersMaison(dpe);
  if (!imp.maison) continue;
  const reel: Record<string, { l: number; kl: number; n: number }> = {};
  for (const pt of arr(dpe.logement.enveloppe.pont_thermique_collection?.pont_thermique)) {
    const de = pt.donnee_entree ?? {};
    const t = String(de.enum_type_liaison_id);
    const l = Number(de.l);
    const k = Number(pt.donnee_intermediaire?.k ?? 0);
    reel[t] ??= { l: 0, kl: 0, n: 0 };
    reel[t].l += l; reel[t].kl += l * k; reel[t].n += 1;
  }
  const est: Record<string, { l: number; n: number }> = {};
  const { dpe: construit } = buildDpe(imp.maison, { dateCalcul: imp.meta.dateEtablissement, versionSchema: imp.meta.versionSchema });
  for (const pt of construit.logement.enveloppe.pont_thermique_collection.pont_thermique) {
    const t = String(pt.donnee_entree.enum_type_liaison_id);
    est[t] ??= { l: 0, n: 0 };
    est[t].l += pt.donnee_entree.l; est[t].n += 1;
  }
  lignes.push({ f, niv: imp.maison.niveaux, surface: imp.maison.surfaceHabitable, reel, est, nbPtReel: arr(dpe.logement.enveloppe.pont_thermique_collection?.pont_thermique).length });
}

const med = (v: number[]) => { const a = v.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
console.log(`${lignes.length} maisons ; sans aucun pont thermique saisi : ${lignes.filter((l) => l.nbPtReel === 0).length}`);
console.log('\nliaison            réel>0   estimé>0   longueur réelle (médiane)   estimée (médiane)   ratio estimé/réel (médiane des maisons où les deux existent)');
for (const t of ['1', '2', '3', '4', '5']) {
  const r = lignes.filter((l) => l.reel[t]?.l > 0);
  const e = lignes.filter((l) => l.est[t]?.l > 0);
  const both = lignes.filter((l) => l.reel[t]?.l > 0 && l.est[t]?.l > 0);
  console.log(
    NOM[t].padEnd(18), String(r.length).padStart(6), String(e.length).padStart(10),
    med(r.map((l) => l.reel[t].l)).toFixed(1).padStart(20), med(e.map((l) => l.est[t].l)).toFixed(1).padStart(22),
    med(both.map((l) => l.est[t].l / l.reel[t].l)).toFixed(2).padStart(14), `(n=${both.length})`
  );
}
