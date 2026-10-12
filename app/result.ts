// Écran résultat : étiquettes, fourchette, chantiers simulables, détail. Le calcul est fait par le moteur.

import { calculer, type Resultat } from '../src/engine/calculate.ts';
import { ErreurSaisie } from '../src/mapper/buildDpe.ts';
import {
  CATALOGUE,
  LIBELLES_CATEGORIES,
  PAS_ENCORE_CALCULES,
  appliquerChantiers,
  basculer,
  type CategorieTravaux
} from '../src/travaux/catalogue.ts';
import type { Maison } from '../src/model/house.ts';

const LETTRES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SEUILS = { energie: [70, 110, 180, 250, 330, 420], climat: [6, 11, 30, 50, 70, 100] };
/** Précision annoncée : écart médian observé sur des DPE réels ≈ 5 %, 70 % des maisons à ±10 % (docs/validation-maisons.md). */
const MARGE = 0.1;

const fr = (n: number, d = 0) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const sombre = (l: string) => l === 'C' || l === 'D';
const classe = (v: number, seuils: number[]) => {
  for (let i = 0; i < seuils.length; i++) if (v < seuils[i]) return i;
  return 6;
};
const position = (v: number, seuils: number[]) => {
  const i = classe(v, seuils);
  const bas = i === 0 ? 0 : seuils[i - 1];
  const haut = i === 6 ? seuils[5] * 1.5 : seuils[i];
  return (i + Math.min(1, Math.max(0, (v - bas) / (haut - bas)))) / 7;
};

/** Étiquette finale d'après les deux valeurs (la moins bonne des deux classes). */
function lettreFinale(ep: number, ges: number): string {
  return LETTRES[Math.max(classe(Math.floor(ep), SEUILS.energie), classe(Math.floor(ges), SEUILS.climat))];
}

export interface Contexte {
  maison: Maison;
  actifs: Set<string>;
  surChangement: (actifs: Set<string>) => void;
  allerEtape: (n: number) => void;
}

const ETAPE_DES_CHAMPS: [RegExp, number][] = [
  [/^(codePostal|anneeConstruction|surfaceHabitable|niveaux|hauteurSousPlafondM|altitudeM)/, 0],
  [/^murs/, 1],
  [/^(planchersBas|toitures)/, 2],
  [/^(ouvertures|portes)/, 3],
  [/^(chauffage|appoint|ecs|ventilation)/, 4]
];

