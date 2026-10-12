// Géométrie d'une empreinte de bâtiment : longueurs, orientations, aire, périmètre.
// Les coordonnées sont [longitude, latitude] en degrés. On travaille dans un plan local en mètres.

import type { Cardinal } from '../model/house.ts';

export type Coord = [lon: number, lat: number];
export interface Point {
  x: number; // mètres vers l'est
  y: number; // mètres vers le nord
}

const RAYON_TERRE = 6371008.8;
const RAD = Math.PI / 180;

export function versMetres(anneau: Coord[]): Point[] {
  const lat0 = anneau.reduce((a, c) => a + c[1], 0) / anneau.length;
  const lon0 = anneau.reduce((a, c) => a + c[0], 0) / anneau.length;
  const k = Math.cos(lat0 * RAD);
  return anneau.map(([lon, lat]) => ({
    x: (lon - lon0) * RAD * RAYON_TERRE * k,
    y: (lat - lat0) * RAD * RAYON_TERRE
  }));
}

/** Aire signée (m²) : positive si l'anneau tourne dans le sens trigonométrique. */
export function aireSignee(p: Point[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const aire = (p: Point[]) => Math.abs(aireSignee(p));

export function cardinalDepuisAzimut(azimutDeg: number): Cardinal {
  const a = ((azimutDeg % 360) + 360) % 360;
  if (a >= 315 || a < 45) return 'nord';
  if (a < 135) return 'est';
  if (a < 225) return 'sud';
  return 'ouest';
}

export interface Arete {
  index: number;
  longueurM: number;
  /** Azimut de la normale sortante, en degrés depuis le nord, dans le sens horaire. */
  azimutDeg: number;
  orientation: Cardinal;
}

/** Arêtes de l'anneau, avec la direction vers laquelle chaque façade regarde (côté extérieur). */
export function aretes(anneau: Coord[]): Arete[] {
  const p = versMetres(anneau);
  const antihoraire = aireSignee(p) > 0;
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // normale sortante : à droite de la direction si l'anneau est antihoraire, à gauche sinon
    const nx = antihoraire ? dy : -dy;
    const ny = antihoraire ? -dx : dx;
    const azimut = (Math.atan2(nx, ny) / RAD + 360) % 360;
    return { index: i, longueurM: Math.hypot(dx, dy), azimutDeg: azimut, orientation: cardinalDepuisAzimut(azimut) };
  });
}

/**
 * Nettoie un contour dessiné à la main ou issu d'une base cartographique :
 *  - retire le point de fermeture dupliqué ;
 *  - supprime les sommets quasi alignés (écart de cap inférieur au seuil) ;
 *  - supprime les redents de moins de minM mètre (pilastre, souche de cheminée) qui ne sont pas des façades.
 */
export function nettoyer(anneau: Coord[], seuilDeg = 8, minM = 1): Coord[] {
  const pts = anneau.slice();
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) pts.pop();
  }
  let change = true;
  while (change && pts.length > 3) {
    change = false;
    const m = versMetres(pts);
    for (let i = 0; i < pts.length && pts.length > 3; i++) {
      const prev = m[(i - 1 + m.length) % m.length];
      const cur = m[i];
      const next = m[(i + 1) % m.length];
      const dPrev = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      const dNext = Math.hypot(next.x - cur.x, next.y - cur.y);
      const cap1 = Math.atan2(cur.y - prev.y, cur.x - prev.x);
      const cap2 = Math.atan2(next.y - cur.y, next.x - cur.x);
      let ecart = Math.abs(cap2 - cap1) / RAD;
      if (ecart > 180) ecart = 360 - ecart;
      if (dPrev < minM || dNext < minM || ecart < seuilDeg) {
        pts.splice(i, 1);
        change = true;
        break;
      }
    }
  }
  return pts;
}

export interface ResumePlan {
  aireM2: number;
  perimetreM: number;
  aretes: Arete[];
}

export function resume(anneau: Coord[]): ResumePlan {
  const p = versMetres(anneau);
  const ar = aretes(anneau);
  return { aireM2: aire(p), perimetreM: ar.reduce((a, e) => a + e.longueurM, 0), aretes: ar };
}

/** Un contour est exploitable : au moins 3 sommets, une aire plausible pour un bâtiment, pas d'auto-intersection. */
export function valide(anneau: Coord[]): { ok: boolean; raison?: string } {
  if (anneau.length < 3) return { ok: false, raison: 'Il faut au moins 3 sommets.' };
  const p = versMetres(anneau);
  const a = aire(p);
  if (a < 6) return { ok: false, raison: 'Surface trop petite (moins de 6 m²).' };
  if (a > 5000) return { ok: false, raison: 'Surface trop grande (plus de 5 000 m²).' };
  const n = p.length;
  const o = (u: Point, v: Point, w: Point) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
  const croise = (a1: Point, a2: Point, b1: Point, b2: Point) =>
    o(a1, a2, b1) * o(a1, a2, b2) < 0 && o(b1, b2, a1) * o(b1, b2, a2) < 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (croise(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) {
        return { ok: false, raison: 'Le contour se croise : déplacez un sommet.' };
      }
    }
  }
  return { ok: true };
}

/** Hauteur de façade (m) : niveaux × hauteur sous plafond + épaisseur de plancher entre niveaux. */
export const hauteurFacade = (niveaux: number, hsp: number) => niveaux * hsp + 0.3 * Math.max(0, niveaux - 1);
