// Maison témoin (fictive) : maison individuelle de 1996, deux niveaux, chaudière gaz à condensation,
// garage attenant, combles, rampants et terrasse. Décrite « comme un diagnostiqueur » : surfaces par paroi,
// ouvertures, et 17 longueurs de ponts thermiques mesurées. Zone H2b.
//
// Sert de cas de référence pour le moteur : les résultats attendus (test/engine.test.mjs) sont figés.
// La même maison, saisie comme dans le formulaire, est dans maison-temoin-saisie.ts.

// --- Murs -------------------------------------------------------------------------------------
// surface_paroi_opaque = surface du mur hors baies et portes (= brut - ouvertures posées dessus)
const mur = (n, orientation, brut, ouvert, extra = {}) => ({
  donnee_entree: {
    reference: `mur_${n}`,
    description: `Mur ${n} en blocs de béton creux d'épaisseur ≤ 20 cm avec doublage rapporté avec isolation intérieure (ITI)`,
    enum_type_adjacence_id: 1,
    enum_orientation_id: orientation,
    surface_paroi_totale: brut,
    surface_paroi_opaque: Math.round((brut - ouvert) * 100) / 100,
    enum_materiaux_structure_mur_id: 12, // blocs de béton creux
    epaisseur_structure: 20,
    enum_methode_saisie_u0_id: 2,
    paroi_ancienne: 0,
    enum_type_doublage_id: 5, // doublage rapporté, lame d'air > 15 mm
    enum_type_isolation_id: 3, // ITI
    enum_periode_isolation_id: 6, // 1989-2000
    enum_methode_saisie_u_id: 7, // année d'isolation connue
    ...extra
  },
  donnee_intermediaire: {}
});

const murGarage = (n, orientation, brut, ouvert, extra = {}) =>
  mur(n, orientation, brut, ouvert, {
    description: `Mur ${n} donnant sur un garage, blocs de béton creux ≤ 20 cm avec isolation intérieure (ITI)`,
    enum_type_adjacence_id: 8, // garage
    surface_aiu: 20,
    surface_aue: 48,
    enum_cfg_isolation_lnc_id: 2, // locaux chauffé et non chauffé non isolés côté parois Aiu / Aue
    ...extra
  });

// --- Baies ------------------------------------------------------------------------------------
// Masque proche : « absence » = 19 ; masque lointain : ligne « < 15° » de l'orientation
// (orientations : 1 sud, 2 nord, 3 est, 4 ouest)
const FE2_ABSENCE = { 1: 5, 2: 1, 3: 9, 4: 9 };
const MENUISERIE = { pvc: 5, metal_rpt: 6 };

const baie = (n, orientation, surface, typeBaie, menuiserie, fermeture, masque = 'aucun') => ({
  donnee_entree: {
    reference: `baie_${n}`,
    description: `Baie ${n}`,
    enum_type_adjacence_id: 1,
    surface_totale_baie: surface,
    nb_baie: 1,
    enum_type_vitrage_id: 2, // double vitrage
    enum_inclinaison_vitrage_id: 3, // > 75°
    enum_type_gaz_lame_id: 1, // air
    epaisseur_lame: 12,
    vitrage_vir: 0,
    enum_methode_saisie_perf_vitrage_id: 1,
    enum_type_materiaux_menuiserie_id: MENUISERIE[menuiserie],
    enum_type_baie_id: typeBaie,
    double_fenetre: 0,
    enum_type_fermeture_id: fermeture,
    presence_retour_isolation: 0,
    largeur_dormant: 5,
    presence_joint: 1,
    enum_type_pose_id: 2, // nu intérieur
    enum_orientation_id: orientation,
    tv_coef_masque_proche_id: 19,
    ...(masque === 'aucun'
      ? { tv_coef_masque_lointain_homogene_id: FE2_ABSENCE[orientation] }
      : {
          // masque lointain non homogène, est/ouest : hauteurs 0-15°, 15-30°, 0-15°, 0-15°
          masque_lointain_non_homogene_collection: {
            masque_lointain_non_homogene: [
              { tv_coef_masque_lointain_non_homogene_id: 9 },
              { tv_coef_masque_lointain_non_homogene_id: 14 },
              { tv_coef_masque_lointain_non_homogene_id: 17 },
              { tv_coef_masque_lointain_non_homogene_id: 17 }
            ]
          }
        })
  },
  donnee_intermediaire: {}
});

