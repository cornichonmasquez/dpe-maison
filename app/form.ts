// Étapes du formulaire : chaque fonction renvoie le HTML d'une étape à partir de la maison.
// Les champs portent `data-path` (chemin dans `Maison`) et `data-type` ; main.ts gère les changements.

import type { Maison, Isolation } from '../src/model/house.ts';
import { ZONE_PAR_DEPARTEMENT } from '../src/data/departements.ts';
import { departementDepuisCodePostal } from '../src/mapper/buildDpe.ts';
import { aire, versMetres } from '../src/geo/geometrie.ts';
import * as V from './vocab.ts';
import type { Opt } from './vocab.ts';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

interface OptsChamp {
  hint?: string;
  rerender?: boolean;
  unite?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

function enveloppe(label: string, controle: string, hint?: string, unite?: string): string {
  return (
    `<label class="champ"><span class="etiquette">${label}</span>` +
    (unite ? `<span class="avec-unite">${controle}<span class="unite">${unite}</span></span>` : controle) +
    (hint !== undefined ? `<span class="aide">${hint}</span>` : '') +
    `</label>`
  );
}

export function selection(path: string, label: string, opts: Opt[], valeur: string | undefined, o: OptsChamp = {}): string {
  const options = opts
    .map(([v, l]) => `<option value="${esc(v)}"${v === (valeur ?? '') ? ' selected' : ''}>${esc(l)}</option>`)
    .join('');
  return enveloppe(
    label,
    `<select data-path="${path}" data-type="str"${o.rerender ? ' data-rerender' : ''}>${options}</select>`,
    o.hint
  );
}

export function nombre(path: string, label: string, valeur: number | undefined, o: OptsChamp = {}, facultatif = false): string {
  const attrs =
    `inputmode="decimal" data-path="${path}" data-type="${facultatif ? 'numopt' : 'num'}"` +
    (o.rerender ? ' data-rerender' : '') +
    (o.min !== undefined ? ` min="${o.min}"` : '') +
    (o.max !== undefined ? ` max="${o.max}"` : '') +
    ` step="${o.step ?? 'any'}"` +
    (o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : '');
  return enveloppe(label, `<input type="number" ${attrs} value="${valeur ?? ''}">`, o.hint, o.unite);
}

export function texte(path: string, label: string, valeur: string | undefined, o: OptsChamp = {}): string {
  return enveloppe(
    label,
    `<input type="text" inputmode="numeric" maxlength="5" autocomplete="postal-code" data-path="${path}" data-type="str"` +
      `${o.rerender ? ' data-rerender' : ''} value="${esc(valeur)}" placeholder="${esc(o.placeholder ?? '')}">`,
    o.hint
  );
}

/** Oui / Non / Je ne sais pas. */
export function ouiNon(path: string, label: string, valeur: boolean | undefined, o: OptsChamp = {}): string {
  const v = valeur === undefined ? '' : valeur ? 'oui' : 'non';
  const opts: Opt[] = [['', 'Je ne sais pas'], ['oui', 'Oui'], ['non', 'Non']];
  return enveloppe(
    label,
    `<select data-path="${path}" data-type="bool"${o.rerender ? ' data-rerender' : ''}>${opts
      .map(([x, l]) => `<option value="${x}"${x === v ? ' selected' : ''}>${l}</option>`)
      .join('')}</select>`,
    o.hint
  );
}

function carte(titre: string, corps: string, supprimable?: { type: string; index: number }): string {
  return (
    `<section class="carte-saisie"><header class="carte-tete"><h3>${esc(titre)}</h3>` +
    (supprimable
      ? `<button type="button" class="lien danger" data-action="supprimer" data-liste="${supprimable.type}" data-index="${supprimable.index}">Supprimer</button>`
      : '') +
    `</header>${corps}</section>`
  );
}

function bouton(action: string, libelle: string, liste?: string): string {
  return `<button type="button" class="bouton secondaire" data-action="${action}"${liste ? ` data-liste="${liste}"` : ''}>${libelle}</button>`;
}

// --- Isolation ---------------------------------------------------------------------------------

function connaissance(iso: Isolation): string {
  if (iso.resistance !== undefined) return 'resistance';
  if (iso.epaisseurCm !== undefined) return 'epaisseur';
  if (iso.annee !== undefined) return 'annee';
  return 'construction';
}

export function blocIsolation(prefixe: string, iso: Isolation): string {
  let h = selection(`${prefixe}.type`, 'Isolation', V.ISOLATION_TYPE, iso.type, { rerender: true });
  if (iso.type !== 'inconnue' && iso.type !== 'aucune') {
    const c = connaissance(iso);
    h += selection(`${prefixe}.__connaissance`, 'Ce que vous savez', V.ISOLATION_CONNAISSANCE, c, { rerender: true });
    if (c === 'annee') h += nombre(`${prefixe}.annee`, 'Année des travaux', iso.annee, { step: 1, min: 1900 });
    if (c === 'epaisseur') h += nombre(`${prefixe}.epaisseurCm`, 'Épaisseur d’isolant', iso.epaisseurCm, { unite: 'cm', min: 1 });
    if (c === 'resistance') h += nombre(`${prefixe}.resistance`, 'Résistance thermique R', iso.resistance, { unite: 'm².K/W', min: 0.1 });
  }
  return h;
}

// --- Étape 1 : la maison -----------------------------------------------------------------------

/** Indication affichée sous le code postal : département et zone climatique déduits. */
export function aideZone(m: Maison): string {
  // Pendant la frappe (1 à 4 chiffres), aucune indication : elle ne clignote qu'une fois le code complet.
  if (/^\d{0,4}$/.test(m.codePostal.trim())) return '';
  try {
    const dep = departementDepuisCodePostal(m.codePostal);
    const z = m.zoneClimatique ?? ZONE_PAR_DEPARTEMENT[dep];
    return z ? `Département ${dep}, zone climatique ${z}.` : 'Département hors métropole : non pris en charge.';
  } catch {
    return m.codePostal ? 'Code postal à 5 chiffres.' : '';
  }
}

export function etapeMaison(m: Maison): string {
  const zone = aideZone(m);
  return (
    `<h2>Votre maison</h2><p class="intro">Quelques repères. Tout peut être modifié ensuite, et chaque « je ne sais pas » reçoit la valeur par défaut de la méthode.</p>` +
    texte('codePostal', 'Code postal', m.codePostal, { placeholder: '37000', hint: zone }) +
    nombre('anneeConstruction', 'Année de construction', m.anneeConstruction, { step: 1, min: 1800, max: new Date().getFullYear() }) +
    nombre('surfaceHabitable', 'Surface habitable', m.surfaceHabitable, { unite: 'm²', min: 9, max: 1000 }) +
    selection('niveaux', 'Nombre de niveaux', ['1', '2', '3', '4'].map((x): Opt => [x, x]), String(m.niveaux)) +
    nombre('hauteurSousPlafondM', 'Hauteur sous plafond', m.hauteurSousPlafondM, { unite: 'm', step: 0.1, min: 1.8, max: 6 }) +
    nombre('altitudeM', 'Altitude', m.altitudeM, { unite: 'm', hint: 'Laissez vide si vous habitez à moins de 400 m.' }, true) +
    selection(
      'zoneClimatique',
      'Zone climatique',
      [['', 'Automatique (d’après le code postal)'], ...['H1a', 'H1b', 'H1c', 'H2a', 'H2b', 'H2c', 'H2d', 'H3'].map((z): Opt => [z, z])],
      m.zoneClimatique ?? '',
      { hint: 'À modifier seulement si votre DPE indique une autre zone.' }
    ) +
    `<div class="encart">Les murs, le sol, le toit et les fenêtres sont préremplis d’après ces dimensions. Corrigez-les aux étapes suivantes.` +
    ` ${bouton('regenerer', 'Régénérer les parois depuis ces dimensions')}</div>`
  );
}

// --- Étape 2 : murs ----------------------------------------------------------------------------

function apercuPlan(anneau: [number, number][]): string {
  const p = versMetres(anneau);
  const xs = p.map((q) => q.x);
  const ys = p.map((q) => q.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const L = 240;
  const H = 130;
  const k = Math.min((L - 20) / Math.max(x1 - x0, 1), (H - 20) / Math.max(y1 - y0, 1));
  const pts = p.map((q) => `${(10 + (q.x - x0) * k).toFixed(1)},${(H - 10 - (q.y - y0) * k).toFixed(1)}`).join(' ');
  return `<svg class="plan-apercu" viewBox="0 0 ${L} ${H}" role="img" aria-label="Contour de la maison, nord en haut"><polygon points="${pts}" /></svg>`;
}

function cartePlan(m: Maison, plan?: { anneau: [number, number][]; adjacences: string[] }): string {
  if (!plan) {
    return (
      `<section class="carte-saisie carte-plan"><header class="carte-tete"><h3>Plan de la maison</h3></header>` +
      `<p class="aide-plan">Dessinez le contour de la maison sur la photo aérienne : les longueurs et les orientations des façades sont calculées pour vous.</p>` +
      `<button type="button" class="bouton large" data-action="plan">Dessiner sur le plan</button>` +
      `<p class="aide-plan petit">La photo vient de l’IGN : l’adresse cherchée et la zone affichée sont envoyées à leurs serveurs. Facultatif : vous pouvez aussi décrire les murs à la main, plus bas.</p></section>`
    );
  }
  const a = aire(versMetres(plan.anneau as any));
  // Cohérence : surface habitable ≈ empreinte × niveaux × 0,9 (murs et cloisons déduits)
  const estimee = Math.round(a * m.niveaux * 0.9);
  const incoherent = Math.abs(m.surfaceHabitable - estimee) / estimee > 0.35;
  const alerte = incoherent
    ? `<p class="encart">L’empreinte de ${Math.round(a)} m² sur ${m.niveaux} niveau${m.niveaux > 1 ? 'x' : ''} correspond plutôt à environ <b>${estimee} m² habitables</b>, ` +
      `alors que vous avez saisi ${m.surfaceHabitable} m². La surface habitable sert de référence au calcul : corrigez-la si besoin.` +
      ` <button type="button" class="bouton secondaire" data-action="surface-plan" data-valeur="${estimee}">Utiliser ${estimee} m²</button></p>`
    : '';
  return (
    `<section class="carte-saisie carte-plan"><header class="carte-tete"><h3>Plan de la maison</h3>` +
    `<button type="button" class="lien" data-action="plan">Modifier le plan</button></header>` +
    apercuPlan(plan.anneau) +
    `<p class="aide-plan"><b>Empreinte ${Math.round(a)} m²</b> · ${plan.anneau.length} façades. Complétez ci-dessous les caractéristiques de chaque mur.</p>${alerte}</section>`
  );
}

export function etapeMurs(m: Maison, plan?: { anneau: [number, number][]; adjacences: string[] }): string {
  const lnc = new Set(['garage', 'cellier', 'sous_sol', 'local_non_chauffe', 'veranda']);
  const cartes = m.murs
    .map((mur, i) => {
      const p = `murs.${i}`;
      const epaisseurUtile = !['inconnu', 'pan_de_bois_remplissage', 'ossature_bois'].includes(mur.materiau);
      const corps =
        selection(`${p}.orientation`, 'Orientation de la façade', V.ORIENTATIONS, mur.orientation) +
        nombre(`${p}.surfaceBrute`, 'Surface brute', mur.surfaceBrute, { unite: 'm²', min: 0.5, hint: 'Longueur × hauteur, fenêtres et portes comprises.' }) +
        selection(`${p}.adjacence`, 'Ce que le mur sépare', V.ADJACENCE_MUR, mur.adjacence, { rerender: true }) +
        (lnc.has(mur.adjacence)
          ? nombre(`${p}.lnc.aiu`, 'Surface de paroi côté logement (facultatif)', mur.lnc?.aiu, { unite: 'm²' }, true) +
            nombre(`${p}.lnc.aue`, 'Surface de paroi du local côté extérieur (facultatif)', mur.lnc?.aue, { unite: 'm²' }, true)
          : '') +
        selection(`${p}.materiau`, 'Matériau du mur', V.MATERIAU_MUR, mur.materiau, { rerender: true }) +
        (epaisseurUtile ? nombre(`${p}.epaisseurCm`, 'Épaisseur du mur (sans isolant)', mur.epaisseurCm, { unite: 'cm', min: 5 }, true) : '') +
        blocIsolation(`${p}.isolation`, mur.isolation) +
        selection(`${p}.doublage`, 'Doublage intérieur', V.DOUBLAGE, mur.doublage ?? 'inconnu');
      const titre =
        `Mur ${i + 1}` +
        (mur.longueurM ? ` · ${V.libelle(V.ORIENTATIONS, mur.orientation)} · ${mur.longueurM.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} m` : '');
      return carte(titre, corps, m.murs.length > 1 ? { type: 'murs', index: i } : undefined);
    })
    .join('');
  return (
    `<h2>Murs</h2><p class="intro">Un mur par façade, ou davantage si elle est hétérogène (extension, garage…).</p>` +
    cartePlan(m, plan) +
    cartes +
    bouton('ajouter', 'Ajouter un mur', 'murs')
  );
}

// --- Étape 3 : sol et toit ---------------------------------------------------------------------

export function etapeSolToit(m: Maison): string {
  const bas = m.planchersBas
    .map((p, i) => {
      const k = `planchersBas.${i}`;
      const avecPerimetre = ['terre_plein', 'vide_sanitaire', 'sous_sol'].includes(p.adjacence);
      const corps =
        selection(`${k}.adjacence`, 'Sous la maison', V.ADJACENCE_PLANCHER, p.adjacence, { rerender: true }) +
        nombre(`${k}.surface`, 'Surface', p.surface, { unite: 'm²', min: 1 }) +
        (avecPerimetre
          ? nombre(`${k}.perimetre`, 'Périmètre en contact avec l’extérieur', p.perimetre, { unite: 'm', hint: 'Facultatif : estimé si vide.' }, true)
          : '') +
        selection(`${k}.type`, 'Type de plancher', V.TYPE_PLANCHER, p.type) +
        blocIsolation(`${k}.isolation`, p.isolation);
      return carte(`Plancher bas ${i + 1}`, corps, m.planchersBas.length > 1 ? { type: 'planchersBas', index: i } : undefined);
    })
    .join('');

  const haut = m.toitures
    .map((t, i) => {
      const k = `toitures.${i}`;
      const corps =
        selection(`${k}.kind`, 'Au-dessus de vous', V.TOITURE_KIND, t.kind, { rerender: true }) +
        nombre(`${k}.surface`, 'Surface', t.surface, { unite: 'm²', min: 1 }) +
        (t.kind !== 'rampants' ? selection(`${k}.structure`, 'Structure du plafond', V.TOITURE_STRUCTURE, t.structure) : '') +
        blocIsolation(`${k}.isolation`, t.isolation);
      return carte(`Toiture ${i + 1}`, corps, m.toitures.length > 1 ? { type: 'toitures', index: i } : undefined);
    })
    .join('');

  return (
    `<h2>Sol et toit</h2>` +
    bas +
    bouton('ajouter', 'Ajouter un plancher bas', 'planchersBas') +
    haut +
    bouton('ajouter', 'Ajouter une toiture', 'toitures')
  );
}

// --- Étape 4 : ouvertures ----------------------------------------------------------------------

export function etapeOuvertures(m: Maison): string {
  const fen = m.ouvertures
    .map((o, i) => {
      const k = `ouvertures.${i}`;
      const lame = o.vitrage === 'double' || o.vitrage === 'triple' || o.vitrage === 'inconnu';
      const corps =
        selection(`${k}.orientation`, 'Orientation', V.ORIENTATIONS, o.orientation) +
        selection(`${k}.kind`, 'Type', V.OUVERTURE_KIND, o.kind) +
        nombre(`${k}.surface`, 'Surface totale du groupe', o.surface, { unite: 'm²', min: 0.1, hint: 'Somme des ouvertures identiques sur cette façade.' }) +
        nombre(`${k}.nombre`, 'Nombre d’ouvertures', o.nombre, { step: 1, min: 1 }, true) +
        selection(`${k}.menuiserie`, 'Menuiserie', V.MENUISERIE, o.menuiserie) +
        selection(`${k}.vitrage`, 'Vitrage', V.VITRAGE, o.vitrage, { rerender: true }) +
        (lame
          ? selection(`${k}.gaz`, 'Gaz entre les vitres', V.GAZ, o.gaz ?? 'air') +
            nombre(`${k}.laMm`, 'Épaisseur de la lame', o.laMm, { unite: 'mm', hint: 'Facultatif : 12 mm si vide.' }, true) +
            ouiNon(`${k}.peuEmissif`, 'Vitrage à isolation renforcée (peu émissif)', o.peuEmissif)
          : '') +
        selection(`${k}.fermeture`, 'Volets', V.FERMETURE, o.fermeture) +
        ouiNon(`${k}.joints`, 'Joints d’étanchéité', o.joints, { hint: 'Influence les infiltrations d’air.' });
      return carte(`Ouvertures ${i + 1}`, corps, m.ouvertures.length > 1 ? { type: 'ouvertures', index: i } : undefined);
    })
    .join('');

  const portes = m.portes
    .map((p, i) => {
      const k = `portes.${i}`;
      const corps =
        selection(`${k}.kind`, 'Type de porte', V.PORTE_KIND, p.kind) +
        nombre(`${k}.surface`, 'Surface', p.surface, { unite: 'm²', min: 0.5 }) +
        selection(`${k}.orientation`, 'Façade', V.ORIENTATIONS, p.orientation ?? 'sud');
      return carte(`Porte ${i + 1}`, corps, { type: 'portes', index: i });
    })
    .join('');

  return (
    `<h2>Fenêtres et portes</h2><p class="intro">Regroupez les ouvertures identiques d’une même façade.</p>` +
    fen +
    bouton('ajouter', 'Ajouter des ouvertures', 'ouvertures') +
    `<h3 class="sous-titre">Portes extérieures</h3>` +
    portes +
    bouton('ajouter', 'Ajouter une porte', 'portes')
  );
}

// --- Étape 5 : chauffage, eau chaude, ventilation ----------------------------------------------

function blocEmetteurs(prefixe: string, e: any): string {
  return (
    selection(`${prefixe}.type`, 'Émetteurs', V.EMETTEUR_EAU, e.type, { rerender: true }) +
    selection(`${prefixe}.temperature`, 'Température de l’eau', V.TEMPERATURE, e.temperature === 'basse_ou_moyenne' ? 'moyenne' : e.temperature) +
    ouiNon(`${prefixe}.robinetsThermostatiques`, 'Robinets thermostatiques', e.robinetsThermostatiques) +
    selection(`${prefixe}.programmation`, 'Programmation', V.PROGRAMMATION, e.programmation) +
    nombre(`${prefixe}.annee`, 'Année d’installation des émetteurs', e.annee, { step: 1, min: 1900, hint: 'Facultatif.' }, true)
  );
}

export function etapeSystemes(m: Maison): string {
  const c: any = m.chauffage;
  let chauffage = selection('chauffage.kind', 'Chauffage principal', V.CHAUFFAGE_KIND, c.kind, { rerender: true });

  if (c.kind === 'chaudiere_gaz' || c.kind === 'chaudiere_fioul') {
    chauffage +=
      selection('chauffage.techno', 'Type de chaudière', V.TECHNO_CHAUDIERE, c.techno) +
      nombre('chauffage.annee', 'Année d’installation', c.annee, { step: 1, min: 1950 }) +
      blocEmetteurs('chauffage.emetteurs', c.emetteurs);
  } else if (c.kind === 'electrique_direct') {
    chauffage += selection('chauffage.emetteur', 'Type d’appareils', V.ELECTRIQUE_EMETTEUR, c.emetteur);
  } else {
    chauffage +=
      selection('chauffage.source', 'Type de pompe à chaleur', V.PAC_SOURCE, c.source, { rerender: true }) +
      nombre('chauffage.annee', 'Année d’installation', c.annee, { step: 1, min: 1990 });
    if (c.source !== 'air_air') chauffage += blocEmetteurs('chauffage.emetteurs', c.emetteurs ?? { type: 'radiateur_bitube', temperature: 'moyenne', programmation: 'centrale' });
  }

  const appoint =
    selection('appoint.kind', 'Appoint au bois', V.APPOINT, m.appoint?.kind ?? '', { rerender: true }) +
    (m.appoint
      ? nombre('appoint.annee', 'Année d’installation', m.appoint.annee, { step: 1, min: 1950 }) +
        ouiNon('appoint.flammeVerte', 'Label Flamme verte', m.appoint.flammeVerte)
      : '');

  const e: any = m.ecs;
  let ecs = selection('ecs.kind', 'Production d’eau chaude', V.ECS_KIND, e.kind, { rerender: true });
  if (e.kind === 'ballon_electrique') ecs += nombre('ecs.volumeL', 'Volume du ballon', e.volumeL, { unite: 'L', hint: 'Facultatif : 150 L si vide.' }, true);
  if (e.kind === 'chauffe_eau_thermodynamique') {
    ecs +=
      selection('ecs.source', 'Source de chaleur', V.CET_SOURCE, e.source ?? 'air_ambiant') +
      nombre('ecs.annee', 'Année d’installation', e.annee, { step: 1, min: 2000 }, true) +
      nombre('ecs.volumeL', 'Volume du ballon', e.volumeL, { unite: 'L' }, true);
  }
  if (e.kind === 'chauffe_eau_gaz_instantane' || e.kind === 'accumulateur_gaz') {
    ecs += nombre('ecs.annee', 'Année d’installation', e.annee, { step: 1, min: 1950 });
  }
  if (e.kind !== 'chauffe_eau_gaz_instantane') {
    ecs += ouiNon('ecs.dansVolumeChauffe', 'Production dans le volume chauffé', e.dansVolumeChauffe, {
      hint: 'Un ballon dans le garage ou la cave n’est pas dans le volume chauffé.'
    });
  }

  const v = m.ventilation;
  const ventilation =
    selection('ventilation.kind', 'Ventilation', V.VENTILATION, v.kind) +
    nombre('ventilation.installAnnee', 'Année d’installation', v.installAnnee, { step: 1, min: 1950, hint: 'Facultatif : année de construction si vide.' }, true);

  return (
    `<h2>Chauffage et ventilation</h2>` +
    carte('Chauffage', chauffage) +
    carte('Appoint', appoint) +
    carte('Eau chaude sanitaire', ecs) +
    carte('Ventilation', ventilation)
  );
}
