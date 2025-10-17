# Inventaire des fonctions (Version 1 - Simple)

Convention d'entrée texte -> AST:
- Un champ est référencé comme {{collection.champ}} ou si collection implicite: {{champ}}
- Une chaîne littérale est entourée de guillemets doubles: "texte"
- Nombres: 123, 3.14
- Booléens: true / false
- NULL: null
- Les fonctions s'écrivent: nom(arg1, arg2, ...)
- Opérateurs autorisés en inline: + - * / % = <> != < <= > >= AND OR NOT
- Condition courte: IF(condition, valeur_si_vrai, valeur_si_faux)

Chaque exemple montre: Expression Texte -> Intention -> Esquisse AST simplifiée.

Types de base: int, decimal, bool, string, date, datetime, any

Note: « Sucre syntaxique »
- Définition: alias de forme plus lisible réécrit en forme de base par le parseur (même fonctionnalité).
- Exemples: `and(a,b)` → `(a AND b)`, `sum_if(x, c)` → `sum(x, filter=c)`, `count_if(c)` → `count(*, filter=c)`, `datediff(a,b,u)` → `date_diff(u,b,a)`.
  Ajout: `inherit(expr, filter=cond)` → `(SELECT expr FROM cible WHERE cond LIMIT 1)`.
- Impact: aucune différence sur les dépendances ni le SQL généré; c’est uniquement pour le confort d’écriture.

---
## 1. Logique

Les formes opérateur sont recommandées: `AND`, `OR`, `NOT`.

### and(a,b) [alias]
Ex: and({{statut}} = "ouvert", {{effort_estime}} > 5)  — alias de `( … AND … )`

### or(a,b) [alias]
Ex: or({{priorite}} = "haute", {{retard}} = true) — alias de `( … OR … )`

### not(x) [alias]
Ex: not({{est_en_retard}}) — alias de `NOT ( … )`

### coalesce(a,b,...)
Ex: coalesce({{description}}, "(vide)")

### is_null(x)
Ex: is_null({{date_echeance}}) — rendu SQL: `(x IS NULL)`
Notes:
- Vérifie strictement la valeur SQL NULL. Une chaîne vide "" n'est pas NULL; utilisez `nullif(trim(x), "")` ou `coalesce(...)` selon le cas.
- Si la source contient des conteneurs (JSON/array) comme `[null]`, la colonne n'est pas NULL. Préférez normaliser à l'import (recommandé) ou combiner avec `try_cast`.

### is_blank(x)
Ex: is_blank({{statut}})
Notes:
- Retourne vrai pour: NULL/undefined, chaîne vide (après trim), tableau vide `[]`.
- Ne considère pas `0`, `"0"` ou `{}` comme vides.
- Pratique pour validations et valeurs par défaut côté interface.

### nullif(a,b)
Ex: nullif({{valeur}}, 0)

### in(value, list)
Deux syntaxes:
- Fonction: `in(x, a, b, …)` → `(x IN (a,b,…))`
- Opérateur SQL natif n’est pas parsé directement pour l’instant (utilisez la forme fonction).

Améliorations moteur (runtime temps réel):
- `in` gère aussi `x` en tableau (multi-select): vrai si au moins une valeur de `x` appartient à la liste.
- `in_ci(x, ...)`: variante insensible à la casse (applique trim + lower sur chaînes).
- `in_any(x, ...)`: intersection générique tableau↔liste.
Exemples:
- `in({{status}}, "new", "actif", "clos")`
- `in_ci(trim({{status}}), "new", "actif", "clos")`
- `in_any({{tags}}, "urgent", "vip")`

---
## 2. Comparaisons
(eq, ne, lt, lte, gt, gte, between) — opérateurs inline préférés.

### between(x,a,b)
Ex: between({{effort_estime}}, 1, 10) — rendu SQL: `(x BETWEEN a AND b)`
Notes côté runtime:
- Accepte bornes inversées: `between(x, 10, 1)` ≡ `between(x, 1, 10)`.
- Supporte nombres et dates; fallback lexicographique pour chaînes.

### eq(a,b)
Ex: eq({{montant}}, 10.55)
Notes côté runtime:
- Tolérance flottante `EPSILON=1e-7` (évite 10.5500001 ≠ 10.55).
- Booléens normalisés (1/0/"true"/"false").
- Dates comparées sur timestamp (getTime).

---
## 3. Arithmétique
(add, sub, mul, div, mod, negate)

### add
Ex: {{effort_estime}} + 2

### div (retour NULL si division par zéro)
Ex: {{heures_faites}} / {{heures_prevues}}

### mod
Ex: {{rang}} % 2