// Types de fermeture : 1 aucune, 3 roulants alu, 4 roulants pvc/bois < 12 mm, 5 battants pvc/bois < 22 mm
const baies = [
  baie(1, 3, 2.4, 4, 'metal_rpt', 5), // fenêtre est, battante, volets battants
  baie(2, 2, 1.1, 5, 'metal_rpt', 1), // fenêtre nord, coulissante, sans protection
  baie(3, 4, 1.2, 4, 'pvc', 4, 'non_homogene'), // fenêtre ouest, roulants pvc
  baie(4, 4, 1.0, 4, 'pvc', 4, 'non_homogene'), // fenêtre ouest, roulants pvc
  baie(5, 4, 2.4, 4, 'metal_rpt', 5), // fenêtre ouest, volets battants
  baie(6, 3, 4.0, 6, 'metal_rpt', 3, 'non_homogene'), // porte-fenêtre est, coulissante, roulants alu
  baie(7, 3, 5.4, 6, 'metal_rpt', 3, 'non_homogene'), // porte-fenêtre est, coulissante, roulants alu
  baie(8, 2, 3.9, 6, 'metal_rpt', 3) // porte-fenêtre nord, coulissante, roulants alu
];

// --- Portes -----------------------------------------------------------------------------------
const portes = [
  {
    donnee_entree: {
      reference: 'porte_1',
      description: 'Porte opaque pleine isolée',
      enum_type_adjacence_id: 1,
      surface_porte: 1.9,
      presence_joint: 1,
      enum_methode_saisie_uporte_id: 1,
      enum_type_porte_id: 13,
      enum_type_pose_id: 2,
      largeur_dormant: 5
    },
    donnee_intermediaire: {}
  },
  {
    donnee_entree: {
      reference: 'porte_2',
      description: 'Porte simple en bois opaque pleine donnant sur le garage',
      enum_type_adjacence_id: 8,
      surface_aiu: 20,
      surface_aue: 48,
      enum_cfg_isolation_lnc_id: 2,
      surface_porte: 1.8,
      presence_joint: 0,
      enum_methode_saisie_uporte_id: 1,
      enum_type_porte_id: 1,
      enum_type_pose_id: 2,
      largeur_dormant: 5
    },
    donnee_intermediaire: {}
  }
];

// --- Ponts thermiques (17 longueurs mesurées) ---------------------------------------------------
// type de liaison : 1 plancher bas/mur, 2 plancher intermédiaire/mur, 4 refend/mur
const PT = [
  [1, 'Mur 1 Est / Plancher Int.', 2, 4.0],
  [1, 'Mur 1 Est / Refend', 4, 2.5],
  [1, 'Mur 1 Est / Plancher', 1, 6.2],
  [2, 'Mur 2 Nord / Plancher Int.', 2, 9.4],
  [2, 'Mur 2 Nord / Refend', 4, 3.5],
  [2, 'Mur 2 Nord / Plancher', 1, 10.3],
  [3, 'Mur 3 Ouest / Plancher Int.', 2, 4.6],
  [3, 'Mur 3 Ouest / Refend', 4, 3.5],
  [3, 'Mur 3 Ouest / Plancher', 1, 5.6],
  [4, 'Mur 4 Sud / Plancher Int.', 2, 5.0],
  [4, 'Mur 4 Sud / Refend', 4, 3.5],
  [4, 'Mur 4 Sud / Plancher', 1, 5.4],
  [5, 'Mur 5 Sud / Plancher Int.', 2, 2.6],
  [5, 'Mur 5 Sud / Plancher', 1, 2.6],
  [6, 'Mur 6 Ouest / Plancher Int.', 2, 1.6],
  [6, 'Mur 6 Ouest / Refend', 4, 2.5],
  [6, 'Mur 6 Ouest / Plancher', 1, 1.9]
].map(([murN, description, liaison, l]) => ({
  donnee_entree: {
    reference: `pt_${description.replace(/\W+/g, '_')}`,
    description,
    reference_1: `mur_${murN}`,
    reference_2: liaison === 1 ? 'plancher_bas_1' : undefined,
    enum_type_liaison_id: liaison,
    enum_methode_saisie_pont_thermique_id: 1,
    // le plancher sépare deux niveaux du même lot : la valeur tabulée s'applique en entier
    pourcentage_valeur_pont_thermique: 1,
    l
  },
  donnee_intermediaire: {}
}));

