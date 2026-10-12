// Application : accueil, formulaire en 5 étapes, résultat. Tout est calculé dans le navigateur.

import { XMLParser } from 'fast-xml-parser';
import { calculer } from '../src/engine/calculate.ts';
import { ademeVersMaison } from '../src/import/ademe.ts';
import { appliquerPlan } from '../src/geo/versMaison.ts';
import type { Maison } from '../src/model/house.ts';
import { maisonTemoin } from '../test/fixtures/maison-temoin-saisie.ts';
import * as F from './form.ts';
import { montrerResultat } from './result.ts';
import {
  charger,
  ecrire,
  effacer,
  genererParois,
  lire,
  maisonVierge,
  nouveauMur,
  nouveauPlancher,
  nouvelleOuverture,
  nouvellePorte,
  nouvelleToiture,
  sauver,
  type Etat
} from './state.ts';

const LETTRES_COULEUR = (l: string) => `var(--l${l})`;
const ETAPES = ['Maison', 'Murs', 'Sol et toit', 'Fenêtres', 'Systèmes', 'Résultat'];
const RENDUS: ((e: Etat) => string)[] = [
  (e) => F.etapeMaison(e.maison),
  (e) => F.etapeMurs(e.maison, e.plan),
  (e) => F.etapeSolToit(e.maison),
  (e) => F.etapeOuvertures(e.maison),
  (e) => F.etapeSystemes(e.maison)
];

const contenu = document.getElementById('contenu')!;
const nav = document.getElementById('nav')!;
const mini = document.getElementById('mini')!;
const meta = document.getElementById('meta')!;

let etat: Etat | null = charger();
let accueil = !etat;

// --- Utilitaires -------------------------------------------------------------------------------

function enregistrer(): void {
  if (etat) sauver(etat);
}

let minuterie: number | undefined;
function majPuce(): void {
  window.clearTimeout(minuterie);
  minuterie = window.setTimeout(() => {
    if (!etat) return;
    try {
      const r = calculer(etat.maison);
      mini.innerHTML = `<span class="puce-etiquette${['C', 'D'].includes(r.etiquetteFinale) ? ' sombre' : ''}" style="background:${LETTRES_COULEUR(r.etiquetteFinale)}">${r.etiquetteFinale}</span>`;
    } catch {
      mini.innerHTML = `<span class="puce-etiquette vide" title="Saisie incomplète">?</span>`;
    }
  }, 250);
}

function majEntete(): void {
  const m = etat?.maison;
  meta.textContent = m ? `${m.surfaceHabitable} m² · ${m.anneeConstruction}${m.codePostal ? ' · ' + m.codePostal : ''}` : '';
}

// --- Accueil -----------------------------------------------------------------------------------

function montrerAccueil(): void {
  nav.hidden = true;
  mini.innerHTML = '';
  meta.textContent = '';
  const reprise = charger();
  contenu.innerHTML =
    `<section class="accueil"><h1>Quelle étiquette pour votre maison, et que changent des travaux ?</h1>` +
    `<p>Décrivez votre maison en quelques minutes. L’outil calcule l’étiquette énergie et climat avec la méthode officielle du DPE, ` +
    `puis simule des travaux. Votre saisie reste sur votre téléphone ; seul le plan satellite, facultatif, interroge l’IGN.</p><div class="actions">` +
    (reprise ? `<button class="bouton large" data-action="reprendre">Reprendre ma saisie</button>` : '') +
    `<button class="bouton ${reprise ? 'secondaire' : ''} large" data-action="nouvelle">Décrire ma maison</button>` +
    `<button class="bouton secondaire large" data-action="exemple">Voir un exemple : maison de 1996</button>` +
    `<label class="bouton secondaire large">Importer un fichier (JSON ou DPE ADEME en XML)` +
    `<input type="file" accept=".json,.xml" data-action="importer" hidden></label></div>` +
    `<p class="note">Estimation indicative, non opposable. Elle ne remplace pas un DPE réalisé par un diagnostiqueur certifié.</p></section>`;
}

// --- Étapes ------------------------------------------------------------------------------------

