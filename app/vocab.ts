// Libellés français des choix du formulaire. Les valeurs sont celles du modèle `Maison`.

export type Opt = [valeur: string, libelle: string];

export const ORIENTATIONS: Opt[] = [
  ['sud', 'Sud'],
  ['nord', 'Nord'],
  ['est', 'Est'],
  ['ouest', 'Ouest']
];

export const ADJACENCE_MUR: Opt[] = [
  ['exterieur', 'Donne sur l’extérieur'],
  ['garage', 'Donne sur un garage'],
  ['cellier', 'Donne sur un cellier ou une buanderie'],
  ['sous_sol', 'Donne sur un sous-sol non chauffé'],
  ['local_non_chauffe', 'Donne sur un autre local non chauffé'],
  ['veranda', 'Donne sur une véranda (approximation)'],
  ['logement_voisin', 'Mitoyen avec un logement chauffé'],
  ['local_non_habitation', 'Mitoyen avec un local non résidentiel']
];

export const MATERIAU_MUR: Opt[] = [
  ['inconnu', 'Je ne sais pas'],
  ['parpaing_creux', 'Parpaing (bloc béton creux)'],
  ['parpaing_plein', 'Bloc béton plein'],
  ['brique_creuse', 'Brique creuse'],
  ['brique_alveolaire', 'Brique alvéolaire (monomur)'],
  ['brique_pleine', 'Brique pleine'],
  ['brique_pleine_double', 'Brique pleine double, avec lame d’air'],
  ['beton_banche', 'Béton banché'],
  ['beton_cellulaire', 'Béton cellulaire'],
  ['pierre_massive', 'Pierre ou moellons'],
  ['pierre_remplissage', 'Pierre avec remplissage'],
  ['pise', 'Pisé ou terre crue'],
  ['pan_de_bois_remplissage', 'Pan de bois (colombages) avec remplissage'],
  ['pan_de_bois_sans_remplissage', 'Pan de bois sans remplissage'],
  ['bois_rondin', 'Bois en rondins'],
  ['ossature_bois', 'Ossature bois'],
  ['sandwich_beton', 'Béton/isolant/béton (voile sandwich)']
];

export const ISOLATION_TYPE: Opt[] = [
  ['inconnue', 'Je ne sais pas'],
  ['aucune', 'Pas isolé'],
  ['iti', 'Isolé par l’intérieur'],
  ['ite', 'Isolé par l’extérieur'],
  ['itr', 'Isolation répartie (ex. brique monomur)'],
  ['oui_type_inconnu', 'Isolé, mais je ne sais pas comment']
];

export const ISOLATION_CONNAISSANCE: Opt[] = [
  ['construction', 'Isolé à la construction'],
  ['annee', 'Année des travaux d’isolation'],
  ['epaisseur', 'Épaisseur d’isolant'],
  ['resistance', 'Résistance thermique R (si justificatif)']
];

export const DOUBLAGE: Opt[] = [
  ['inconnu', 'Je ne sais pas'],
  ['aucun', 'Pas de doublage'],
  ['lame_air_inf_15mm', 'Doublage avec lame d’air de moins de 15 mm'],
  ['lame_air_sup_15mm', 'Doublage avec lame d’air de plus de 15 mm'],
  ['connu', 'Doublage plâtre, brique ou bois']
];

export const ADJACENCE_PLANCHER: Opt[] = [
  ['terre_plein', 'Sur terre-plein (dalle)'],
  ['vide_sanitaire', 'Sur vide sanitaire'],
  ['sous_sol', 'Sur sous-sol non chauffé'],
  ['garage', 'Au-dessus d’un garage'],
  ['cellier', 'Au-dessus d’un cellier'],
  ['local_non_chauffe', 'Au-dessus d’un autre local non chauffé'],
  ['exterieur', 'Sur l’extérieur (porche, pilotis)'],
  ['logement_dessous', 'Au-dessus d’un logement chauffé']
];