export default {
  administratif: {
    date_visite_diagnostiqueur: '2024-03-14',
    date_etablissement_dpe: '2024-03-15',
    enum_modele_dpe_id: 1,
    enum_version_id: '2.3'
  },
  logement: {
    caracteristique_generale: {
      annee_construction: 1996,
      enum_periode_construction_id: 6, // 1989-2000
      enum_methode_application_dpe_log_id: 1, // maison individuelle
      surface_habitable_logement: 116,
      nombre_niveau_logement: 2,
      nombre_niveau_immeuble: 2,
      hsp: 2.5,
      nombre_appartement: 1,
      appartement_non_visite: 0
    },
    meteo: {
      enum_zone_climatique_id: 5, // H2b
      enum_classe_altitude_id: 1, // < 400 m
      batiment_materiaux_anciens: 0
    },
    enveloppe: {
      inertie: {
        inertie_plancher_bas_lourd: 0,
        inertie_plancher_haut_lourd: 0,
        inertie_paroi_verticale_lourd: 0,
        enum_classe_inertie_id: 4 // légère
      },
      mur_collection: {
        mur: [
          mur(1, 3, 31.2, 2.4 + 4.0 + 5.4),
          mur(2, 2, 51.9, 1.1 + 3.9),
          mur(3, 4, 27.8, 1.2 + 1.0 + 2.4),
          mur(4, 1, 26.9, 1.9),
          murGarage(5, 1, 13.1, 0),
          murGarage(6, 4, 9.4, 1.8, { enum_type_doublage_id: 3 })
        ]
      },
      plancher_bas_collection: {
        plancher_bas: [
          {
            donnee_entree: {
              reference: 'plancher_bas_1',
              description: 'Dalle béton donnant sur un terre-plein avec isolation sous chape flottante',
              enum_type_adjacence_id: 5, // terre-plein
              surface_paroi_opaque: 74,
              surface_ue: 74,
              perimetre_ue: 24,
              calcul_ue: 1,
              enum_type_plancher_bas_id: 9, // dalle béton
              enum_methode_saisie_u0_id: 2,
              enum_type_isolation_id: 3, // ITI (sous chape)
              enum_periode_isolation_id: 6,
              enum_methode_saisie_u_id: 7
            },
            donnee_intermediaire: {}
          }
        ]
      },
      plancher_haut_collection: {
        plancher_haut: [
          {
            donnee_entree: {
              reference: 'plancher_haut_1',
              description: 'Plafond sous solives bois donnant sur un comble fortement ventilé, isolation extérieure',
              enum_type_adjacence_id: 11, // comble fortement ventilé
              surface_paroi_opaque: 22.1,
              surface_aiu: 22.1,
              surface_aue: 30,
              enum_cfg_isolation_lnc_id: 2,
              enum_type_plancher_haut_id: 10, // plafond bois sous solives bois
              enum_methode_saisie_u0_id: 2,
              enum_type_isolation_id: 4, // ITE
              enum_periode_isolation_id: 6,
              enum_methode_saisie_u_id: 7
            },
            donnee_intermediaire: {}
          },
          {
            donnee_entree: {
              reference: 'plancher_haut_2',
              description: 'Combles aménagés sous rampants donnant sur l’extérieur, isolation intérieure',
              enum_type_adjacence_id: 1,
              surface_paroi_opaque: 37.5,
              enum_type_plancher_haut_id: 12, // combles aménagés sous rampant
              enum_methode_saisie_u0_id: 2,
              enum_type_isolation_id: 3, // ITI
              enum_periode_isolation_id: 6,
              enum_methode_saisie_u_id: 7
            },
            donnee_intermediaire: {}
          },
          {
            donnee_entree: {
              reference: 'plancher_haut_3',
              description: 'Plafond entre solives bois donnant sur l’extérieur (terrasse), isolation extérieure',
              enum_type_adjacence_id: 1,
              surface_paroi_opaque: 6,
              enum_type_plancher_haut_id: 4, // plafond entre solives bois
              enum_methode_saisie_u0_id: 2,
              enum_type_isolation_id: 4, // ITE
              enum_periode_isolation_id: 6,
              enum_methode_saisie_u_id: 7
            },
            donnee_intermediaire: {}
          }
        ]
      },
      baie_vitree_collection: { baie_vitree: baies },
      porte_collection: { porte: portes },
      ets_collection: {},
      pont_thermique_collection: { pont_thermique: PT }
    },
    ventilation_collection: {
      ventilation: [
        {
          donnee_entree: {
            reference: 'ventilation_1',
            description: 'VMC SF auto réglable après 2012',
            surface_ventile: 116,
            plusieurs_facade_exposee: 1,
            enum_methode_saisie_q4pa_conv_id: 1,
            enum_type_ventilation_id: 6,
            ventilation_post_2012: 1
          },
          donnee_intermediaire: {}
        }
      ]
    },
    climatisation_collection: {},
    production_elec_enr: {
      donnee_entree: { presence_production_pv: 0, enum_type_enr_id: 1 },
      donnee_intermediaire: {},
      panneaux_pv_collection: {}
    },
    installation_ecs_collection: {
      installation_ecs: [
        {
          donnee_entree: {
            reference: 'installation_ecs_1',
            description: 'ECS combinée au chauffage',
            enum_cfg_installation_ecs_id: 1,
            enum_type_installation_id: 1,
            enum_methode_calcul_conso_id: 1,
            surface_habitable: 116,
            nombre_logement: 1,
            nombre_niveau_installation_ecs: 2,
            enum_bouclage_reseau_ecs_id: 1,
            reseau_distribution_isole: 0
          },
          donnee_intermediaire: {},
          generateur_ecs_collection: {
            generateur_ecs: [
              {
                donnee_entree: {
                  reference: 'generateur_ecs_1',
                  reference_generateur_mixte: 'generateur_ch_1',
                  description: 'Chaudière gaz à condensation 2001-2015 (mixte)',
                  enum_type_generateur_ecs_id: 56,
                  enum_usage_generateur_id: 3,
                  enum_type_energie_id: 2,
                  enum_methode_saisie_carac_sys_id: 1,
                  enum_type_stockage_ecs_id: 1, // production instantanée
                  position_volume_chauffe: 0,
                  presence_ventouse: 1,
                  ventilateur: 0
                },
                donnee_intermediaire: {}
              }
            ]
          }
        }
      ]
    },
    installation_chauffage_collection: {
      installation_chauffage: [
        {
          donnee_entree: {
            reference: 'installation_chauffage_1',
            description: 'Installation de chauffage simple',
            surface_chauffee: 116,
            nombre_niveau_installation_ch: 2,
            enum_cfg_installation_ch_id: 1,
            cle_repartition_ch: 1,
            enum_type_installation_id: 1,
            enum_methode_calcul_conso_id: 1
          },
          donnee_intermediaire: {},
          emetteur_chauffage_collection: {
            emetteur_chauffage: [
              {
                donnee_entree: {
                  reference: 'emetteur_1',
                  description: 'Radiateur bitube avec robinet thermostatique',
                  surface_chauffee: 116,
                  enum_type_emission_distribution_id: 38,
                  reseau_distribution_isole: 0,
                  enum_equipement_intermittence_id: 3, // central avec minimum de température
                  enum_type_chauffage_id: 2, // central
                  enum_type_regulation_id: 2,
                  enum_temp_distribution_ch_id: 4, // haute (> 65 °C)
                  enum_periode_installation_emetteur_id: 2, // 1981-2000
                  enum_lien_generateur_emetteur_id: 1
                },
                donnee_intermediaire: {}
              }
            ]
          },
          generateur_chauffage_collection: {
            generateur_chauffage: [
              {
                donnee_entree: {
                  reference: 'generateur_ch_1',
                  reference_generateur_mixte: 'generateur_ecs_1',
                  description: 'Chaudière gaz à condensation 2001-2015',
                  enum_type_generateur_ch_id: 96,
                  enum_usage_generateur_id: 3,
                  enum_type_energie_id: 2,
                  position_volume_chauffe: 0,
                  presence_ventouse: 1,
                  presence_regulation_combustion: 1,
                  ventilateur: 0,
                  enum_methode_saisie_carac_sys_id: 1,
                  enum_lien_generateur_emetteur_id: 1
                },
                donnee_intermediaire: {}
              }
            ]
          }
        }
      ]
    }
  }
};