function progression(): string {
  return (
    `<nav class="progression" aria-label="Étapes">` +
    ETAPES.map(
      (n, i) =>
        `<button type="button" data-etape="${i}" class="${i === etat!.etape ? 'courant' : i < etat!.etape ? 'fait' : ''}" ` +
        `aria-label="Étape ${i + 1} : ${n}"${i === etat!.etape ? ' aria-current="step"' : ''}>${i + 1}</button>`
    ).join('') +
    `</nav>`
  );
}

function afficher(): void {
  if (!etat) return;
  accueil = false;
  const dernier = ETAPES.length - 1;
  nav.hidden = false;
  (document.getElementById('precedent') as HTMLButtonElement).textContent = etat.etape === 0 ? 'Accueil' : 'Précédent';
  (document.getElementById('suivant') as HTMLButtonElement).hidden = etat.etape === dernier;
  document.querySelector<HTMLElement>('#nav .interieur')!.style.gridTemplateColumns = etat.etape === dernier ? '1fr' : '1fr 2fr';
  majEntete();
  majPuce();

  if (etat.etape === dernier) {
    contenu.innerHTML = progression() + '<div id="resultat"></div>';
    montrerResultat(document.getElementById('resultat')!, {
      maison: etat.maison,
      actifs: new Set(etat.chantiers),
      surChangement: (a) => {
        etat!.chantiers = [...a];
        enregistrer();
      },
      allerEtape: (n) => allerA(n)
    });
  } else {
    contenu.innerHTML = progression() + `<div class="formulaire">${RENDUS[etat.etape](etat)}</div>`;
  }
  window.scrollTo({ top: 0 });
}

function rendreEtape(): void {
  if (!etat || etat.etape >= RENDUS.length) return;
  const haut = window.scrollY;
  const actif = document.activeElement as HTMLElement | null;
  const chemin = actif?.dataset?.path;
  contenu.innerHTML = progression() + `<div class="formulaire">${RENDUS[etat.etape](etat)}</div>`;
  window.scrollTo({ top: haut });
  if (chemin) contenu.querySelector<HTMLElement>(`[data-path="${chemin}"]`)?.focus({ preventScroll: true });
}

function allerA(n: number): void {
  if (!etat) return;
  etat.etape = Math.max(0, Math.min(ETAPES.length - 1, n));
  enregistrer();
  afficher();
}

// --- Saisie ------------------------------------------------------------------------------------

function chauffageParDefaut(kind: string, ancien: any): any {
  const emetteurs = ancien?.emetteurs ?? {
    type: 'radiateur_bitube',
    robinetsThermostatiques: false,
    temperature: 'moyenne',
    programmation: 'aucune'
  };
  switch (kind) {
    case 'chaudiere_gaz':
    case 'chaudiere_fioul':
      return { kind, techno: ancien?.techno ?? 'standard', annee: ancien?.annee ?? 2005, emetteurs };
    case 'electrique_direct':
      return { kind, emetteur: ancien?.emetteur ?? 'convecteur' };
    default:
      return { kind: 'pac', source: ancien?.source ?? 'air_eau', annee: ancien?.kind === 'pac' ? ancien.annee : 2020, emetteurs };
  }
}

function ecsParDefaut(kind: string): any {
  switch (kind) {
    case 'ballon_electrique':
      return { kind };
    case 'chauffe_eau_thermodynamique':
      return { kind, source: 'air_ambiant' };
    case 'chauffe_eau_gaz_instantane':
    case 'accumulateur_gaz':
      return { kind, annee: 2005 };
    default:
      return { kind: 'comme_le_chauffage' };
  }
}

