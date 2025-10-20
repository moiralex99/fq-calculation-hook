# Cas d'usage courants - Automations Directus

Ce document présente des exemples concrets et prêts à l'emploi pour les scénarios les plus fréquents.

## 📋 Table des matières

1. [Modifier l'item courant](#1-modifier-litem-courant)
2. [Modifier les enfants (M2O)](#2-modifier-les-enfants-m2o)
3. [Modifier les parents](#3-modifier-les-parents)
4. [Modifier les enfants niveau +2, +3, etc.](#4-modifier-les-enfants-niveau-2-3-etc)
5. [Modifier les parents niveau +2](#5-modifier-les-parents-niveau-2)
6. [Créer un objet indépendant](#6-créer-un-objet-indépendant)
7. [Créer des enfants](#7-créer-des-enfants)
8. [Duplication complète (avec cascade)](#8-duplication-complète-avec-cascade)
9. [Assigner un utilisateur conditionnel](#9-assigner-un-utilisateur-conditionnel)
10. [Supprimer des items (Delete)](#10-supprimer-des-items-delete)
11. [Calculs d'agrégation](#11-calculs-dagrégation)
12. [Gestion de dates et échéances](#12-gestion-de-dates-et-échéances)
13. [Relations Many-to-Many (M2M)](#13-relations-many-to-many-m2m)
14. [Déclencher des Flows Directus](#14-déclencher-des-flows-directus)
15. [Envoi d'emails](#15-envoi-demails)
16. [Validation et contrôles](#16-validation-et-contrôles)
17. [Patterns avancés](#17-patterns-avancés)

---

## 1. Modifier l'item courant

**Cas :** Mettre à jour des champs de l'item qui a déclenché l'automation.

### Exemple 1.1 : Archiver un projet terminé

```json
{
  "name": "Archiver projet terminé",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "===": [{ "var": "statut" }, "termine"] }
    ]
  },
  "actions": [
    { "type": "set_field", "field": "date_fin", "value": "NOW()" },
    { "type": "set_field", "field": "archive", "value": true },
    { "type": "set_field", "field": "archived_by", "value": "$USER.id" }
  ]
}
```

### Exemple 1.2 : Calculer un total

```json
{
  "name": "Recalculer total commande",
  "collection_cible": "commandes",
  "status": "active",
  "rule": {
    "or": [
      { "in": ["quantite", { "var": "$CHANGED" }] },
      { "in": ["prix_unitaire", { "var": "$CHANGED" }] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "total",
      "value": { "*": [{ "var": "quantite" }, { "var": "prix_unitaire" }] }
    },
    {
      "type": "set_field",
      "field": "total_ttc",
      "value": {
        "*": [
          { "*": [{ "var": "quantite" }, { "var": "prix_unitaire" }] },
          1.2
        ]
      }
    }
  ]
}
```

### Exemple 1.3 : Générer un code automatique

```json
{
  "name": "Générer code projet",
  "collection_cible": "projets",
  "status": "active",
  "trigger_event": ["create"],
  "rule": { "===": [{ "var": "code" }, null] },
  "actions": [
    {
      "type": "set_field",
      "field": "code",
      "value": {
        "concat": [
          "PRJ-",
          { "var": "id" },
          "-",
          { "date_add": ["NOW()", 0, "days"] }
        ]
      }
    }
  ]
}
```

---

## 2. Modifier les enfants (M2O)

**Cas :** Mettre à jour tous les enfants liés à l'item courant via une relation Many-to-One.

**Structure :** `projets` ← M2O ← `taches` (chaque tâche a un `projet_id`)

### Exemple 2.1 : Propager le statut aux tâches

```json
{
  "name": "Propager statut projet aux tâches",
  "collection_cible": "projets",
  "status": "active",
  "rule": { "in": ["statut", { "var": "$CHANGED" }] },
  "actions": [
    {
      "type": "update_many",
      "collection": "taches",
      "filter": { "projet_id": { "_eq": { "var": "id" } } },
      "data": {
        "statut_projet": { "var": "statut" },
        "date_maj": "NOW()"
      }
    }
  ]
}
```

### Exemple 2.2 : Archiver toutes les tâches d'un projet

```json
{
  "name": "Archiver tâches du projet",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["archive", { "var": "$CHANGED" }] },
      { "===": [{ "var": "archive" }, true] }
    ]
  },
  "actions": [
    {
      "type": "update_many",
      "collection": "taches",
      "filter": { "projet_id": { "_eq": { "var": "id" } } },
      "data": {
        "archive": true,
        "date_archive": "NOW()"
      }
    }
  ]
}
```

### Exemple 2.3 : Mettre à jour les tâches conditionnellement

```json
{
  "name": "Clôturer tâches non terminées",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "===": [{ "var": "statut" }, "annule"] }
    ]
  },
  "actions": [
    {
      "type": "update_many",
      "collection": "taches",
      "filter": {
        "projet_id": { "_eq": { "var": "id" } },
        "statut": { "_neq": "termine" }
      },
      "data": {
        "statut": "annule",
        "commentaire": "Projet annulé automatiquement"
      }
    }
  ]
}
```

---

## 3. Modifier les parents

**Cas :** Mettre à jour le parent (relation M2O inverse) quand un enfant change.

**Structure :** `projets` ← M2O ← `taches` (on veut mettre à jour le projet depuis une tâche)

### Exemple 3.1 : Mettre à jour la date de dernière activité du projet

```json
{
  "name": "MAJ date activité projet",
  "collection_cible": "taches",
  "status": "active",
  "expand_fields": ["projet_id"],
  "rule": { "!==": [{ "var": "projet_id" }, null] },
  "actions": [
    {
      "type": "update_item",
      "collection": "projets",
      "id": { "var": "projet_id" },
      "data": {
        "derniere_activite": "NOW()"
      }
    }
  ]
}
```

### Exemple 3.2 : Recalculer le nombre de tâches du projet

```json
{
  "name": "Compter tâches du projet",
  "collection_cible": "taches",
  "status": "active",
  "trigger_event": ["create", "update"],
  "rule": { "!==": [{ "var": "projet_id" }, null] },
  "actions": [
    {
      "type": "set_field",
      "field": "$nb_taches",
      "value": {
        "length": {
          "lookup_many": [
            "taches",
            { "projet_id": { "_eq": { "var": "projet_id" } } },
            ["id"],
            500
          ]
        }
      }
    },
    {
      "type": "update_item",
      "collection": "projets",
      "id": { "var": "projet_id" },
      "data": {
        "nb_taches": { "var": "$nb_taches" }
      }
    }
  ]
}
```

### Exemple 3.3 : Passer le projet en "En cours" si au moins une tâche démarre

```json
{
  "name": "Démarrer projet automatiquement",
  "collection_cible": "taches",
  "status": "active",
  "expand_fields": ["projet_id.statut"],
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "===": [{ "var": "statut" }, "en_cours"] },
      { "===": [{ "var": "projet_id.statut" }, "planifie"] }
    ]
  },
  "actions": [
    {
      "type": "update_item",
      "collection": "projets",
      "id": { "var": "projet_id" },
      "data": {
        "statut": "en_cours",
        "date_debut_reelle": "NOW()"
      }
    }
  ]
}
```

---

## 4. Modifier les enfants niveau +2, +3, etc.

**Cas :** Cascade de modifications sur plusieurs niveaux de relations.

**Structure :** `projets` ← `domaines` ← `processus` ← `taches`

### Exemple 4.1 : Propager statut sur 2 niveaux (projet → domaines → processus)

```json
{
  "name": "Propager statut projet sur 2 niveaux",
  "collection_cible": "projets",
  "status": "active",
  "rule": { "in": ["statut", { "var": "$CHANGED" }] },
  "actions": [
    {
      "type": "for_each",
      "list": {
        "lookup_many": [
          "domaines",
          { "projet_id": { "_eq": { "var": "id" } } },
          ["id"],
          500
        ]
      },
      "actions": [
        {
          "type": "update_item",
          "collection": "domaines",
          "id": { "var": "$item.id" },
          "data": { "statut_projet": { "var": "statut" } }
        },
        {
          "type": "update_many",
          "collection": "processus",
          "filter": { "domaine_id": { "_eq": { "var": "$item.id" } } },
          "data": { "statut_projet": { "var": "statut" } }
        }
      ]
    }
  ]
}
```

### Exemple 4.2 : Cascade sur 3 niveaux avec update_many

```json
{
  "name": "Archiver projet et tous descendants",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["archive", { "var": "$CHANGED" }] },
      { "===": [{ "var": "archive" }, true] }
    ]
  },
  "actions": [
    {
      "type": "for_each",
      "list": {
        "lookup_many": [
          "domaines",
          { "projet_id": { "_eq": { "var": "id" } } },
          ["id"],
          500
        ]
      },
      "actions": [
        {
          "type": "update_item",
          "collection": "domaines",
          "id": { "var": "$item.id" },
          "data": { "archive": true }
        },
        {
          "type": "for_each",
          "list": {
            "lookup_many": [
              "processus",
              { "domaine_id": { "_eq": { "var": "$item.id" } } },
              ["id"],
              500
            ]
          },
          "actions": [
            {
              "type": "update_item",
              "collection": "processus",
              "id": { "var": "$item.id" },
              "data": { "archive": true }
            },
            {
              "type": "update_many",
              "collection": "taches",
              "filter": { "processus_id": { "_eq": { "var": "$item.id" } } },
              "data": { "archive": true }
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 5. Modifier les parents niveau +2

**Cas :** Remonter une information de plusieurs niveaux (tâche → processus → domaine → projet)

**Structure :** `taches` → `processus` → `domaine` → `projet`

### Exemple 5.1 : Mettre à jour le projet quand une tâche change (3 niveaux)

```json
{
  "name": "MAJ projet depuis tâche",
  "collection_cible": "taches",
  "status": "active",
  "expand_fields": ["processus_id.domaine_id.projet_id"],
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "!==": [{ "var": "processus_id.domaine_id.projet_id" }, null] }
    ]
  },
  "actions": [
    {
      "type": "update_item",
      "collection": "projets",
      "id": { "var": "processus_id.domaine_id.projet_id" },
      "data": {
        "derniere_tache_modifiee": { "var": "id" },
        "date_derniere_modification": "NOW()"
      }
    }
  ]
}
```

### Exemple 5.2 : Recalculer le % de complétion du projet (agrégation sur 3 niveaux)

```json
{
  "name": "Recalculer % projet depuis tâche",
  "collection_cible": "taches",
  "status": "active",
  "expand_fields": ["processus_id.domaine_id.projet_id"],
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "!==": [{ "var": "processus_id.domaine_id.projet_id" }, null] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$projet_id",
      "value": { "var": "processus_id.domaine_id.projet_id" }
    },
    {
      "type": "set_field",
      "field": "$domaines",
      "value": {
        "lookup_many": [
          "domaines",
          { "projet_id": { "_eq": { "var": "$projet_id" } } },
          ["id"],
          500
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$total_taches",
      "value": 0
    },
    {
      "type": "set_field",
      "field": "$taches_terminees",
      "value": 0
    },
    {
      "type": "for_each",
      "list": { "var": "$domaines" },
      "actions": [
        {
          "type": "set_field",
          "field": "$processus_list",
          "value": {
            "lookup_many": [
              "processus",
              { "domaine_id": { "_eq": { "var": "$item.id" } } },
              ["id"],
              500
            ]
          }
        },
        {
          "type": "for_each",
          "list": { "var": "$processus_list" },
          "actions": [
            {
              "type": "set_field",
              "field": "$taches",
              "value": {
                "lookup_many": [
                  "taches",
                  { "processus_id": { "_eq": { "var": "$item.id" } } },
                  ["id", "statut"],
                  500
                ]
              }
            },
            {
              "type": "set_field",
              "field": "$total_taches",
              "value": {
                "+": [
                  { "var": "$total_taches" },
                  { "length": { "var": "$taches" } }
                ]
              }
            },
            {
              "type": "set_field",
              "field": "$taches_terminees",
              "value": {
                "+": [
                  { "var": "$taches_terminees" },
                  {
                    "length": {
                      "filter_by": [
                        { "var": "$taches" },
                        { "===": [{ "var": "it.statut" }, "termine"] }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "type": "set_field",
      "field": "$pourcentage",
      "value": {
        "iif": [
          { ">": [{ "var": "$total_taches" }, 0] },
          {
            "*": [
              { "/": [{ "var": "$taches_terminees" }, { "var": "$total_taches" }] },
              100
            ]
          },
          0
        ]
      }
    },
    {
      "type": "update_item",
      "collection": "projets",
      "id": { "var": "$projet_id" },
      "data": {
        "pourcentage_completion": { "var": "$pourcentage" },
        "nb_taches_total": { "var": "$total_taches" },
        "nb_taches_terminees": { "var": "$taches_terminees" }
      }
    }
  ]
}
```

---

## 6. Créer un objet indépendant

**Cas :** Créer un enregistrement dans une autre collection (log, notification, audit, etc.)

### Exemple 6.1 : Logger un changement de statut

```json
{
  "name": "Logger changement statut",
  "collection_cible": "projets",
  "status": "active",
  "rule": { "in": ["statut", { "var": "$CHANGED" }] },
  "actions": [
    {
      "type": "create_item",
      "collection": "audit_log",
      "data": {
        "collection": "projets",
        "item_id": { "var": "id" },
        "field": "statut",
        "old_value": { "var": "$OLD.statut" },
        "new_value": { "var": "statut" },
        "user_id": "$USER.id",
        "timestamp": "NOW()"
      }
    }
  ]
}
```

### Exemple 6.2 : Créer une notification

```json
{
  "name": "Notifier changement priorité",
  "collection_cible": "taches",
  "status": "active",
  "expand_fields": ["responsable_id", "projet_id.chef_projet_id"],
  "rule": {
    "and": [
      { "in": ["priorite", { "var": "$CHANGED" }] },
      { "===": [{ "var": "priorite" }, "urgente"] }
    ]
  },
  "actions": [
    {
      "type": "create_item",
      "collection": "notifications",
      "data": {
        "user_id": { "var": "responsable_id" },
        "titre": {
          "concat": [
            "🚨 Tâche ",
            { "var": "titre" },
            " passée en URGENTE"
          ]
        },
        "message": {
          "concat": [
            "La tâche #",
            { "var": "id" },
            " a été marquée comme urgente."
          ]
        },
        "lien": {
          "concat": ["/items/taches/", { "var": "id" }]
        },
        "date_creation": "NOW()",
        "lu": false
      }
    },
    {
      "type": "create_item",
      "collection": "notifications",
      "data": {
        "user_id": { "var": "projet_id.chef_projet_id" },
        "titre": {
          "concat": [
            "🚨 Tâche urgente dans ",
            { "var": "projet_id.nom" }
          ]
        },
        "message": {
          "concat": [
            "La tâche ",
            { "var": "titre" },
            " a été marquée comme urgente."
          ]
        },
        "lien": {
          "concat": ["/items/taches/", { "var": "id" }]
        },
        "date_creation": "NOW()",
        "lu": false
      }
    }
  ]
}
```

### Exemple 6.3 : Créer un ticket de support automatiquement

```json
{
  "name": "Créer ticket si erreur",
  "collection_cible": "taches",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "===": [{ "var": "statut" }, "erreur"] }
    ]
  },
  "actions": [
    {
      "type": "create_item",
      "collection": "tickets_support",
      "data": {
        "titre": {
          "concat": [
            "Erreur dans tâche: ",
            { "var": "titre" }
          ]
        },
        "description": {
          "concat": [
            "La tâche #",
            { "var": "id" },
            " a rencontré une erreur.\n\n",
            "Commentaire: ",
            { "var": "commentaire" }
          ]
        },
        "priorite": "haute",
        "statut": "nouveau",
        "source_collection": "taches",
        "source_id": { "var": "id" },
        "date_creation": "NOW()"
      }
    }
  ]
}
```

---

## 7. Créer des enfants

**Cas :** Générer automatiquement des items liés (tâches, sous-processus, checklist, etc.)

### Exemple 7.1 : Créer des tâches standard pour un nouveau projet

```json
{
  "name": "Créer tâches initiales projet",
  "collection_cible": "projets",
  "status": "active",
  "trigger_event": ["create"],
  "rule": { "===": [{ "var": "type" }, "web"] },
  "actions": [
    {
      "type": "create_item",
      "collection": "taches",
      "data": {
        "projet_id": { "var": "id" },
        "titre": "Analyse des besoins",
        "priorite": "haute",
        "ordre": 1,
        "statut": "a_faire"
      }
    },
    {
      "type": "create_item",
      "collection": "taches",
      "data": {
        "projet_id": { "var": "id" },
        "titre": "Maquettage",
        "priorite": "moyenne",
        "ordre": 2,
        "statut": "a_faire"
      }
    },
    {
      "type": "create_item",
      "collection": "taches",
      "data": {
        "projet_id": { "var": "id" },
        "titre": "Développement",
        "priorite": "haute",
        "ordre": 3,
        "statut": "a_faire"
      }
    },
    {
      "type": "create_item",
      "collection": "taches",
      "data": {
        "projet_id": { "var": "id" },
        "titre": "Tests",
        "priorite": "haute",
        "ordre": 4,
        "statut": "a_faire"
      }
    },
    {
      "type": "create_item",
      "collection": "taches",
      "data": {
        "projet_id": { "var": "id" },
        "titre": "Mise en production",
        "priorite": "haute",
        "ordre": 5,
        "statut": "a_faire"
      }
    }
  ]
}
```

### Exemple 7.2 : Créer des enfants depuis une liste dynamique

```json
{
  "name": "Créer processus depuis template",
  "collection_cible": "projets",
  "status": "active",
  "trigger_event": ["create"],
  "expand_fields": ["template_id.processus_template"],
  "rule": { "!==": [{ "var": "template_id" }, null] },
  "actions": [
    {
      "type": "for_each",
      "list": { "var": "template_id.processus_template" },
      "actions": [
        {
          "type": "create_item",
          "collection": "processus",
          "data": {
            "projet_id": { "var": "id" },
            "nom": { "var": "$item.nom" },
            "description": { "var": "$item.description" },
            "duree_estimee": { "var": "$item.duree_estimee" },
            "ordre": { "var": "$index" }
          }
        }
      ]
    }
  ]
}
```

---

## 8. Duplication complète (avec cascade)

**Cas :** Dupliquer un item et tous ses enfants (multi-niveaux)

### Exemple 8.1 : Dupliquer un processus et ses tâches

```json
{
  "name": "Dupliquer processus avec tâches",
  "collection_cible": "processus",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["dupliquer", { "var": "$CHANGED" }] },
      { "===": [{ "var": "dupliquer" }, true] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$old_id",
      "value": { "var": "id" }
    },
    {
      "type": "create_item",
      "collection": "processus",
      "assign": "new_process",
      "data": {
        "titre": {
          "concat": [{ "var": "titre" }, " (Copie)"]
        },
        "description": { "var": "description" },
        "projet_id": { "var": "projet_id" },
        "statut": "brouillon"
      }
    },
    {
      "type": "for_each",
      "list": {
        "lookup_many": [
          "taches",
          { "processus_id": { "_eq": { "var": "$old_id" } } },
          ["id", "titre", "description", "priorite", "ordre", "duree_estimee"],
          500
        ]
      },
      "actions": [
        {
          "type": "create_item",
          "collection": "taches",
          "data": {
            "processus_id": { "var": "$new_process.id" },
            "titre": { "var": "$item.titre" },
            "description": { "var": "$item.description" },
            "priorite": { "var": "$item.priorite" },
            "ordre": { "var": "$item.ordre" },
            "duree_estimee": { "var": "$item.duree_estimee" },
            "statut": "a_faire"
          }
        }
      ]
    },
    {
      "type": "set_field",
      "field": "dupliquer",
      "value": false
    },
    {
      "type": "set_field",
      "field": "copie_id",
      "value": { "var": "$new_process.id" }
    }
  ]
}
```

### Exemple 8.2 : Archiver et créer nouvelle version active

```json
{
  "name": "Créer nouvelle version processus",
  "collection_cible": "processus",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "===": [{ "var": "$OLD.statut" }, "actif"] },
      { "===": [{ "var": "statut" }, "inactif"] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$old_process_id",
      "value": { "var": "id" }
    },
    {
      "type": "create_item",
      "collection": "processus",
      "assign": "new_process_id",
      "data": {
        "titre": {
          "concat": ["Active version of ", { "var": "titre" }]
        },
        "statut": "actif",
        "description": { "var": "description" },
        "projet_id": { "var": "projet_id" },
        "version_precedente_id": { "var": "id" }
      }
    },
    {
      "type": "for_each",
      "list": {
        "lookup_many": [
          "calc_tests",
          { "process": { "_eq": { "var": "$old_process_id" } } },
          ["id", "a", "b", "process"],
          500
        ]
      },
      "actions": [
        {
          "type": "create_item",
          "collection": "calc_tests",
          "data": {
            "process": { "var": "$new_process_id.id" },
            "a": { "var": "$item.a" },
            "b": { "var": "$item.b" }
          }
        }
      ]
    },
    {
      "type": "set_field",
      "field": "version_suivante_id",
      "value": { "var": "$new_process_id.id" }
    },
    {
      "type": "set_field",
      "field": "date_archivage",
      "value": "NOW()"
    }
  ]
}
```

### Exemple 8.3 : Duplication sur 3 niveaux (Campagne → Calendrier → Domaine → Processus)

```json
{
  "name": "Dupliquer campagne complète",
  "collection_cible": "campagnes",
  "status": "active",
  "expand_fields": [
    "campagne_source.calendriers.domaines.processus"
  ],
  "rule": {
    "and": [
      { "in": ["dupliquer", { "var": "$CHANGED" }] },
      { "===": [{ "var": "dupliquer" }, true] }
    ]
  },
  "actions": [
    {
      "type": "for_each",
      "list": { "var": "campagne_source.calendriers" },
      "actions": [
        {
          "type": "create_item",
          "collection": "calendriers",
          "assign": "new_calendrier",
          "data": {
            "nom": {
              "concat": [
                { "var": "$item.nom" },
                " - ",
                { "var": "annee" }
              ]
            },
            "campagne_id": { "var": "id" },
            "annee": { "var": "annee" }
          }
        },
        {
          "type": "for_each",
          "list": { "var": "$item.domaines" },
          "actions": [
            {
              "type": "create_item",
              "collection": "domaines",
              "assign": "new_domaine",
              "data": {
                "nom": { "var": "$item.nom" },
                "calendrier_id": { "var": "$new_calendrier.id" }
              }
            },
            {
              "type": "for_each",
              "list": { "var": "$item.processus" },
              "actions": [
                {
                  "type": "create_item",
                  "collection": "processus",
                  "data": {
                    "nom": { "var": "$item.nom" },
                    "domaine_id": { "var": "$new_domaine.id" },
                    "description": { "var": "$item.description" },
                    "statut": "planifie"
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "set_field",
      "field": "dupliquer",
      "value": false
    },
    {
      "type": "set_field",
      "field": "date_duplication",
      "value": "NOW()"
    }
  ]
}
```

---

## 9. Assigner un utilisateur conditionnel

**Cas :** Affecter automatiquement un utilisateur selon des critères (round-robin, charge de travail, compétences, etc.)

### Exemple 9.1 : Assigner selon la priorité

```json
{
  "name": "Assigner responsable selon priorité",
  "collection_cible": "taches",
  "status": "active",
  "trigger_event": ["create"],
  "rule": { "===": [{ "var": "responsable_id" }, null] },
  "actions": [
    {
      "type": "set_field",
      "field": "responsable_id",
      "value": {
        "case": [
          { "===": [{ "var": "priorite" }, "urgente"] },
          "user-lead-id",
          { "===": [{ "var": "priorite" }, "haute"] },
          "user-senior-id",
          "user-junior-id"
        ]
      }
    }
  ]
}
```

### Exemple 9.2 : Assigner au chef de projet parent

```json
{
  "name": "Assigner responsable depuis projet",
  "collection_cible": "taches",
  "status": "active",
  "trigger_event": ["create"],
  "expand_fields": ["projet_id.chef_projet_id"],
  "rule": {
    "and": [
      { "===": [{ "var": "responsable_id" }, null] },
      { "!==": [{ "var": "projet_id.chef_projet_id" }, null] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "responsable_id",
      "value": { "var": "projet_id.chef_projet_id" }
    }
  ]
}
```

### Exemple 9.3 : Assigner selon la charge de travail (utilisateur avec le moins de tâches)

```json
{
  "name": "Assigner à l'utilisateur le moins chargé",
  "collection_cible": "taches",
  "status": "active",
  "trigger_event": ["create"],
  "rule": {
    "and": [
      { "===": [{ "var": "responsable_id" }, null] },
      { "===": [{ "var": "auto_assign" }, true] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$users_disponibles",
      "value": {
        "lookup_many": [
          "directus_users",
          {
            "role": { "_eq": "developer" },
            "status": { "_eq": "active" }
          },
          ["id", "first_name", "last_name"],
          50
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$user_charges",
      "value": {
        "map_by": [
          { "var": "$users_disponibles" },
          {
            "id": { "var": "it.id" },
            "nb_taches": {
              "length": {
                "lookup_many": [
                  "taches",
                  {
                    "responsable_id": { "_eq": { "var": "it.id" } },
                    "statut": { "_nin": ["termine", "annule"] }
                  },
                  ["id"],
                  500
                ]
              }
            }
          }
        ]
      }
    },
    {
      "type": "log",
      "message": {
        "concat": [
          "Charges: ",
          { "var": "$user_charges" }
        ]
      }
    }
  ]
}
```

**Note :** Pour un vrai round-robin, il faudrait stocker un compteur dans une table séparée ou utiliser un Flow Directus.

### Exemple 9.4 : Assigner selon compétence

```json
{
  "name": "Assigner selon compétence requise",
  "collection_cible": "taches",
  "status": "active",
  "trigger_event": ["create"],
  "rule": {
    "and": [
      { "===": [{ "var": "responsable_id" }, null] },
      { "!==": [{ "var": "competence_requise" }, null] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$users_competents",
      "value": {
        "lookup_many": [
          "user_competences",
          {
            "competence": { "_eq": { "var": "competence_requise" } },
            "niveau": { "_gte": 3 }
          },
          ["user_id"],
          50
        ]
      }
    },
    {
      "type": "set_field",
      "field": "responsable_id",
      "value": {
        "get": [
          { "get": [{ "var": "$users_competents" }, 0] },
          "user_id"
        ]
      }
    }
  ]
}
```

---

## 10. Supprimer des items (Delete)

**Cas :** Supprimer automatiquement des items (soft delete avec flag ou hard delete via API custom)

**Note :** Directus n'expose pas de `delete_item` executor par défaut dans les automations pour des raisons de sécurité. Les solutions sont :
1. **Soft delete** : Marquer l'item comme supprimé avec un flag
2. **Cascade via trigger_flow** : Appeler un Flow qui fait la suppression
3. **Utiliser update_many** pour marquer plusieurs items

### Exemple 10.1 : Soft delete de l'item courant

```json
{
  "name": "Soft delete projet",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["action_supprimer", { "var": "$CHANGED" }] },
      { "===": [{ "var": "action_supprimer" }, true] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "deleted",
      "value": true
    },
    {
      "type": "set_field",
      "field": "deleted_at",
      "value": "NOW()"
    },
    {
      "type": "set_field",
      "field": "deleted_by",
      "value": "$USER.id"
    },
    {
      "type": "set_field",
      "field": "action_supprimer",
      "value": false
    }
  ]
}
```

### Exemple 10.2 : Soft delete en cascade (projet + tâches)

```json
{
  "name": "Soft delete projet avec tâches",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["deleted", { "var": "$CHANGED" }] },
      { "===": [{ "var": "deleted" }, true] }
    ]
  },
  "actions": [
    {
      "type": "update_many",
      "collection": "taches",
      "filter": { "projet_id": { "_eq": { "var": "id" } } },
      "data": {
        "deleted": true,
        "deleted_at": "NOW()",
        "deleted_by": "$USER.id"
      }
    }
  ]
}
```

### Exemple 10.3 : Nettoyage automatique (purge des anciens items)

```json
{
  "name": "Purger logs anciens",
  "collection_cible": "audit_log",
  "status": "active",
  "trigger_event": ["create"],
  "rule": { "===": [{ "var": "action_purge" }, true] },
  "actions": [
    {
      "type": "set_field",
      "field": "$date_limite",
      "value": {
        "date_add": ["NOW()", -90, "days"]
      }
    },
    {
      "type": "update_many",
      "collection": "audit_log",
      "filter": {
        "date_creation": { "_lt": { "var": "$date_limite" } }
      },
      "data": {
        "archived": true
      },
      "limit": 1000
    }
  ]
}
```

### Exemple 10.4 : Supprimer les enfants orphelins

```json
{
  "name": "Nettoyer tâches orphelines",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["deleted", { "var": "$CHANGED" }] },
      { "===": [{ "var": "deleted" }, true] }
    ]
  },
  "actions": [
    {
      "type": "for_each",
      "list": {
        "lookup_many": [
          "taches",
          { "projet_id": { "_eq": { "var": "id" } } },
          ["id"],
          500
        ]
      },
      "actions": [
        {
          "type": "update_item",
          "collection": "taches",
          "id": { "var": "$item.id" },
          "data": {
            "deleted": true,
            "deleted_at": "NOW()"
          }
        }
      ]
    }
  ]
}
```

---

## 11. Calculs d'agrégation

**Cas :** Calculer automatiquement des totaux, moyennes, min/max depuis des collections liées.

### Exemple 11.1 : Calculer total commande depuis lignes

```json
{
  "name": "Calculer total commande",
  "collection_cible": "lignes_commande",
  "status": "active",
  "rule": {
    "!==": [{ "var": "commande_id" }, null]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$lignes",
      "value": {
        "lookup_many": [
          "lignes_commande",
          { "commande_id": { "_eq": { "var": "commande_id" } } },
          ["id", "quantite", "prix_unitaire"],
          500
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$total",
      "value": {
        "sum_by": [
          { "var": "$lignes" },
          { "*": [{ "var": "it.quantite" }, { "var": "it.prix_unitaire" }] }
        ]
      }
    },
    {
      "type": "update_item",
      "collection": "commandes",
      "id": { "var": "commande_id" },
      "data": {
        "total": { "var": "$total" },
        "nb_lignes": { "length": { "var": "$lignes" } }
      }
    }
  ]
}
```

### Exemple 11.2 : Calculer moyenne des notes

```json
{
  "name": "Calculer moyenne produit",
  "collection_cible": "avis_produit",
  "status": "active",
  "rule": { "!==": [{ "var": "produit_id" }, null] },
  "actions": [
    {
      "type": "set_field",
      "field": "$avis",
      "value": {
        "lookup_many": [
          "avis_produit",
          { "produit_id": { "_eq": { "var": "produit_id" } } },
          ["id", "note"],
          500
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$total_notes",
      "value": {
        "sum_by": [{ "var": "$avis" }, { "var": "it.note" }]
      }
    },
    {
      "type": "set_field",
      "field": "$nb_avis",
      "value": { "length": { "var": "$avis" } }
    },
    {
      "type": "set_field",
      "field": "$moyenne",
      "value": {
        "iif": [
          { ">": [{ "var": "$nb_avis" }, 0] },
          { "/": [{ "var": "$total_notes" }, { "var": "$nb_avis" }] },
          0
        ]
      }
    },
    {
      "type": "update_item",
      "collection": "produits",
      "id": { "var": "produit_id" },
      "data": {
        "note_moyenne": { "var": "$moyenne" },
        "nb_avis": { "var": "$nb_avis" }
      }
    }
  ]
}
```

### Exemple 11.3 : Calculer MIN/MAX

```json
{
  "name": "Calculer prix min/max produits",
  "collection_cible": "produits",
  "status": "active",
  "trigger_event": ["update"],
  "rule": {
    "!==": [{ "var": "categorie_id" }, null]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$produits_categorie",
      "value": {
        "lookup_many": [
          "produits",
          { "categorie_id": { "_eq": { "var": "categorie_id" } } },
          ["id", "prix"],
          500
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$prix_list",
      "value": {
        "map_by": [{ "var": "$produits_categorie" }, { "var": "it.prix" }]
      }
    },
    {
      "type": "update_item",
      "collection": "categories",
      "id": { "var": "categorie_id" },
      "data": {
        "prix_min": {
          "reduce_by": [
            { "var": "$prix_list" },
            999999,
            {
              "iif": [
                { "<": [{ "var": "it" }, { "var": "acc" }] },
                { "var": "it" },
                { "var": "acc" }
              ]
            }
          ]
        },
        "prix_max": {
          "reduce_by": [
            { "var": "$prix_list" },
            0,
            {
              "iif": [
                { ">": [{ "var": "it" }, { "var": "acc" }] },
                { "var": "it" },
                { "var": "acc" }
              ]
            }
          ]
        }
      }
    }
  ]
}
```

---

## 12. Gestion de dates et échéances

**Cas :** Calculer des dates automatiquement, gérer des rappels et des alertes temporelles.

### Exemple 12.1 : Calculer date d'échéance automatiquement

```json
{
  "name": "Calculer échéance tâche",
  "collection_cible": "taches",
  "status": "active",
  "trigger_event": ["create"],
  "rule": {
    "and": [
      { "!==": [{ "var": "duree_jours" }, null] },
      { "===": [{ "var": "date_echeance" }, null] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "date_debut",
      "value": "NOW()"
    },
    {
      "type": "set_field",
      "field": "date_echeance",
      "value": {
        "date_add": ["NOW()", { "var": "duree_jours" }, "days"]
      }
    }
  ]
}
```

### Exemple 12.2 : Alertes avant échéance

```json
{
  "name": "Créer alerte 24h avant échéance",
  "collection_cible": "taches",
  "status": "active",
  "rule": {
    "and": [
      { "!==": [{ "var": "date_echeance" }, null] },
      { "!==": [{ "var": "statut" }, "termine"] },
      {
        "and": [
          { "<=": [{ "date_diff": [{ "var": "date_echeance" }, "NOW()", "hours"] }, 24] },
          { ">": [{ "date_diff": [{ "var": "date_echeance" }, "NOW()", "hours"] }, 0] }
        ]
      },
      { "!==": [{ "var": "alerte_24h_creee" }, true] }
    ]
  },
  "actions": [
    {
      "type": "create_item",
      "collection": "alertes",
      "data": {
        "type": "echeance_proche",
        "tache_id": { "var": "id" },
        "message": {
          "concat": [
            "⏰ La tâche '",
            { "var": "titre" },
            "' arrive à échéance dans ",
            { "date_diff": [{ "var": "date_echeance" }, "NOW()", "hours"] },
            " heures"
          ]
        },
        "destinataire_id": { "var": "responsable_id" },
        "date_creation": "NOW()"
      }
    },
    {
      "type": "set_field",
      "field": "alerte_24h_creee",
      "value": true
    }
  ]
}
```

### Exemple 12.3 : Calculer retard

```json
{
  "name": "Calculer retard tâche",
  "collection_cible": "taches",
  "status": "active",
  "rule": {
    "and": [
      { "!==": [{ "var": "date_echeance" }, null] },
      { "!==": [{ "var": "statut" }, "termine"] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$jours_retard",
      "value": {
        "date_diff": ["NOW()", { "var": "date_echeance" }, "days"]
      }
    },
    {
      "type": "set_field",
      "field": "en_retard",
      "value": { ">": [{ "var": "$jours_retard" }, 0] }
    },
    {
      "type": "set_field",
      "field": "jours_retard",
      "value": {
        "iif": [
          { ">": [{ "var": "$jours_retard" }, 0] },
          { "var": "$jours_retard" },
          0
        ]
      }
    },
    {
      "type": "set_field",
      "field": "priorite",
      "value": {
        "iif": [
          { ">": [{ "var": "$jours_retard" }, 7] },
          "critique",
          { "var": "priorite" }
        ]
      }
    }
  ]
}
```

### Exemple 12.4 : Date de fin automatique quand toutes les tâches sont terminées

```json
{
  "name": "Clôturer projet automatiquement",
  "collection_cible": "taches",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "===": [{ "var": "statut" }, "termine"] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$taches_projet",
      "value": {
        "lookup_many": [
          "taches",
          { "projet_id": { "_eq": { "var": "projet_id" } } },
          ["id", "statut"],
          500
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$toutes_terminees",
      "value": {
        "all_by": [
          { "var": "$taches_projet" },
          { "===": [{ "var": "it.statut" }, "termine"] }
        ]
      }
    },
    {
      "type": "update_item",
      "collection": "projets",
      "id": { "var": "projet_id" },
      "when": { "var": "$toutes_terminees" },
      "data": {
        "statut": "termine",
        "date_fin": "NOW()"
      }
    }
  ]
}
```

---

## 13. Relations Many-to-Many (M2M)

**Cas :** Gérer des relations M2M via des tables de jonction.

### Exemple 13.1 : Créer relations M2M lors de duplication

```json
{
  "name": "Dupliquer projet avec équipe",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["dupliquer", { "var": "$CHANGED" }] },
      { "===": [{ "var": "dupliquer" }, true] }
    ]
  },
  "actions": [
    {
      "type": "create_item",
      "collection": "projets",
      "assign": "new_projet",
      "data": {
        "nom": { "concat": [{ "var": "nom" }, " (Copie)"] },
        "description": { "var": "description" }
      }
    },
    {
      "type": "for_each",
      "list": {
        "lookup_many": [
          "projet_membres",
          { "projet_id": { "_eq": { "var": "id" } } },
          ["id", "user_id", "role"],
          500
        ]
      },
      "actions": [
        {
          "type": "create_item",
          "collection": "projet_membres",
          "data": {
            "projet_id": { "var": "$new_projet.id" },
            "user_id": { "var": "$item.user_id" },
            "role": { "var": "$item.role" }
          }
        }
      ]
    },
    {
      "type": "set_field",
      "field": "dupliquer",
      "value": false
    }
  ]
}
```

### Exemple 13.2 : Synchroniser relations bidirectionnelles

```json
{
  "name": "Synchroniser tags produit",
  "collection_cible": "produit_tags",
  "status": "active",
  "trigger_event": ["create"],
  "rule": { "!==": [{ "var": "tag_id" }, null] },
  "actions": [
    {
      "type": "set_field",
      "field": "$nb_produits",
      "value": {
        "length": {
          "lookup_many": [
            "produit_tags",
            { "tag_id": { "_eq": { "var": "tag_id" } } },
            ["id"],
            500
          ]
        }
      }
    },
    {
      "type": "update_item",
      "collection": "tags",
      "id": { "var": "tag_id" },
      "data": {
        "nb_produits": { "var": "$nb_produits" }
      }
    }
  ]
}
```

### Exemple 13.3 : Valider unicité dans M2M

```json
{
  "name": "Empêcher doublons équipe projet",
  "collection_cible": "projet_membres",
  "status": "active",
  "trigger_event": ["create"],
  "rule": true,
  "actions": [
    {
      "type": "set_field",
      "field": "$existing",
      "value": {
        "lookup_many": [
          "projet_membres",
          {
            "projet_id": { "_eq": { "var": "projet_id" } },
            "user_id": { "_eq": { "var": "user_id" } },
            "id": { "_neq": { "var": "id" } }
          },
          ["id"],
          1
        ]
      }
    },
    {
      "type": "set_field",
      "field": "erreur",
      "when": { ">": [{ "length": { "var": "$existing" } }, 0] },
      "value": "Cet utilisateur est déjà membre du projet"
    },
    {
      "type": "set_field",
      "field": "deleted",
      "when": { ">": [{ "length": { "var": "$existing" } }, 0] },
      "value": true
    }
  ]
}
```

---

## 14. Déclencher des Flows Directus

**Cas :** Orchestrer des workflows complexes en combinant Automations + Flows.

### Exemple 14.1 : Déclencher un Flow pour traitement long

```json
{
  "name": "Déclencher export massif",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["action_export", { "var": "$CHANGED" }] },
      { "===": [{ "var": "action_export" }, true] }
    ]
  },
  "actions": [
    {
      "type": "trigger_flow",
      "key": "export_projet_complet",
      "payload": {
        "projet_id": { "var": "id" },
        "format": { "var": "format_export" },
        "email_destinataire": "$USER.id"
      }
    },
    {
      "type": "set_field",
      "field": "action_export",
      "value": false
    },
    {
      "type": "set_field",
      "field": "statut_export",
      "value": "en_cours"
    }
  ]
}
```

**Dans Directus Flow**, créer un trigger "Custom Event" :
- Event name: `automations.trigger.flow`
- Filter: `payload.key` equals `export_projet_complet`
- Utiliser `payload.payload.projet_id` dans les opérations

### Exemple 14.2 : Déclencher notification webhook

```json
{
  "name": "Notifier système externe",
  "collection_cible": "commandes",
  "status": "active",
  "rule": {
    "and": [
      { "in": ["statut", { "var": "$CHANGED" }] },
      { "===": [{ "var": "statut" }, "payee"] }
    ]
  },
  "actions": [
    {
      "type": "trigger_flow",
      "key": "webhook_commande_payee",
      "payload": {
        "commande_id": { "var": "id" },
        "montant": { "var": "total" },
        "client_email": { "var": "client_email" },
        "timestamp": "NOW()"
      }
    }
  ]
}
```

### Exemple 14.3 : Orchestration multi-étapes

```json
{
  "name": "Workflow validation document",
  "collection_cible": "documents",
  "status": "active",
  "rule": { "in": ["statut", { "var": "$CHANGED" }] },
  "actions": [
    {
      "type": "trigger_flow",
      "when": { "===": [{ "var": "statut" }, "en_validation"] },
      "key": "envoyer_notification_valideur",
      "payload": {
        "document_id": { "var": "id" },
        "valideur_id": { "var": "valideur_id" }
      }
    },
    {
      "type": "trigger_flow",
      "when": { "===": [{ "var": "statut" }, "valide"] },
      "key": "publier_document",
      "payload": {
        "document_id": { "var": "id" }
      }
    },
    {
      "type": "trigger_flow",
      "when": { "===": [{ "var": "statut" }, "rejete"] },
      "key": "notifier_auteur_rejet",
      "payload": {
        "document_id": { "var": "id" },
        "auteur_id": { "var": "auteur_id" },
        "raison": { "var": "raison_rejet" }
      }
    }
  ]
}
```

---

## 15. Envoi d'emails

**Cas :** Envoyer des emails automatiques (nécessite configuration SMTP dans Directus ou implémentation custom).

**Note :** L'action `send_email` est un stub par défaut. Pour l'activer, il faut soit :
1. Implémenter le mailer dans `executors.send_email`
2. Utiliser `trigger_flow` pour appeler un Flow avec l'opération "Send Email"

### Exemple 15.1 : Email de bienvenue via Flow

```json
{
  "name": "Email bienvenue nouveau membre",
  "collection_cible": "directus_users",
  "status": "active",
  "trigger_event": ["create"],
  "rule": { "===": [{ "var": "status" }, "active"] },
  "actions": [
    {
      "type": "trigger_flow",
      "key": "email_bienvenue",
      "payload": {
        "email": { "var": "email" },
        "prenom": { "var": "first_name" },
        "nom": { "var": "last_name" }
      }
    }
  ]
}
```

### Exemple 15.2 : Notification email conditionnelle

```json
{
  "name": "Email escalade tâche critique",
  "collection_cible": "taches",
  "status": "active",
  "expand_fields": ["responsable_id.email", "projet_id.chef_projet_id.email"],
  "rule": {
    "and": [
      { "===": [{ "var": "priorite" }, "critique"] },
      { "!==": [{ "var": "statut" }, "termine"] },
      { ">": [{ "date_diff": ["NOW()", { "var": "date_echeance" }, "days"] }, 3] }
    ]
  },
  "actions": [
    {
      "type": "trigger_flow",
      "key": "email_escalade_tache",
      "payload": {
        "destinataire": { "var": "projet_id.chef_projet_id.email" },
        "sujet": {
          "concat": [
            "🚨 Tâche critique en retard: ",
            { "var": "titre" }
          ]
        },
        "tache_id": { "var": "id" },
        "retard_jours": {
          "date_diff": ["NOW()", { "var": "date_echeance" }, "days"]
        },
        "responsable": { "var": "responsable_id.email" }
      }
    }
  ]
}
```

---

## 16. Validation et contrôles

**Cas :** Valider des données, empêcher certaines actions, définir des erreurs custom.

**Note :** Les automations ne peuvent pas **bloquer** une transaction directement, mais elles peuvent :
1. Marquer l'item avec un flag d'erreur
2. Annuler l'action en restaurant l'ancienne valeur
3. Créer une alerte/log

### Exemple 16.1 : Valider cohérence de dates

```json
{
  "name": "Valider dates début/fin",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "!==": [{ "var": "date_debut" }, null] },
      { "!==": [{ "var": "date_fin" }, null] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$dates_invalides",
      "value": {
        ">": [
          { "date_diff": [{ "var": "date_debut" }, { "var": "date_fin" }, "days"] },
          0
        ]
      }
    },
    {
      "type": "set_field",
      "field": "erreur_validation",
      "when": { "var": "$dates_invalides" },
      "value": "La date de début doit être antérieure à la date de fin"
    },
    {
      "type": "set_field",
      "field": "date_fin",
      "when": { "var": "$dates_invalides" },
      "value": { "var": "$OLD.date_fin" }
    }
  ]
}
```

### Exemple 16.2 : Empêcher modification si statut verrouillé

```json
{
  "name": "Bloquer modification projet terminé",
  "collection_cible": "projets",
  "status": "active",
  "rule": {
    "and": [
      { "===": [{ "var": "$OLD.statut" }, "termine"] },
      { ">": [{ "length": { "var": "$CHANGED" } }, 0] },
      { "!==": [{ "var": "statut" }, "termine"] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "erreur_validation",
      "value": "Impossible de modifier un projet terminé"
    },
    {
      "type": "for_each",
      "list": { "var": "$CHANGED" },
      "actions": [
        {
          "type": "set_field",
          "field": { "var": "$item" },
          "value": { "get": [{ "var": "$OLD" }, { "var": "$item" }] }
        }
      ]
    }
  ]
}
```

### Exemple 16.3 : Valider budget disponible

```json
{
  "name": "Valider budget tâche",
  "collection_cible": "taches",
  "status": "active",
  "expand_fields": ["projet_id.budget_total", "projet_id.budget_utilise"],
  "rule": {
    "and": [
      { "in": ["budget_estime", { "var": "$CHANGED" }] },
      { "!==": [{ "var": "budget_estime" }, null] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$budget_restant",
      "value": {
        "-": [
          { "var": "projet_id.budget_total" },
          { "var": "projet_id.budget_utilise" }
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$depasse_budget",
      "value": {
        ">": [{ "var": "budget_estime" }, { "var": "$budget_restant" }]
      }
    },
    {
      "type": "set_field",
      "field": "alerte_budget",
      "when": { "var": "$depasse_budget" },
      "value": {
        "concat": [
          "Budget estimé (",
          { "var": "budget_estime" },
          "€) dépasse le budget disponible (",
          { "var": "$budget_restant" },
          "€)"
        ]
      }
    },
    {
      "type": "create_item",
      "collection": "alertes",
      "when": { "var": "$depasse_budget" },
      "data": {
        "type": "budget_depasse",
        "tache_id": { "var": "id" },
        "message": { "var": "alerte_budget" },
        "destinataire_id": { "var": "projet_id.chef_projet_id" },
        "date_creation": "NOW()"
      }
    }
  ]
}
```

---

## 17. Patterns avancés

### 10.1 : Gestion de workflow avec états

```json
{
  "name": "Workflow validation multi-niveaux",
  "collection_cible": "documents",
  "status": "active",
  "rule": { "in": ["statut", { "var": "$CHANGED" }] },
  "actions": [
    {
      "type": "set_field",
      "field": "date_transition",
      "value": "NOW()"
    },
    {
      "type": "create_item",
      "collection": "workflow_log",
      "data": {
        "document_id": { "var": "id" },
        "statut_precedent": { "var": "$OLD.statut" },
        "statut_nouveau": { "var": "statut" },
        "user_id": "$USER.id",
        "timestamp": "NOW()"
      }
    },
    {
      "type": "set_field",
      "field": "valideur_id",
      "value": {
        "case": [
          { "===": [{ "var": "statut" }, "en_validation_n1"] },
          { "var": "auteur_id.manager_id" },
          { "===": [{ "var": "statut" }, "en_validation_n2"] },
          { "var": "auteur_id.manager_id.manager_id" },
          null
        ]
      }
    },
    {
      "type": "set_field",
      "field": "date_validation",
      "value": {
        "iif": [
          { "===": [{ "var": "statut" }, "valide"] },
          "NOW()",
          null
        ]
      }
    }
  ]
}
```

### 10.2 : Calcul de KPI en temps réel

```json
{
  "name": "Calculer KPI projet",
  "collection_cible": "taches",
  "status": "active",
  "rule": { "in": ["statut", { "var": "$CHANGED" }] },
  "actions": [
    {
      "type": "set_field",
      "field": "$projet_id",
      "value": { "var": "projet_id" }
    },
    {
      "type": "set_field",
      "field": "$taches",
      "value": {
        "lookup_many": [
          "taches",
          { "projet_id": { "_eq": { "var": "$projet_id" } } },
          ["id", "statut", "duree_estimee", "duree_reelle"],
          500
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$nb_total",
      "value": { "length": { "var": "$taches" } }
    },
    {
      "type": "set_field",
      "field": "$nb_terminees",
      "value": {
        "length": {
          "filter_by": [
            { "var": "$taches" },
            { "===": [{ "var": "it.statut" }, "termine"] }
          ]
        }
      }
    },
    {
      "type": "set_field",
      "field": "$duree_totale_estimee",
      "value": {
        "sum_by": [{ "var": "$taches" }, { "var": "it.duree_estimee" }]
      }
    },
    {
      "type": "set_field",
      "field": "$duree_totale_reelle",
      "value": {
        "sum_by": [
          {
            "filter_by": [
              { "var": "$taches" },
              { "===": [{ "var": "it.statut" }, "termine"] }
            ]
          },
          { "var": "it.duree_reelle" }
        ]
      }
    },
    {
      "type": "update_item",
      "collection": "projets",
      "id": { "var": "$projet_id" },
      "data": {
        "nb_taches_total": { "var": "$nb_total" },
        "nb_taches_terminees": { "var": "$nb_terminees" },
        "pourcentage_completion": {
          "*": [
            { "/": [{ "var": "$nb_terminees" }, { "var": "$nb_total" }] },
            100
          ]
        },
        "duree_estimee": { "var": "$duree_totale_estimee" },
        "duree_reelle": { "var": "$duree_totale_reelle" },
        "ecart_estimation": {
          "-": [
            { "var": "$duree_totale_reelle" },
            { "var": "$duree_totale_estimee" }
          ]
        }
      }
    }
  ]
}
```

### 10.3 : Gestion de SLA et alertes

```json
{
  "name": "Créer alerte SLA dépassé",
  "collection_cible": "tickets",
  "status": "active",
  "rule": {
    "and": [
      { "!==": [{ "var": "date_echeance" }, null] },
      { ">": [{ "date_diff": ["NOW()", { "var": "date_echeance" }, "hours"] }, 0] },
      { "!==": [{ "var": "statut" }, "ferme"] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "sla_depasse",
      "value": true
    },
    {
      "type": "set_field",
      "field": "heures_depassement",
      "value": {
        "date_diff": ["NOW()", { "var": "date_echeance" }, "hours"]
      }
    },
    {
      "type": "create_item",
      "collection": "alertes",
      "data": {
        "type": "sla_depasse",
        "ticket_id": { "var": "id" },
        "priorite": "critique",
        "message": {
          "concat": [
            "SLA dépassé pour le ticket #",
            { "var": "id" },
            " - Retard: ",
            {
              "date_diff": ["NOW()", { "var": "date_echeance" }, "hours"]
            },
            "h"
          ]
        },
        "destinataire_id": { "var": "responsable_id" },
        "date_creation": "NOW()"
      }
    }
  ]
}
```

---

## 📊 Limites et bonnes pratiques

### Limites techniques

- **lookup_many** : Max 500 items par requête (ajustez `limit` si besoin)
- **Cascade profonde** : ~5 niveaux max recommandé pour performance
- **Créations massives** : ~5000 items max recommandé par automation

### Bonnes pratiques

1. **Utilisez `when`** pour conditions par action si la règle globale est complexe
2. **Variables temporaires** (`$xxx`) pour calculs intermédiaires
3. **Logs** pour debugging (`{ "type": "log", "message": ... }`)
4. **expand_fields** pour précharger les relations et éviter les N+1
5. **throttle_ms** pour éviter les exécutions répétées trop rapides
6. **Prévention boucles** : Le flag `_automationTriggered` est automatique

### Debug

Activez `AUTOMATIONS_DEBUG=1` pour voir les logs détaillés :

```bash
docker exec -it directus sh -c "AUTOMATIONS_DEBUG=1 node cli.js bootstrap"
```

Ou dans vos logs Directus :
```
[Automations] 🔍 DEBUG for_each action.list = ...
[Automations] 🔍 DEBUG context = ...
[Automations] 🔍 DEBUG computed list = ...
```

---

## 🎯 Besoin d'aide ?

- Consultez `README.md` pour la référence complète des opérations JSONLogic
- Testez vos règles avec le script `scripts/test-automation.mjs`
- Utilisez l'action `log` pour afficher des variables pendant l'exécution

