# DPE Maison

Estime l'étiquette DPE (énergie et climat) d'une **maison individuelle existante** avec la méthode légale
**3CL-DPE 2021**, puis simule l'effet de travaux. Tout est calculé dans le navigateur : la saisie n'est jamais envoyée.

**Plan sur photo aérienne (facultatif)** : on peut dessiner le contour de la maison sur la photo aérienne de l'IGN, ou
reprendre le contour d'un bâtiment de la BD TOPO. Les longueurs et orientations des façades, la surface au sol et le
périmètre en sont déduits. Ce mode interroge les services de l'IGN (géocodeur, tuiles, WFS) : l'adresse cherchée et la
zone affichée leur sont transmises, rien d'autre.

> Estimation indicative, **non opposable**. Elle ne remplace pas un DPE réalisé par un diagnostiqueur certifié.

## Utiliser

```bash
npm install
npm run dev        # http://localhost:4173
npm run build      # produit dist/ (site statique)
npm test           # tests du moteur, du mapper et du catalogue
npm run typecheck
```

## Architecture

| Dossier | Rôle |
|---|---|
| `src/model` | Modèle de saisie `Maison` : ce que décrit l'utilisateur, avec « je ne sais pas » partout |
| `src/mapper` | Saisie → entrée du moteur 3CL (JSON ADEME), paramètres déduits, ponts thermiques estimés |
| `src/engine` | Appel du moteur Open3CL et résultat lisible (étiquettes, postes, coefficients électricité) |
| `src/travaux` | Catalogue de chantiers simulables |
| `src/import` | Import d'un DPE ADEME (XML) vers la saisie |
| `src/geo` | Contour de la maison : géométrie, services IGN, application du plan à la saisie |
| `app` | Interface mobile : accueil, 5 étapes de saisie, résultat |
| `scripts` | Validation sur des DPE réels, calibrage, diagnostics |
| `docs` | Rapport de validation |

Le calcul s'appuie sur [Open3CL/engine](https://github.com/Open3CL/engine) (implémentation open source de 3CL-DPE).

## Précision

Validée sur 47 maisons de référence : écart médian d'environ 5 %, 70 % des maisons à ±10 %, étiquette finale identique
dans environ 80 % des cas. Près d'un seuil, une erreur de 5 % suffit à changer de lettre : l'outil affiche une fourchette.
Détails et limites dans [docs/validation-maisons.md](docs/validation-maisons.md).

## Hors périmètre

Appartements et immeubles, neuf (RE2020), plusieurs installations de chauffage ou d'eau chaude, véranda,
photovoltaïque, solaire thermique, plancher chauffant, poêle à bois en chauffage principal.

## Licence

GPL-3.0-or-later. Voir `LICENSE`.