function surChamp(el: HTMLInputElement | HTMLSelectElement): void {
  if (!etat) return;
  const chemin = el.dataset.path!;
  const type = el.dataset.type;
  const m = etat.maison as any;
  let v: any = el.value;
  if (type === 'num') {
    if (v === '') return; // champ obligatoire en cours de frappe
    v = Number(v);
    if (!Number.isFinite(v)) return;
  } else if (type === 'numopt') {
    v = v === '' ? undefined : Number(v);
    if (v !== undefined && !Number.isFinite(v)) return;
  } else if (type === 'bool') {
    v = v === '' ? undefined : v === 'oui';
  }

  // Cas particuliers : objets dont la structure dépend du choix
  if (chemin === 'chauffage.kind') {
    m.chauffage = chauffageParDefaut(v, m.chauffage);
  } else if (chemin === 'chauffage.source' && v === 'air_air') {
    m.chauffage.source = v;
    delete m.chauffage.emetteurs;
  } else if (chemin === 'ecs.kind') {
    m.ecs = ecsParDefaut(v);
  } else if (chemin === 'appoint.kind') {
    if (v === '') delete m.appoint;
    else m.appoint = { kind: v, annee: m.appoint?.annee ?? 2015, flammeVerte: m.appoint?.flammeVerte ?? true };
  } else if (chemin === 'niveaux') {
    m.niveaux = Number(v);
  } else if (chemin.endsWith('.__connaissance')) {
    const base = chemin.slice(0, -'.__connaissance'.length);
    const iso = lire(m, base);
    delete iso.annee;
    delete iso.epaisseurCm;
    delete iso.resistance;
    if (v === 'annee') iso.annee = m.anneeConstruction;
    if (v === 'epaisseur') iso.epaisseurCm = 10;
    if (v === 'resistance') iso.resistance = 3;
  } else if (chemin.endsWith('.isolation.type')) {
    ecrire(m, chemin, v);
    const iso = lire(m, chemin.slice(0, -'.type'.length));
    if (v === 'inconnue' || v === 'aucune') {
      delete iso.annee;
      delete iso.epaisseurCm;
      delete iso.resistance;
    }
  } else if (chemin === 'zoneClimatique') {
    if (v === '') delete m.zoneClimatique;
    else m.zoneClimatique = v;
  } else {
    ecrire(m, chemin, v);
  }

  etat.paroisGenerees = false;
  enregistrer();
  majEntete();
  majPuce();
  // Les champs de saisie (texte, nombre) ne redessinent JAMAIS le formulaire : le champ serait remplacé en cours
  // de frappe et le curseur repartirait à gauche. Seuls les choix (listes) peuvent changer les champs affichés.
  if (el.hasAttribute('data-rerender') && el instanceof HTMLSelectElement) rendreEtape();
  if (chemin === 'codePostal') {
    const aide = el.closest('label')?.querySelector('.aide');
    if (aide) aide.textContent = F.aideZone(etat.maison);
  }
}

function action(nom: string, el: HTMLElement): void {
  if (!etat) return;
  const m = etat.maison as any;
  const liste = el.dataset.liste;
  switch (nom) {
    case 'ajouter': {
      const fabriques: Record<string, () => any> = {
        murs: () => nouveauMur(etat!.maison),
        planchersBas: nouveauPlancher,
        toitures: nouvelleToiture,
        ouvertures: nouvelleOuverture,
        portes: nouvellePorte
      };
      m[liste!].push(fabriques[liste!]());
      break;
    }
    case 'supprimer':
      m[liste!].splice(Number(el.dataset.index), 1);
      break;
    case 'surface-plan':
      m.surfaceHabitable = Number(el.dataset.valeur);
      break;
    case 'regenerer':
      if (window.confirm('Remplacer les murs, le sol, le toit et les fenêtres par des valeurs estimées ?')) {
        genererParois(etat.maison);
        delete etat.plan;
      }
      break;
  }
  enregistrer();
  rendreEtape();
  majPuce();
}

// --- Plan sur photo aérienne -------------------------------------------------------------------

async function ouvrirEcranPlan(): Promise<void> {
  if (!etat) return;
  const { ouvrirPlan } = await import('./plan.ts');
  const courant = etat;
  ouvrirPlan(
    {
      anneau: courant.plan?.anneau,
      adjacences: courant.plan?.adjacences,
      codePostal: courant.maison.codePostal,
      niveaux: courant.maison.niveaux,
      hauteurSousPlafondM: courant.maison.hauteurSousPlafondM
    },
    (res) => {
      const m = courant.maison;
      const ind = res.indices;
      if (ind.etages && courant.paroisGenerees && ind.etages >= 1 && ind.etages <= 4) m.niveaux = ind.etages;
      if (ind.altitudeSolM !== undefined && m.altitudeM === undefined) m.altitudeM = Math.round(ind.altitudeSolM);
      if (ind.codePostal && !m.codePostal) m.codePostal = ind.codePostal;
      appliquerPlan(m, { anneau: res.anneau, adjacences: res.adjacences }, { regenererOuvertures: courant.paroisGenerees });
      courant.plan = { anneau: res.anneau, adjacences: res.adjacences };
      enregistrer();
      rendreEtape();
      majPuce();
    }
  );
}

