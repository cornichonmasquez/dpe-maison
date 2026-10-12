// Écran « plan » : photo aérienne IGN, contour de la maison (repris d'un bâtiment détecté ou dessiné à la main),
// nature de chaque façade. Chargé à la demande (Leaflet est dans un fragment séparé).

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ATTRIBUTION, TUILES_ORTHO, batimentsAutour, chercherAdresse } from '../src/geo/ign.ts';
import type { Adresse, BatimentIgn } from '../src/geo/ign.ts';
import { nettoyer, resume, valide } from '../src/geo/geometrie.ts';
import type { Coord } from '../src/geo/geometrie.ts';
import type { AdjacenceMur } from '../src/model/house.ts';
import type { Opt } from './vocab.ts';

export interface EntreePlan {
  anneau?: Coord[];
  adjacences?: AdjacenceMur[];
  codePostal?: string;
  niveaux: number;
  hauteurSousPlafondM: number;
}

export interface SortiePlan {
  anneau: Coord[];
  adjacences: AdjacenceMur[];
  /** Indices tirés du bâtiment détecté, s'il a été utilisé. */
  indices: { etages?: number; hauteurM?: number; altitudeSolM?: number; codePostal?: string };
}

const NATURES: Opt[] = [
  ['exterieur', 'Façade sur l’extérieur'],
  ['garage', 'Donne sur un garage'],
  ['cellier', 'Donne sur un cellier ou une buanderie'],
  ['local_non_chauffe', 'Donne sur un autre local non chauffé'],
  ['logement_voisin', 'Mur mitoyen avec un logement chauffé']
];

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fr = (n: number, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const NOMS_CARDINAL: Record<string, string> = { nord: 'Nord', sud: 'Sud', est: 'Est', ouest: 'Ouest' };

export function ouvrirPlan(entree: EntreePlan, surValide: (s: SortiePlan) => void): void {
  let anneau: Coord[] = entree.anneau ? entree.anneau.slice() : [];
  let adjacences: AdjacenceMur[] = entree.adjacences ? entree.adjacences.slice() : [];
  let dessin = false; // mode « poser des points »
  let indices: SortiePlan['indices'] = {};
  let batiments: BatimentIgn[] = [];
  let adresseChoisie: Adresse | undefined;

  // --- Structure ------------------------------------------------------------------------------
  const racine = document.createElement('div');
  racine.className = 'plan';
  racine.setAttribute('role', 'dialog');
  racine.setAttribute('aria-modal', 'true');
  racine.setAttribute('aria-label', 'Dessiner la maison sur la photo aérienne');
  racine.innerHTML =
    `<div class="plan-tete"><strong>Dessiner la maison</strong><button type="button" class="lien" data-p="fermer">Fermer</button></div>` +
    `<p class="plan-info">La photo aérienne vient de l’IGN : l’adresse cherchée et la zone affichée sont envoyées à leurs serveurs. Rien d’autre n’est transmis.</p>` +
    `<form class="plan-recherche" data-p="form"><input type="search" placeholder="Adresse de la maison" aria-label="Adresse" autocomplete="street-address" data-p="adresse">` +
    `<button class="bouton" type="submit">Chercher</button></form>` +
    `<ul class="plan-resultats" data-p="resultats" hidden></ul>` +
    `<div class="plan-carte" data-p="carte"></div>` +
    `<div class="plan-aide" data-p="aide"></div>` +
    `<div class="plan-actions"><button type="button" class="bouton secondaire" data-p="dessiner">Dessiner à la main</button>` +
    `<button type="button" class="bouton secondaire" data-p="effacer">Effacer</button></div>` +
    `<div class="plan-aretes" data-p="aretes"></div>` +
    `<p class="plan-erreur" data-p="erreur" hidden></p>` +
    `<div class="plan-pied"><button type="button" class="bouton large" data-p="valider" disabled>Utiliser ce plan</button></div>`;
  document.body.appendChild(racine);
  document.body.style.overflow = 'hidden';
  const q = <T extends HTMLElement>(nom: string) => racine.querySelector<T>(`[data-p="${nom}"]`)!;

  const fermer = () => {
    carte.remove();
    racine.remove();
    document.body.style.overflow = '';
  };

  // --- Carte ----------------------------------------------------------------------------------
  const carte = L.map(q('carte'), { zoomControl: false, maxZoom: 21, doubleClickZoom: false, attributionControl: true });
  L.control.zoom({ position: 'bottomright' }).addTo(carte);
  L.tileLayer(TUILES_ORTHO, { maxNativeZoom: 19, maxZoom: 21, attribution: ATTRIBUTION }).addTo(carte);
  carte.setView([46.6, 2.4], 6);

  const couchePlan = L.layerGroup().addTo(carte);
  const coucheBatiments = L.layerGroup().addTo(carte);
  const coucheDessin = L.layerGroup().addTo(carte);

  const styleBatiment: L.PathOptions = { color: '#ffffff', weight: 2, fillColor: '#2f3fe0', fillOpacity: 0.28 };

  function afficherAide(): void {
    const aide = q('aide');
    if (dessin) {
      aide.textContent = `Touchez la carte pour poser chaque coin de la maison (${anneau.length} point${anneau.length > 1 ? 's' : ''}). Au moins 3, puis « Terminer ».`;
    } else if (anneau.length >= 3) {
      aide.textContent = 'Déplacez les coins pour ajuster le contour. Touchez deux fois un coin pour le supprimer.';
    } else if (batiments.length) {
      aide.textContent = 'Touchez un bâtiment bleu pour reprendre son contour, ou dessinez à la main.';
    } else {
      aide.textContent = 'Cherchez l’adresse, puis touchez le bâtiment ou dessinez son contour.';
    }
    q('dessiner').textContent = dessin ? 'Terminer le contour' : anneau.length >= 3 ? 'Redessiner à la main' : 'Dessiner à la main';
  }

  // --- Rendu du contour --------------------------------------------------------------------------
  function dessinerPlan(): void {
    couchePlan.clearLayers();
    if (anneau.length < 3 || dessin) return;
    const latlngs = anneau.map((c) => L.latLng(c[1], c[0]));
    L.polygon(latlngs, { color: '#2f3fe0', weight: 3, fillColor: '#2f3fe0', fillOpacity: 0.18 }).addTo(couchePlan);
    const aretes = resume(anneau).aretes;
    aretes.forEach((a, i) => {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % latlngs.length];
      const milieu = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
      L.marker(milieu, {
        interactive: false,
        icon: L.divIcon({ className: 'plan-etiquette', html: `<span>${i + 1} · ${fr(a.longueurM)} m</span>`, iconSize: [0, 0] })
      }).addTo(couchePlan);
    });
    latlngs.forEach((ll, i) => {
      const m = L.marker(ll, {
        draggable: true,
        keyboard: false,
        icon: L.divIcon({ className: 'plan-sommet', html: '<span></span>', iconSize: [28, 28] })
      }).addTo(couchePlan);
      m.on('dragend', () => {
        const p = m.getLatLng();
        anneau[i] = [p.lng, p.lat];
        dessinerPlan();
        majAretes();
      });
      m.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        if (anneau.length <= 3) return;
        anneau.splice(i, 1);
        adjacences = anneau.map(() => 'exterieur');
        dessinerPlan();
        majAretes();
        afficherAide();
      });
    });
  }

  function dessinerEnCours(): void {
    coucheDessin.clearLayers();
    if (!dessin) return;
    const latlngs = anneau.map((c) => L.latLng(c[1], c[0]));
    if (latlngs.length > 1) L.polyline(latlngs, { color: '#2f3fe0', weight: 3, dashArray: '6 6' }).addTo(coucheDessin);
    latlngs.forEach((ll) => L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#2f3fe0', fillOpacity: 1 }).addTo(coucheDessin));
  }

  function majAretes(): void {
    const zone = q('aretes');
    const err = q('erreur');
    const bouton = q<HTMLButtonElement>('valider');
    if (anneau.length < 3 || dessin) {
      zone.innerHTML = '';
      err.hidden = true;
      bouton.disabled = true;
      return;
    }
    const v = valide(anneau);
    err.hidden = v.ok;
    err.textContent = v.raison ?? '';
    bouton.disabled = !v.ok;
    if (!v.ok) {
      zone.innerHTML = '';
      return;
    }
    if (adjacences.length !== anneau.length) adjacences = anneau.map(() => 'exterieur');
    const r = resume(anneau);
    const hauteur = entree.niveaux * entree.hauteurSousPlafondM;
    zone.innerHTML =
      `<p class="plan-resume"><b>Empreinte ${fr(r.aireM2, 0)} m²</b> · périmètre ${fr(r.perimetreM, 0)} m · ${r.aretes.length} façades` +
      (indices.etages || indices.hauteurM
        ? ` · bâtiment détecté${indices.etages ? ` : ${indices.etages} étage${indices.etages > 1 ? 's' : ''}` : ''}${indices.hauteurM ? `, ${fr(indices.hauteurM, 1)} m de haut` : ''}`
        : '') +
      `</p>` +
      r.aretes
        .map(
          (a, i) =>
            `<label class="plan-arete"><span><b>${i + 1}</b> ${NOMS_CARDINAL[a.orientation]} · ${fr(a.longueurM)} m · ${fr(a.longueurM * hauteur, 0)} m²</span>` +
            `<select data-arete="${i}" aria-label="Nature de la façade ${i + 1}">` +
            NATURES.map(([v, l]) => `<option value="${v}"${v === adjacences[i] ? ' selected' : ''}>${esc(l)}</option>`).join('') +
            `</select></label>`
        )
        .join('');
  }

  function adopter(nouveau: Coord[]): void {
    anneau = nettoyer(nouveau);
    adjacences = anneau.map(() => 'exterieur');
    dessin = false;
    coucheBatiments.clearLayers();
    coucheDessin.clearLayers();
    const bornes = L.latLngBounds(anneau.map((c) => L.latLng(c[1], c[0])));
    carte.fitBounds(bornes, { padding: [40, 40], maxZoom: 20 });
    dessinerPlan();
    majAretes();
    afficherAide();
  }

  // --- Bâtiments détectés ----------------------------------------------------------------------
  let numeroRequete = 0;
  async function chargerBatiments(): Promise<void> {
    if (carte.getZoom() < 17 || anneau.length >= 3 || dessin) return;
    const n = ++numeroRequete;
    const c = carte.getCenter();
    try {
      const liste = await batimentsAutour(c.lng, c.lat, 70);
      if (n !== numeroRequete || anneau.length >= 3 || dessin) return;
      batiments = liste;
      coucheBatiments.clearLayers();
      for (const b of liste) {
        const poly = L.polygon(b.anneau.map((p) => L.latLng(p[1], p[0])), styleBatiment).addTo(coucheBatiments);
        poly.on('click', () => {
          indices = { etages: b.etages, hauteurM: b.hauteurM, altitudeSolM: b.altitudeSolM, codePostal: adresseChoisie?.codePostal };
          adopter(b.anneau);
        });
      }
      afficherAide();
    } catch (e: any) {
      q('aide').textContent = e?.message ?? 'Impossible de charger les bâtiments. Vous pouvez dessiner à la main.';
    }
  }
  let minuterie: number | undefined;
  carte.on('moveend', () => {
    window.clearTimeout(minuterie);
    minuterie = window.setTimeout(() => void chargerBatiments(), 450);
  });

  // --- Interactions ----------------------------------------------------------------------------
  carte.on('click', (e: L.LeafletMouseEvent) => {
    if (!dessin) return;
    anneau.push([e.latlng.lng, e.latlng.lat]);
    dessinerEnCours();
    afficherAide();
  });

  q('dessiner').addEventListener('click', () => {
    if (!dessin) {
      dessin = true;
      anneau = [];
      adjacences = [];
      indices = {};
      couchePlan.clearLayers();
      coucheBatiments.clearLayers();
      dessinerEnCours();
      majAretes();
    } else {
      dessin = false;
      coucheDessin.clearLayers();
      if (anneau.length >= 3) adopter(anneau);
      else {
        anneau = [];
        void chargerBatiments();
      }
    }
    afficherAide();
  });

  q('effacer').addEventListener('click', () => {
    anneau = [];
    adjacences = [];
    indices = {};
    dessin = false;
    couchePlan.clearLayers();
    coucheDessin.clearLayers();
    majAretes();
    afficherAide();
    void chargerBatiments();
  });

  racine.addEventListener('change', (e) => {
    const s = e.target as HTMLSelectElement;
    if (s.dataset.arete !== undefined) adjacences[Number(s.dataset.arete)] = s.value as AdjacenceMur;
  });

  q('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const champ = q<HTMLInputElement>('adresse');
    const liste = q('resultats');
    liste.hidden = false;
    liste.innerHTML = '<li class="plan-attente">Recherche…</li>';
    try {
      const trouvees = await chercherAdresse(champ.value);
      liste.innerHTML = trouvees.length
        ? trouvees.map((a, i) => `<li><button type="button" data-i="${i}">${esc(a.libelle)}</button></li>`).join('')
        : '<li class="plan-attente">Aucune adresse trouvée.</li>';
      liste.onclick = (ev) => {
        const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-i]');
        if (!b) return;
        const a = trouvees[Number(b.dataset.i)];
        adresseChoisie = a;
        liste.hidden = true;
        carte.setView([a.lat, a.lon], 20);
      };
    } catch (err: any) {
      liste.innerHTML = `<li class="plan-attente">${esc(err?.message ?? 'Recherche impossible.')}</li>`;
    }
  });

  q('fermer').addEventListener('click', fermer);
  q('valider').addEventListener('click', () => {
    if (anneau.length < 3 || !valide(anneau).ok) return;
    surValide({ anneau: anneau.slice(), adjacences: adjacences.slice(), indices });
    fermer();
  });
  document.addEventListener(
    'keydown',
    function surEchap(e) {
      if (e.key === 'Escape' && document.body.contains(racine)) fermer();
      if (!document.body.contains(racine)) document.removeEventListener('keydown', surEchap);
    }
  );

  // --- Démarrage -------------------------------------------------------------------------------
  if (anneau.length >= 3) {
    dessinerPlan();
    const b = L.latLngBounds(anneau.map((c) => L.latLng(c[1], c[0])));
    carte.fitBounds(b, { padding: [40, 40], maxZoom: 20 });
    majAretes();
  } else if (entree.codePostal) {
    q<HTMLInputElement>('adresse').value = entree.codePostal;
  }
  afficherAide();
  setTimeout(() => carte.invalidateSize(), 50);
}
