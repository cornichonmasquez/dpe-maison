# Validation du mapper sur des DPE réels

Banc : les 130 maisons individuelles des DPE de référence du dépôt Open3CL
(`node scripts/telecharger-references.mjs <dossier>` puis `npm run valider-references -- <dossier>`).

Trois résultats sont comparés pour chaque maison :

- **R** : le résultat du logiciel du diagnostiqueur, lu dans le XML ;
- **E** : le moteur Open3CL appliqué au DPE d'origine (mesure le moteur seul) ;
- **M** : notre mapper, à partir d'une saisie reconstruite depuis le XML (mesure ce que le formulaire peut atteindre).

Le XML contient des ponts thermiques mesurés par le diagnostiqueur ; la saisie n'en a pas : le mapper les estime.

## Résultat (octobre 2026)

```

Maisons individuelles : 130
  importées et calculées : 47
  hors périmètre v1      : 83
  erreurs de calcul      : 0

Raisons de mise hors périmètre :
   32  N installations de chauffage (une seule est prise en charge)
   14  N installations d'eau chaude (une seule est prise en charge)
   12  baie N : adjacence 10 (véranda ou local non chauffé) non prise en charge
    7  mur N : adjacence 2 non prise en charge
    7  appoint électrique de salle de bain (non pris en charge)
    6  générateur de chauffage 129 non pris en charge
    4  générateur d'eau chaude 81 non pris en charge
    4  plancher bas N : adjacence 4 non prise en charge
    4  générateur d'eau chaude 111 non pris en charge
    4  N générateurs principaux (un seul est pris en charge)
    3  baie N : adjacence 9 (véranda ou local non chauffé) non prise en charge
    3  générateur de chauffage 138 non pris en charge
    2  générateur de chauffage 59 non pris en charge
    2  générateur de chauffage 20 non pris en charge
    2  générateur de chauffage 114 non pris en charge
    2  générateur de chauffage 47 non pris en charge
    2  baie N : adjacence 8 (véranda ou local non chauffé) non prise en charge
    2  baie N : adjacence 22 (véranda ou local non chauffé) non prise en charge
    2  générateur d'eau chaude 78 non pris en charge
    1  générateur d'eau chaude 35 non pris en charge
    1  générateur de chauffage 120 non pris en charge
    1  baie N : adjacence 12 (véranda ou local non chauffé) non prise en charge
    1  générateur de chauffage 134 non pris en charge
    1  générateur d'eau chaude 99 non pris en charge
    1  générateur d'eau chaude 39 non pris en charge
    1  aucun plancher bas importable
    1  générateur d'eau chaude 38 non pris en charge
    1  plancher haut N : adjacence 4 non prise en charge
    1  générateur de chauffage 74 non pris en charge
    1  générateur d'eau chaude 18 non pris en charge

E : moteur sur le DPE d'origine (47 maisons)
  énergie : ≤ 5 % : 89.4 %   ≤ 10 % : 97.9 %   médiane 0.2 %   p90 5.4 %
  GES     : ≤ 2 kg : 95.7 %   médiane 0.0 kg   p90 1.0 kg
  même étiquette finale : 47/47 (100.0 %)

M : mapper (saisie traduite → moteur) (47 maisons)
  énergie : ≤ 5 % : 48.9 %   ≤ 10 % : 70.2 %   médiane 5.5 %   p90 17.7 %
  GES     : ≤ 2 kg : 55.3 %   médiane 2.0 kg   p90 9.0 kg
  même étiquette finale : 38/47 (80.9 %)

Biais M vs R : médiane 2.4 %  (négatif = sous-estime)

Déperditions, erreur relative médiane de M vs R (maisons où le poste existe) :
  murs             médiane    0.0 %   |écart| médian   0.0 %   p90  14.3 %   (n=47)
  planchersBas     médiane    1.5 %   |écart| médian   1.6 %   p90  35.7 %   (n=46)
  planchersHauts   médiane    0.0 %   |écart| médian   0.1 %   p90  21.4 %   (n=47)
  baies            médiane   -0.0 %   |écart| médian   0.2 %   p90   6.8 %   (n=47)
  portes           médiane   -1.5 %   |écart| médian  10.1 %   p90  26.9 %   (n=46)
  ponts            médiane   45.4 %   |écart| médian  45.8 %   p90 209.2 %   (n=45)
  air              médiane    0.0 %   |écart| médian   0.1 %   p90  36.2 %   (n=47)
  total            médiane    3.2 %   |écart| médian   5.1 %   p90  13.5 %   (n=47)

Zone climatique : table département = zone du DPE pour 47/47 maisons

Les 10 plus gros écarts d'énergie (M vs R), maisons anonymisées :
  maison  1  R 491 kWh G  M 732 G  (49.1 %)  E 491  approx 4
  maison  2  R 326 kWh E  M 443 G  (35.9 %)  E 326  approx 2
  maison  3  R 295 kWh E  M 395 F  (33.9 %)  E 307  approx 0
  maison  4  R 262 kWh E  M 314 E  (19.8 %)  E 262  approx 0
  maison  5  R 283 kWh E  M 233 D  (-17.7 %)  E 266  approx 0
  maison  6  R 542 kWh G  M 634 G  (17.0 %)  E 577  approx 0
  maison  7  R 139 kWh C  M 116 C  (-16.5 %)  E 124  approx 3
  maison  8  R 316 kWh E  M 365 F  (15.5 %)  E 316  approx 0
  maison  9  R 91 kWh C  M 78 C  (-14.3 %)  E 91  approx 1
  maison 10  R 680 kWh G  M 777 G  (14.3 %)  E 717  approx 0
```