export function montrerResultat(racine: HTMLElement, ctx: Contexte): void {
  let base: Resultat;
  try {
    base = calculer(ctx.maison);
  } catch (e: any) {
    const champs: string[] = e instanceof ErreurSaisie ? e.champs : [];
    const etape = champs.map((c) => ETAPE_DES_CHAMPS.find(([re]) => re.test(c))?.[1]).find((x) => x !== undefined);
    racine.innerHTML =
      `<div class="resultat"><h2>Calcul impossible</h2><p>${esc(e.message)}</p>` +
      (etape !== undefined
        ? `<button class="bouton" data-aller="${etape}">Corriger cette étape</button>`
        : '') +
      `</div>`;
    racine.querySelector<HTMLElement>('[data-aller]')?.addEventListener('click', (ev) =>
      ctx.allerEtape(Number((ev.currentTarget as HTMLElement).dataset.aller))
    );
    return;
  }

  const applicables = CATALOGUE.filter((c) => c.applicable(ctx.maison));
  const seul = new Map<string, Resultat>();
  for (const c of applicables) {
    try {
      seul.set(c.id, calculer(appliquerChantiers(ctx.maison, new Set([c.id]))));
    } catch {
      /* chantier non calculable sur cette maison : ignoré */
    }
  }
  const disponibles = applicables.filter((c) => seul.has(c.id));

  // Squelette
  const parCategorie = new Map<CategorieTravaux, typeof disponibles>();
  for (const c of disponibles) {
    if (!parCategorie.has(c.categorie)) parCategorie.set(c.categorie, []);
    parCategorie.get(c.categorie)!.push(c);
  }
  let travaux = '';
  for (const [cat, liste] of parCategorie) {
    travaux += `<h3 class="categorie">${LIBELLES_CATEGORIES[cat]}</h3><ul class="chantiers">`;
    for (const c of liste) {
      const r = seul.get(c.id)!;
      const gain = base.energiePrimaireM2 - r.energiePrimaireM2;
      const vers =
        r.etiquetteFinale !== base.etiquetteFinale
          ? `<span class="vers${sombre(r.etiquetteFinale) ? ' sombre' : ''}" style="background:var(--l${r.etiquetteFinale})">${r.etiquetteFinale}</span>`
          : '';
      travaux +=
        `<li><button class="chantier" role="switch" aria-checked="false" data-id="${c.id}"><span class="interrupteur"></span>` +
        `<span><span class="nom">${esc(c.titre)}</span><br><span class="detail">${esc(c.detail)}</span></span>` +
        `<span class="effet${gain < 2 ? ' neutre' : ''}">${gain > 0 ? '−' + fr(gain) : gain < 0 ? '+' + fr(-gain) : '0'} kWh${vers}</span></button></li>`;
    }
    travaux += '</ul>';
  }

  const echelle = (id: string, titre: string, sous: string) =>
    `<section class="bloc"><h2>${titre}</h2><p class="sous">${sous}</p><div class="echelle" id="${id}"></div></section>`;

  racine.innerHTML =
    `<section class="resultat" aria-live="polite"><div class="lettres" id="lettres"></div><p class="verdict" id="verdict"></p>` +
    `<p class="plage" id="plage"></p></section>` +
    echelle('ech-energie', 'Énergie', 'kWh d’énergie primaire par m² et par an') +
    `<section class="bloc"><h2>Climat</h2><p class="sous">kg de CO₂ par m² et par an</p><div class="echelle" id="ech-climat"></div>` +
    `<p class="alerte" id="alerte" hidden></p></section>` +
    `<section class="bloc"><h2>Simuler des travaux</h2><p class="sous">Activez un ou plusieurs chantiers : tout est recalculé.</p>` +
    `<div id="chantiers">${travaux || '<p class="sous">Aucun chantier applicable à cette maison.</p>'}</div>` +
    `<div class="bientot">Pas encore calculés par l’outil :<ul>${PAS_ENCORE_CALCULES.map((t) => `<li>${t}</li>`).join('')}</ul></div></section>` +
    `<section class="bloc"><h2>Où part l’énergie</h2><p class="sous">kWh d’énergie primaire par an</p><ul class="postes" id="postes"></ul>` +
    `<div class="facture"><span>Facture estimée</span><span class="montant" id="facture"></span></div></section>` +
    `<section class="bloc"><h2>Selon le coefficient électricité</h2><p class="sous">La loi a changé ce coefficient en 2026 et le change encore en 2027.</p>` +
    `<table><thead><tr><th>Coefficient</th><th>kWh/m²/an</th><th>Étiquette</th></tr></thead><tbody id="coef"></tbody></table></section>` +
    `<section class="bloc"><h2>Hypothèses retenues</h2><p class="sous">Paramètres déduits et valeurs par défaut utilisés.</p><ul class="hypotheses" id="hypotheses"></ul></section>` +
    `<section class="bloc actions"><button class="bouton secondaire" data-action="exporter">Exporter la maison (JSON)</button>` +
    `<label class="bouton secondaire">Importer un fichier<input type="file" accept=".json,.xml" data-action="importer" hidden></label>` +
    `<button class="bouton secondaire" data-action="imprimer">Imprimer ou enregistrer en PDF</button></section>` +
    `<p class="note">Estimation indicative, non opposable : elle ne remplace pas un DPE réalisé par un diagnostiqueur certifié. ` +
    `Méthode 3CL-DPE 2021, moteur Open3CL. Les valeurs inconnues reçoivent la valeur par défaut de la méthode et les ponts thermiques sont estimés. ` +
    `Votre saisie n’est jamais envoyée : tout est calculé dans votre navigateur. Seul le plan sur photo aérienne, facultatif, interroge l’IGN.</p>`;

  // Échelles
  const construire = (id: string, seuils: number[], unite: string) => {
    const r = racine.querySelector<HTMLElement>('#' + id)!;
    let h = '<div class="repere avant" data-r="avant"><span class="bulle"></span></div><div class="segments">';
    LETTRES.forEach((l) => (h += `<div class="seg${sombre(l) ? ' sombre' : ''}" style="background:var(--l${l})">${l}</div>`));
    h += '</div><div class="seuils">';
    seuils.forEach((s, i) => (h += `<span style="left:${((i + 1) / 7) * 100}%">${s}</span>`));
    h += '</div><div class="repere apres" data-r="apres"><span class="bulle"></span></div><div class="reserve-bas"></div>';
    r.innerHTML = h;
    r.dataset.unite = unite;
  };
  construire('ech-energie', SEUILS.energie, 'kWh');
  construire('ech-climat', SEUILS.climat, 'kg');

  const placer = (id: string, seuils: number[], avant: number, apres: number, montre: boolean) => {
    const r = racine.querySelector<HTMLElement>('#' + id)!;
    const u = r.dataset.unite;
    const pos = (v: number) => position(v, seuils) * 100 + '%';
    const a = r.querySelector<HTMLElement>('[data-r="avant"]')!;
    const b = r.querySelector<HTMLElement>('[data-r="apres"]')!;
    a.style.left = pos(avant);
    a.firstElementChild!.textContent = `${fr(avant)} ${u}`;
    b.style.left = pos(apres);
    b.firstElementChild!.textContent = `${fr(apres)} ${u}`;
    b.classList.toggle('cache', !montre);
    r.classList.toggle('avec-apres', montre);
    b.style.top = r.querySelector<HTMLElement>('.segments')!.offsetTop + 40 + 3 + 18 + 8 + 'px';
    const ia = classe(avant, seuils);
    const ib = classe(apres, seuils);
    r.querySelectorAll('.seg').forEach((s, i) => s.classList.toggle('actif', i === ia || (montre && i === ib)));
  };

  const maj = () => {
    const change = ctx.actifs.size > 0;
    let s = base;
    if (change) {
      try {
        s = calculer(appliquerChantiers(ctx.maison, ctx.actifs));
      } catch {
        s = base;
      }
    }
    const q = (id: string) => racine.querySelector<HTMLElement>('#' + id)!;
    const lettre = (l: string, apres: boolean) =>
      `<div class="lettre${apres ? ' apres' : ''}${sombre(l) ? ' sombre' : ''}" style="background:var(--l${l})">${l}</div>`;
    q('lettres').innerHTML =
      `<div class="colonne"><div class="titre">Aujourd’hui</div>${lettre(base.etiquetteFinale, false)}` +
      `<div class="valeurs"><b>${fr(base.energiePrimaireM2)}</b> kWh · <b>${fr(base.gesM2)}</b> kg</div></div>` +
      (change
        ? `<div class="fleche" aria-hidden="true">→</div><div class="colonne"><div class="titre">Après travaux</div>${lettre(s.etiquetteFinale, true)}` +
          `<div class="valeurs"><b>${fr(s.energiePrimaireM2)}</b> kWh · <b>${fr(s.gesM2)}</b> kg</div></div>`
        : `<div class="colonne"><div class="titre">Après travaux</div><div class="lettre vide">Activez un chantier plus bas</div></div>`);

    const cible = change ? s : base;
    const pire =
      cible.etiquetteEnergie === cible.etiquetteClimat
        ? ''
        : `L’étiquette retient la moins bonne des deux : énergie ${cible.etiquetteEnergie}, climat ${cible.etiquetteClimat}.`;
    q('verdict').innerHTML = change
      ? `<strong>${base.etiquetteFinale} → ${s.etiquetteFinale}.</strong> ` +
        (s.energiePrimaireM2 < base.energiePrimaireM2
          ? `Vous économisez ${fr(base.energiePrimaireM2 - s.energiePrimaireM2)} kWh/m²/an` +
            (base.coutAnnuel > s.coutAnnuel ? ` et environ ${fr(base.coutAnnuel - s.coutAnnuel)} € par an. ` : '. ')
          : '') +
        pire
      : `Votre maison est en <strong>${base.etiquetteFinale}</strong>. ${pire}`;

    // Fourchette : ±10 % sur énergie et climat
    const bas = lettreFinale(cible.energiePrimaireM2 * (1 - MARGE), cible.gesM2 * (1 - MARGE));
    const haut = lettreFinale(cible.energiePrimaireM2 * (1 + MARGE), cible.gesM2 * (1 + MARGE));
    q('plage').innerHTML =
      bas === haut
        ? `Même avec une marge de ±${MARGE * 100} %, l’étiquette reste <strong>${bas}</strong>.`
        : `Estimation à ±${MARGE * 100} % : l’étiquette réelle peut être <strong>${bas}</strong> ou <strong>${haut}</strong>. ` +
          `Un diagnostiqueur qui mesure vos ponts thermiques et vos parois lèvera le doute.`;

    placer('ech-energie', SEUILS.energie, base.energiePrimaireM2, s.energiePrimaireM2, change);
    placer('ech-climat', SEUILS.climat, base.gesM2, s.gesM2, change);

    const alerte = q('alerte');
    const v = cible.gesM2;
    const i = classe(v, SEUILS.climat);
    let msg = '';
    if (i > 0 && cible.etiquetteClimat === cible.etiquetteFinale) {
      const seuil = SEUILS.climat[i - 1];
      const manque = v - seuil + 1;
      if (manque / seuil <= 0.1) {
        msg = `Il manque ${fr(manque)} kg/m²/an pour passer en ${LETTRES[i - 1]} : la classe ${LETTRES[i - 1]} commence sous ${seuil} kg.`;
      }
    }
    alerte.hidden = !msg;
    alerte.textContent = msg;

    racine.querySelectorAll<HTMLElement>('[data-id]').forEach((b) =>
      b.setAttribute('aria-checked', ctx.actifs.has(b.dataset.id!) ? 'true' : 'false')
    );

    const noms: Record<string, string> = { chauffage: 'Chauffage', ecs: 'Eau chaude', eclairage: 'Éclairage', auxiliaires: 'Ventilation et pompes' };
    const cles = Object.keys(noms) as (keyof Resultat['postes'])[];
    const max = Math.max(...cles.map((k) => base.postes[k].energiePrimaire), 1);
    q('postes').innerHTML = cles
      .map((k) => {
        const vb = base.postes[k].energiePrimaire;
        const vs = s.postes[k].energiePrimaire;
        return (
          `<li class="poste"><div class="ligne"><span>${noms[k]}</span><span>` +
          (change ? `${fr(vb)} → <b class="apres-texte">${fr(vs)}</b>` : fr(vb)) +
          `</span></div><div class="barre"><div class="avant-b" style="width:${(vb / max) * 100}%"></div>` +
          (change ? `<div class="apres-b" style="width:${(vs / max) * 100}%"></div>` : '') +
          `</div></li>`
        );
      })
      .join('');
    q('facture').innerHTML = change
      ? `${fr(base.coutAnnuel)} → <span class="apres-texte">${fr(s.coutAnnuel)} €</span>`
      : `${fr(base.coutAnnuel)} €`;

    const ligne = (n: string, x: Resultat['variantes']['actuel']) =>
      `<tr><td>${n}</td><td>${fr(x.energiePrimaireM2)}</td><td>${x.etiquetteEnergie}${x.etiquetteFinale !== x.etiquetteEnergie ? ` (final ${x.etiquetteFinale})` : ''}</td></tr>`;
    q('coef').innerHTML =
      ligne('2,3 (jusqu’en 2025)', cible.variantes.ancien) +
      ligne('1,9 (depuis janvier 2026)', cible.variantes.actuel) +
      ligne('1,7 (janvier 2027)', cible.variantes.annee2027);

    const d = base.deduit;
    q('hypotheses').innerHTML =
      `<li>Zone climatique <b>${d.zoneClimatique}</b>, département ${d.departement}, période de construction ${d.periodeConstruction}.</li>` +
      `<li>Inertie du bâtiment : <b>${d.inertie}</b> (déduite des murs et des planchers).</li>` +
      base.avertissements.map((a) => `<li>${esc(a)}</li>`).join('');
  };

  racine.querySelector('#chantiers')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
    if (!b) return;
    ctx.actifs = basculer(ctx.actifs, b.dataset.id!);
    ctx.surChangement(ctx.actifs);
    maj();
  });
  // Les chantiers enregistrés qui ne s'appliquent plus à cette maison sont retirés.
  const valides = new Set([...ctx.actifs].filter((id) => disponibles.some((c) => c.id === id)));
  if (valides.size !== ctx.actifs.size) {
    ctx.actifs = valides;
    ctx.surChangement(valides);
  }
  maj();
}