### negate
Ex: - {{delta}}

### case_when(cond1, val1, cond2, val2, ..., [else])
Sucre pour multiples IF imbriqués.
Ex: case_when({{score}}>=90, "A", {{score}}>=80, "B", "C")
---

### if(cond, then, else)
Ex: IF({{est_en_retard}}, "🔴", "✅")
AST: {"type":"conditional","if":...,"then":...,"else":...}

### case_when
Forme texte recommandée simplifiée non prioritaire v1. (Peut être simulée avec if imbriqués.)

---
### count_if(cond)
Sucre pour `count(*, filter=cond)`.
## 5. Agrégations (pour champs calculés de niveau collection parent)
### sum_if(expr, cond)
Sucre pour `sum(expr, filter=cond)`.
(sum, avg, min, max, count, count_distinct)
### sum(expr)
Ex: sum({{Actions.effort_estime}})

### count(*)
Ex: count(*)

### count_distinct(expr)
Ex: count_distinct({{Actions.assigne_a}})

(Remarque: Les agrégations cross-collection nécessitent le contexte relation.)

---
## 6. Dates / Temps
(today, now, date_diff, date_add, date_trunc, extract)

### today()
Ex: today()

### date_diff(unit, start, end)
Sémantique: retourne `end - start` dans l'unité demandée.
Ex: date_diff("day", {{date_creation}}, today())

### datediff(a, b, unit)
Sémantique: retourne `a - b`. Équivalence: `datediff(a,b,u) == date_diff(u,b,a)`
Ex: datediff(today(), {{date_creation}}, "day")

Unités supportées: "second", "minute", "hour", "day", "week", "month", "quarter", "year".

Notes d'implémentation: le moteur applique des CAST adaptés (DATE pour day/week/month/quarter/year, TIMESTAMP pour unités plus fines) pour éviter des erreurs de typage.

### date_add(unit,value,base)
Ex: date_add("day", 7, {{date_creation}})

### date_trunc(unit, dt)
Ex: date_trunc("month", {{date_creation}})

### extract(part, dt)
Ex: extract("year", {{date_creation}})

### start_of(unit, dt)
Ex: start_of("month", {{date_creation}}) — sucre pour début de période. Rend `DATE_TRUNC(unit, dt)` converti en DATE pour les unités de calendrier.
Unités: "day", "week" (ISO, lundi), "month", "quarter", "year".

### end_of(unit, dt)
Ex: end_of("month", {{date_creation}}) — dernier jour de la période. Rend `DATE(DATE_ADD(DATE_TRUNC(unit, dt), INTERVAL 1 unit) - INTERVAL 1 DAY)`.
Retourne une DATE.

### make_date(year, month, day)
Ex: make_date(2025, 9, 16)
Construit une date valide via `MAKE_DATE`.

---
## 7. Chaînes (minimal)
(concat, lower, upper, length, left, right, replace, regex_match, regex_extract, regex_replace)

### concat
Ex: concat({{code}}, " - ", {{titre}})

### lower
Ex: lower({{statut}})

### length
Ex: length({{description}})

### left
Ex: left({{code}}, 3) — `LEFT(code, 3)`

### right
Ex: right({{code}}, 2) — `RIGHT(code, 2)`

### replace
Ex: replace({{code}}, "-", "_") — `REPLACE(code, '-', '_')`

### regex_match
Ex: regex_match({{code}}, "^[A-Z]+$") — booléen; `REGEXP_MATCHES` (moteur RE2 de DuckDB)

### regex_extract
Ex: regex_extract({{code}}, "([A-Z]+)", 1) — extrait le groupe n°1; défaut 1 si non fourni.

### regex_replace
Ex: regex_replace({{code}}, "-\\d+$", "") — remplace via regex.

---
## 8. Conversion / Typage

### cast(expr, type)
Ex: cast({{effort_estime}}, "decimal") — rendu SQL: `CAST(expr AS DOUBLE)` (mapping types: string→VARCHAR, int→BIGINT, decimal/float/double→DOUBLE, bool→BOOLEAN, date→DATE, datetime/timestamp→TIMESTAMP)

### try_cast(expr, type)
Ex: try_cast({{valeur_brute}}, "int") — rendu SQL: `TRY_CAST(expr AS BIGINT)`
Sémantique: retourne NULL si la conversion échoue (pratique pour combiner avec `is_null`).
Exemples utiles:
- `is_null(try_cast({{valeur_id}}, "int"))` — vrai si vide, non numérique, ou NULL.
- `coalesce(try_cast({{taux}}, "double"), 0)` — remplace les conversions invalides par 0.