## Lecture

- Le moteur seul est fiable : 98 % des maisons à ±10 %, étiquette identique dans 100 % des cas.
- Le mapper, sur saisie reconstruite, atteint un écart médian d'environ 5 %, avec une dispersion : 70 % des maisons
  à ±10 %, étiquette finale identique pour environ 80 %. Près d'un seuil, une erreur de 5 % suffit à changer de lettre.
- Les murs, planchers bas, planchers hauts, baies et renouvellement d'air sont reproduits à 0 – 2 % (médiane).
- Les ponts thermiques sont surestimés de 45 % en médiane : les diagnostiqueurs saisissent moins de liaisons que
  la méthode complète (refends et planchers intermédiaires surtout). Les repondérer réduit l'écart moyen mais fait
  basculer des maisons au voisinage d'un seuil : la décision est documentée dans `calibrer-pt.ts`.
- La table département → zone climatique est exacte pour 47 maisons sur 47.

## Maisons non validées

83 maisons sur 130 sont hors du périmètre actuel (raisons ci-dessus) : plusieurs installations de chauffage ou d'eau
chaude, vérandas, propane, appoint électrique en salle de bain, parois enterrées. Elles ne sont ni validées ni
supportées par le formulaire de la v1.

## Défauts trouvés et corrigés grâce à ce banc

1. `paroi_ancienne = 1` (anciens schémas) ne signifie pas « enduit isolant » : murs en pierre surisolés à tort.
2. Le type de doublage n'est parfois que dans la description du mur.
3. Avant 1975, une isolation « de date inconnue » impose l'année d'isolation 1975-1977 ; le moteur, sans identifiant
   de table, retombait sur l'année de construction (U = 2,5 au lieu de 1,0).
4. Présence de joints d'étanchéité des ouvrants : absente du modèle, elle pilote le renouvellement d'air.
5. Structures de toiture trop grossières (plafond avec remplissage, toiture sur l'extérieur de type inconnu).
6. L'année de construction manque dans beaucoup d'anciens DPE : seule la période est donnée.
7. « Matériaux anciens » : case cochée par le diagnostiqueur, ou déduite (avant 1948 et murs majoritairement anciens).
