// Services publics de l'IGN (Géoplateforme) : adresse, photos aériennes, contours de bâtiments.
// Sans clé, utilisables depuis un navigateur. Ce module est le SEUL endroit où l'application contacte un serveur :
// il n'est appelé qu'à la demande de l'utilisateur, depuis l'écran « plan ».

import type { Coord } from './geometrie.ts';

const GEOCODEUR = 'https://data.geopf.fr/geocodage/search';
const WFS = 'https://data.geopf.fr/wfs/ows';

/** Gabarit de tuiles pour Leaflet : photographies aériennes (Licence Ouverte, © IGN). */
export const TUILES_ORTHO =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS' +
  '&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg';
export const ATTRIBUTION = 'Photographies aériennes © IGN';

export interface Adresse {
  libelle: string;
  lon: number;
  lat: number;
  codePostal?: string;
}

export interface BatimentIgn {
  id: string;
  anneau: Coord[];
  hauteurM?: number;
  etages?: number;
  altitudeSolM?: number;
  usage?: string;
  logements?: number;
}

async function jsonDepuis(url: string, delaiMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), delaiMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`Le service de l'IGN a répondu ${r.status}.`);
    return await r.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error("Le service de l'IGN ne répond pas. Réessayez.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function chercherAdresse(requete: string): Promise<Adresse[]> {
  const q = requete.trim();
  if (q.length < 3) return [];
  const j = await jsonDepuis(`${GEOCODEUR}?q=${encodeURIComponent(q)}&limit=5&index=address`);
  return (j.features ?? []).map((f: any) => ({
    libelle: f.properties?.label ?? q,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    codePostal: f.properties?.postcode
  }));
}

/** Contours de bâtiments (BD TOPO) dans un rectangle autour d'un point. */
export async function batimentsAutour(lon: number, lat: number, demiCoteM = 60): Promise<BatimentIgn[]> {
  const dLat = demiCoteM / 111195;
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
  const url =
    `${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment` +
    `&OUTPUTFORMAT=application/json&COUNT=60&SRSNAME=EPSG:4326&BBOX=${bbox},EPSG:4326`;
  const j = await jsonDepuis(url);
  const res: BatimentIgn[] = [];
  for (const f of j.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    // MultiPolygon ou Polygon : on retient l'anneau extérieur du premier polygone (les cours intérieures sont ignorées)
    const anneauBrut: number[][] | undefined = g.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0] : g.coordinates?.[0];
    if (!anneauBrut || anneauBrut.length < 4) continue;
    const p = f.properties ?? {};
    res.push({
      id: String(f.id ?? p.cleabs),
      anneau: anneauBrut.map((c) => [c[0], c[1]] as Coord),
      hauteurM: typeof p.hauteur === 'number' ? p.hauteur : undefined,
      etages: typeof p.nombre_d_etages === 'number' ? p.nombre_d_etages : undefined,
      altitudeSolM: typeof p.altitude_minimale_sol === 'number' ? p.altitude_minimale_sol : undefined,
      usage: p.usage_1 ?? undefined,
      logements: typeof p.nombre_de_logements === 'number' ? p.nombre_de_logements : undefined
    });
  }
  return res;
}