export const TYPE_PLANCHER: Opt[] = [
  ['inconnu', 'Je ne sais pas'],
  ['dalle_beton', 'Dalle béton'],
  ['entrevous_terre_cuite', 'Poutrelles et entrevous terre cuite (hourdis)'],
  ['entrevous_isolant', 'Poutrelles et entrevous isolants'],
  ['plancher_bois', 'Plancher bois'],
  ['voutains', 'Voûtains briques ou moellons']
];

export const TOITURE_KIND: Opt[] = [
  ['combles_perdus', 'Combles perdus (grenier non aménagé)'],
  ['rampants', 'Combles aménagés (sous les rampants)'],
  ['terrasse', 'Toit-terrasse ou toiture plate'],
  ['combles_peu_ventiles', 'Combles peu ventilés'],
  ['plafond_sous_logement_ou_local', 'Plafond sous un autre logement ou local']
];

export const TOITURE_STRUCTURE: Opt[] = [
  ['inconnu', 'Je ne sais pas'],
  ['bois', 'Plafond bois'],
  ['plafond_remplissage', 'Plafond avec ou sans remplissage'],
  ['plaque_platre', 'Plaques de plâtre'],
  ['beton', 'Dalle béton'],
  ['hourdis', 'Hourdis (poutrelles et entrevous)']
];

export const OUVERTURE_KIND: Opt[] = [
  ['fenetre_battante', 'Fenêtre battante (à ouvrants)'],
  ['fenetre_coulissante', 'Fenêtre coulissante'],
  ['porte_fenetre_battante', 'Porte-fenêtre battante'],
  ['porte_fenetre_battante_soubassement', 'Porte-fenêtre avec soubassement'],
  ['porte_fenetre_coulissante', 'Porte-fenêtre coulissante (baie vitrée)'],
  ['brique_de_verre', 'Brique de verre']
];

export const MENUISERIE: Opt[] = [
  ['inconnue', 'Je ne sais pas'],
  ['pvc', 'PVC'],
  ['bois', 'Bois'],
  ['alu_rupteur', 'Aluminium à rupture de pont thermique'],
  ['alu_sans_rupteur', 'Aluminium sans rupture de pont thermique'],
  ['bois_metal', 'Bois et métal']
];

export const VITRAGE: Opt[] = [
  ['inconnu', 'Je ne sais pas'],
  ['simple', 'Simple vitrage'],
  ['double', 'Double vitrage'],
  ['triple', 'Triple vitrage'],
  ['survitrage', 'Survitrage']
];

export const GAZ: Opt[] = [
  ['air', 'Air'],
  ['argon', 'Argon ou krypton'],
  ['inconnu', 'Je ne sais pas']
];

export const FERMETURE: Opt[] = [
  ['aucune', 'Pas de volet'],
  ['volet_roulant_pvc_bois', 'Volet roulant PVC ou bois'],
  ['volet_roulant_pvc_bois_epais', 'Volet roulant PVC ou bois épais (> 12 mm)'],
  ['volet_roulant_alu', 'Volet roulant aluminium'],
  ['volet_battant_pvc_bois', 'Volets battants PVC ou bois'],
  ['volet_battant_pvc_bois_epais', 'Volets battants PVC ou bois épais (> 22 mm)'],
  ['persiennes_ajourees', 'Persiennes ou volets à lames ajourées'],
  ['volet_isole', 'Volet isolé sans ajours']
];

export const PORTE_KIND: Opt[] = [
  ['bois_pleine', 'Bois, pleine'],
  ['bois_vitree', 'Bois, avec vitrage'],
  ['pvc_pleine', 'PVC, pleine'],
  ['pvc_vitree', 'PVC, avec vitrage'],
  ['metal_pleine', 'Métal, pleine'],
  ['metal_vitree', 'Métal, avec vitrage'],
  ['isolee', 'Porte isolée (toute matière)'],
  ['autre', 'Autre']
];