// --- Fichiers ----------------------------------------------------------------------------------

function exporter(): void {
  if (!etat) return;
  const blob = new Blob([JSON.stringify(etat.maison, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `maison-${etat.maison.anneeConstruction}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importer(fichier: File): Promise<void> {
  const texte = await fichier.text();
  let maison: Maison | undefined;
  const messages: string[] = [];
  try {
    if (fichier.name.toLowerCase().endsWith('.xml')) {
      const dpe = new XMLParser({ ignoreAttributes: true, parseTagValue: false }).parse(texte).dpe;
      const imp = ademeVersMaison(dpe);
      maison = imp.maison;
      messages.push(...imp.horsPerimetre);
      if (maison && imp.approximations.length) {
        messages.push(`${imp.approximations.length} donnée(s) importée(s) de façon approchée.`);
      }
    } else {
      const j = JSON.parse(texte);
      maison = j.maison ?? j;
      if (!maison?.murs) maison = undefined;
    }
  } catch {
    messages.push('Fichier illisible.');
  }
  if (!maison) {
    window.alert('Import impossible :\n' + (messages.length ? messages.join('\n') : 'format non reconnu.'));
    return;
  }
  etat = { maison, etape: 0, chantiers: [], paroisGenerees: false };
  enregistrer();
  afficher();
  if (messages.length) window.alert('Import réussi, avec réserves :\n' + messages.join('\n'));
}

// --- Événements --------------------------------------------------------------------------------

document.addEventListener('change', (e) => {
  const el = e.target as HTMLElement;
  if (el instanceof HTMLInputElement && el.dataset.action === 'importer' && el.files?.[0]) {
    void importer(el.files[0]);
    el.value = '';
    return;
  }
  if ((el instanceof HTMLSelectElement || el instanceof HTMLInputElement) && el.dataset.path) surChamp(el);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el instanceof HTMLInputElement && el.dataset.path && el.type !== 'file') surChamp(el);
});

document.addEventListener('click', (e) => {
  const cible = e.target as HTMLElement;
  const a = cible.closest<HTMLElement>('[data-action]');
  if (a && !(a instanceof HTMLInputElement)) {
    const nom = a.dataset.action!;
    switch (nom) {
      case 'nouvelle':
        etat = { maison: maisonVierge(), etape: 0, chantiers: [], paroisGenerees: true };
        enregistrer();
        afficher();
        return;
      case 'exemple':
        etat = { maison: structuredClone(maisonTemoin), etape: 5, chantiers: [], paroisGenerees: false };
        enregistrer();
        afficher();
        return;
      case 'reprendre':
        etat = charger();
        afficher();
        return;
      case 'plan':
        void ouvrirEcranPlan();
        return;
      case 'exporter':
        exporter();
        return;
      case 'imprimer':
        window.print();
        return;
      default:
        action(nom, a);
        return;
    }
  }
  const pas = cible.closest<HTMLElement>('[data-etape]');
  if (pas) allerA(Number(pas.dataset.etape));
});

document.getElementById('precedent')!.addEventListener('click', () => {
  if (!etat) return;
  if (etat.etape === 0) {
    accueil = true;
    montrerAccueil();
  } else allerA(etat.etape - 1);
});
document.getElementById('suivant')!.addEventListener('click', () => etat && allerA(etat.etape + 1));
document.querySelector('.marque')!.addEventListener('click', () => {
  accueil = true;
  montrerAccueil();
});

// --- Démarrage ---------------------------------------------------------------------------------

if (accueil || !etat) montrerAccueil();
else afficher();

// Utilisé par le bouton « Effacer » (voir console) : window.__effacer()
(window as any).__effacer = () => {
  effacer();
  etat = null;
  montrerAccueil();
};