---
## 9. Math avancé (optionnel mais simple)
(abs, round, ceil, floor)

### abs
Ex: abs({{variation}})

### round
Ex: round({{taux_avancement}}, 2)

---
## 10. Règles de parsing simplifiées
1. Détéction des champs: regex \{\{([a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?)\}\}
2. Littéraux chaînes: "..." (échapper \" si besoin)
3. Nombres: ^[0-9]+(\.[0-9]+)?
4. Bool: true | false | null
5. Fonctions: ident(args...)
6. Opérateurs binaires supportés: + - * / % = <> != < <= > >= AND OR
7. Priorité classique (parenthèses forcées sinon ambiguïté)

---
## 11. Extensions futures (non implémentées v1)
- like/ilike
- substr / replace
- greatest / least
- array_agg / group_concat
- fonctions de fenêtrage

---
## 12. Exemples complets

### Exemple 1: Champ bool calculé retard
Texte: IF({{date_echeance}} < today(), true, false)
Intention: est_en_retard
AST (simplifié):
{
  "type":"conditional",
  "if":{"type":"binary_op","op":"<","left":{"type":"field","name":"date_echeance"},"right":{"type":"func_call","name":"today","args":[]}},
  "then":{"type":"literal","value":true,"value_type":"bool"},
  "else":{"type":"literal","value":false,"value_type":"bool"}
}

### Exemple 2: Niveau urgence simple
Texte: IF({{effort_estime}} > 8, "haute", "normale")

### Exemple 3: Somme efforts d'une phase
Texte (dans Phases): sum({{Actions.effort_estime}})

### Exemple 4: Ratio avancement
Texte: ({{heures_faites}} / NULLIF({{heures_prevues}}, 0)) * 100

---
## 13. Format registre fonctions (extrait JSON)
[
  {"name":"if","category":"conditional","args":["bool","any","any"],"return":"any"},
  {"name":"sum","category":"aggregate","args":["numeric"],"return":"numeric"},
  {"name":"date_diff","category":"date","args":["string","date","date"],"return":"int"}
]

---
## 14. Étapes prochaines
1. Écrire JSON Schema pour nœuds: literal, field, binary_op, unary_op, func_call, conditional, aggregate, in
2. Impl parser minimal (tokenizer + shunting-yard) limité aux besoins v1
3. Générateur SQL + extracteur de dépendances (collecter tous les field.name)
4. Tests unitaires: 10 expressions critiques

Fin.

---
## 15. Héritage (patterns)

Objectif: réutiliser une valeur d'une collection parente (N→1) dans l'enfant, ou cascader des valeurs par défaut le long d'une hiérarchie. Il n'existe pas de mot-clé dédié « inherit » pour l'instant, mais ces patterns fonctionnent avec le DSL actuel.

- Lookup parent (N→1): utiliser un agrégat sur un ensemble de cardinalité 1.
  - Exemple (dans `Taches`, hériter du champ `priorite` du `Projets` lié):
    - Formule (sucre recommandé): `inherit({{Projets.priorite}}, filter={{Projets.id}} = {{Taches.projet}})`
    - Équivalent historique: `max({{Projets.priorite}}, filter={{Projets.id}} = {{Taches.projet}})`
    - Intuition: un seul parent correspond; `max` renvoie cette unique valeur.
  - Variante équivalente: `min(...)` ou `count_distinct(...)` selon type; privilégier `max` pour un scalaire simple.

- Cascade avec fallback: combiner `coalesce` pour appliquer une valeur locale puis remonter si vide.
  - Exemple (dans `Taches`): `coalesce({{priorite_locale}}, max({{Projets.priorite}}, filter={{Projets.id}} = {{Taches.projet}}))`
  - Idée générale: `coalesce(valeur_locale, lookup_parent, valeur_par_defaut)`

- Remontées (1→N agrégations): déjà couvert via `sum/avg/min/max/count` avec `filter=...` côté collection parente.

Limitations et conseils:
- Multi‑saut dans une seule formule (ex: `Tache → Projet → Programme`) n'est pas supporté tel quel. Préférez un pattern en deux étapes:
  1) Dans `Projets`, calculez un champ `priorite_effective` (qui peut lui-même venir de `Programmes`).
  2) Dans `Taches`, faites le lookup sur `Projets.priorite_effective` via `max(..., filter=...)`.
- Assurez-vous que la jointure utilisée dans `filter` est bien 1→1 (clé unique) pour éviter des ambiguïtés et garantir un seul résultat.

Note future: un alias de confort `inherit(expr, filter=...)` pourrait être ajouté comme sucre syntaxique pour `max(expr, filter=...)`.