export const VENTILATION: Opt[] = [
  ['ouverture_fenetres', 'Aucune : aération par les fenêtres'],
  ['entrees_air', 'Entrées d’air hautes et basses'],
  ['conduit_naturel', 'Ventilation naturelle par conduit'],
  ['vmc_sf_autoreglable', 'VMC simple flux autoréglable'],
  ['vmc_sf_hygro_a', 'VMC simple flux hygroréglable A'],
  ['vmc_sf_hygro_b', 'VMC simple flux hygroréglable B'],
  ['vmc_df_echangeur', 'VMC double flux avec échangeur'],
  ['vmc_df_sans_echangeur', 'VMC double flux sans échangeur']
];

export const CHAUFFAGE_KIND: Opt[] = [
  ['chaudiere_gaz', 'Chaudière gaz'],
  ['chaudiere_fioul', 'Chaudière fioul'],
  ['electrique_direct', 'Chauffage électrique (radiateurs, convecteurs…)'],
  ['pac', 'Pompe à chaleur']
];

export const TECHNO_CHAUDIERE: Opt[] = [
  ['condensation', 'À condensation'],
  ['basse_temperature', 'Basse température'],
  ['standard', 'Standard'],
  ['classique', 'Classique (ancienne)']
];

export const PAC_SOURCE: Opt[] = [
  ['air_eau', 'Air/eau (alimente des radiateurs ou un plancher)'],
  ['air_air', 'Air/air (climatisation réversible, split)'],
  ['eau_eau', 'Eau/eau'],
  ['geothermique', 'Géothermique']
];

export const ELECTRIQUE_EMETTEUR: Opt[] = [
  ['convecteur', 'Convecteurs'],
  ['panneau_rayonnant', 'Panneaux rayonnants'],
  ['radiateur', 'Radiateurs à inertie'],
  ['accumulation', 'Radiateurs à accumulation'],
  ['plancher_rayonnant', 'Plancher rayonnant électrique']
];

export const EMETTEUR_EAU: Opt[] = [
  ['radiateur_bitube', 'Radiateurs (réseau à deux tubes)'],
  ['radiateur_monotube', 'Radiateurs (réseau monotube, ancien)'],
  ['plancher_chauffant', 'Plancher chauffant']
];

export const TEMPERATURE: Opt[] = [
  ['haute', 'Haute (≥ 65 °C, radiateurs anciens)'],
  ['moyenne', 'Moyenne'],
  ['basse', 'Basse (plancher chauffant, radiateurs surdimensionnés)']
];

export const PROGRAMMATION: Opt[] = [
  ['aucune', 'Aucune'],
  ['centrale', 'Programmateur ou thermostat central'],
  ['par_piece', 'Programmation pièce par pièce']
];

export const APPOINT: Opt[] = [
  ['', 'Aucun'],
  ['poele_buches', 'Poêle ou insert à bûches'],
  ['poele_granules', 'Poêle à granulés']
];

export const ECS_KIND: Opt[] = [
  ['comme_le_chauffage', 'Le même appareil que le chauffage'],
  ['ballon_electrique', 'Ballon électrique'],
  ['chauffe_eau_thermodynamique', 'Chauffe-eau thermodynamique'],
  ['chauffe_eau_gaz_instantane', 'Chauffe-eau gaz instantané'],
  ['accumulateur_gaz', 'Chauffe-eau gaz à accumulation']
];

export const CET_SOURCE: Opt[] = [
  ['air_ambiant', 'Sur l’air du local (garage, cellier…)'],
  ['air_exterieur', 'Sur l’air extérieur'],
  ['air_extrait', 'Sur l’air extrait (VMC)']
];

export const libelle = (opts: Opt[], valeur: string | undefined): string =>
  opts.find((o) => o[0] === valeur)?.[1] ?? valeur ?? '';
