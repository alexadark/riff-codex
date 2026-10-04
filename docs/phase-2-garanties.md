# Phase 2 : tableau des garanties de `wave` et `quick`

Date : 2026-10-04. Plan parent : [plan-riff-claude-astra.md](plan-riff-claude-astra.md).

## Décisions déjà prises pour la phase 2

- Travail dans le worktree `riff-codex-phase2`, branche `phase-2-prompting`. Fusion dans `main` seulement après validation complète.
- Skills : `dashboard` reste ; `deep-audit` sort du plugin Claude (reste côté hôte Codex) ; `incident` fusionne dans `debug` comme mode « panne en production » ; `onboard` et `map` fusionnent ; `promote` fusionne dans `start` (« transformer ce prototype en projet de production »), la commande `riff promote` reste. Résultat : 11 skills. Fusions faites le 2026-10-04 sur la branche ; README, `docs/usage.md` et `riff-documentation.html` citent encore `$riff:map`, `$riff:incident` et `$riff:promote` et seront mis à jour en phase 7.
- Amélioration automatique (validée le 2026-10-04) : à la fin de chaque phase de `wave`, 0 à 3 propositions enregistrées par `riff improve record`. Celles du projet vont dans l'état local et le dashboard, sans jamais bloquer ; celles de RIFF vont dans la boîte à idées `ideas/inbox.ndjson` du dépôt RIFF, non versionnée. `wave complete` refuse tant que le passage n'est pas enregistré, même vide. L'agent propose, il n'applique jamais.
- Design : seulement trois interdits pour l'instant (copywriting générique, dégradés violets, eyebrows). Le goût design viendra plus tard, avec une validation visuelle.
- Un seul style de prompt pour tous les modèles (décision du 2026-10-04, d'après le guide d'OpenAI pour GPT-6 Astra du 5 septembre 2026 cité par Alexandra) : but, condition de fin explicite, vérification, peu de règles, descriptions courtes. Le style `guarded` est abandonné ; les profils gardent seulement le modèle et l'effort.
- Questions de `start` (décision d'Alexandra du 2026-10-04) : `start` mène une interview produit dans les deux modes, `loop` comme `guided`, car il se passe avant le loop. Le mode autonome ne règle que les waves. L'interview porte sur le produit (utilisateurs, parcours, écrans, données et droits, exclusions, critères de réussite, design), jamais sur les faits techniques, et se termine par un résumé à confirmer. `evolve` garde ses règles actuelles. Mis à jour : le skill, `discovery.md`, `project-framing.md`, `operating-contract.md`.
- Deux idées reprises de ce guide : des tests proportionnés au changement, et une liste de tics d'écriture typiques de l'IA à éviter. Cette liste vit dans les instructions globales d'Alexandra (`claude-code-private/instructions/global-shared.md`, pour Claude et Codex), pas dans RIFF.

## Classement

Chaque règle du skill reçoit un classement :

- **CLI** : la commande `riff` la refuse ou l'impose, et un test le prouve. La règle peut sortir du skill.
- **CLI, test à ajouter** : le code l'applique, mais aucun test ne le prouve. La règle sort seulement après l'ajout du test.
- **CLI partielle** : la CLI couvre une partie (souvent seulement les projets inscrits au contrat discovery). Le reste reste une consigne.
- **Consigne** : rien ne l'applique hors du prompt. La règle reste dans le skill ou dans une référence.

Les tests cités sont dans `test/` : `riff-codex.test.mjs` (RC), `delivery-cli.test.mjs` (DC), `delivery-contract.test.mjs` (DK), `evolve-planning.test.mjs` (EP), `model-advice.test.mjs` (MA), `model-advice-plan.test.mjs` (MAP). Le numéro est la ligne du test.

## `wave` (57 règles)

### Conseil de modèle

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W1 | Une demande de conseil seul s'arrête sans activer de phase | Consigne | La CLI ne connaît pas l'intention |
| W2 | Consulter le conseil à la frontière de phase | Consigne | |
| W3 | Jamais d'appel payant (Jev) sans consentement explicite | CLI | MA 65, MAP 65 |
| W4 | Jamais de changement automatique de modèle | CLI | MAP 27 : le plan prépare l'envoi sans l'exécuter |
| W5 | Réutiliser un conseil inchangé après une reprise | CLI | MA 86, MAP 41 |
| W6 | Jamais de pause ajoutée en mode `loop` | CLI partielle | RC 388 limite les arrêts enregistrés aux 4 motifs durs ; rien n'empêche de s'arrêter pour poser une question dans le chat |

### Goût et références

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W7 | Lire `taste.md` et seulement les sujets utiles | Consigne | |
| W8 | Front : skills de design et preuve rendue dans un navigateur | CLI partielle | RC 581 et RC 654 pour une phase `smoke_test` ; aucune vérification pour une phase UI non marquée |
| W9 | Enregistrer les conventions prouvées avant la validation, sans file d'approbation | Consigne | |
| W10 | Lire le contrat d'exécution, l'exécution et le routage de modèles | Consigne | |
| W11 | `PROJECT.md` sert d'index ; charger seulement la phase choisie | Consigne | |
| W12 | Charger la référence sécurité pour une phase sensible | Consigne | |
| W13 | Un projet inscrit doit passer `discovery check` avant activation | CLI | DC 97 |
| W14 | Finir la planification et le design avant de construire | Consigne | |
| W15 | Un projet non inscrit garde son contrat d'origine | CLI | EP 78 |

### Étape 1 : préparation

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W16 | Établir la branche d'intégration avant d'implémenter | Consigne | |
| W17 | `wave sync`, puis `resume` ou `select` | Consigne | C'est la procédure elle-même |
| W18 | Ne pas contourner les dépendances | CLI | RC « activation refuses unready phases… » et RC 525 |
| W19 | Réutiliser les leçons applicables | Consigne | |
| W20 | À la reprise, préserver les fichiers en cours et lire le résultat | CLI partielle | RC 627 préserve le travail non commité ; lire le résultat reste une consigne |
| W21 | Une phase déjà vérifiée peut avoir été complétée par la reprise | CLI | RC 627 |

### Étape 2 : implémentation

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W22 | Lire `wave context`, fixer les paquets et qui les possède | Consigne | |
| W23 | Lancer `model-advice plan` sauf si le conseil est coupé | Consigne | Le côté payant est couvert par W3 |
| W24 | Réutiliser les décisions de rôle inchangées | CLI | MAP 41 |
| W25 | Appliquer les profils `dispatch` par les sous-agents natifs ; le modèle principal reste manuel | Consigne | Dépend de l'hôte, ira dans l'intégration Claude Code |
| W26 | Livrer le résultat complet et démontrable, réutiliser l'existant, préserver le comportement | Consigne | Le cœur du travail |
| W27 | Déléguer seulement les gros paquets indépendants ; écrivains parallèles en worktrees séparés ; l'agent principal intègre | Consigne | |
| W28 | Phases séquentielles | CLI | RC « activation refuses unready phases and a second active phase » |
| W29 | Vérifier le résultat assemblé, pas seulement les sorties des sous-agents | Consigne | |

### Étape 3 : validation

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W30 | Leçons et tri des observations avant de figer le candidat | CLI partielle | DC 120 et DC 150 l'imposent à la complétion pour un projet inscrit |
| W31 | Figer le candidat, `wave validate --run` avec des chemins explicites | CLI | RC 525 : validation exécutée exigée, périmètre des chemins contrôlé |
| W32 | Parcours UI modifiés : captures, manifeste, rapport HTML | CLI partielle | RC 581, RC 654 pour une phase marquée ; consigne sinon |
| W33 | `smoke_test: true` exige des preuves de parcours | CLI | RC 654 |
| W34 | Réutiliser les checks déjà faits pour le même candidat | Consigne | Économie, pas sécurité |
| W35 | `wave retry` seulement après un échec enregistré ; pas de tentative identique ; pas de remise à zéro par la reprise | CLI | DC 172 |

### Étape 4 : reviews

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W36a | Reçu de review fonctionnelle obligatoire | CLI | RC 525 |
| W36b | Reçu de review sécurité obligatoire pour une phase sensible | CLI | RC « completion rejects missing security receipts… » : le hook Git bloque le commit, puis `wave complete` refuse |
| W36c | Les reviews sont **indépendantes** | Consigne | La CLI vérifie seulement le champ déclaré `independent: true` (RC 525) ; elle ne peut pas vérifier qui a vraiment relu |
| W37 | Les reviews peuvent tourner en parallèle | Consigne | Conseil d'efficacité |
| W38 | Contenu de la review : critères, régressions, réutilisation, fidélité au design, observations | Consigne | Ira dans le gabarit du pont de review (phase 4) |
| W39 | Un candidat modifié invalide les reçus | CLI | Même test : le hook Git et `wave complete` refusent un reçu pris sur l'ancien candidat |
| W40 | Un finding HIGH ou CRITICAL bloque | CLI | DC 120 pour les observations ; même test RC pour une review `pass` contenant un HIGH |
| W41 | Lire les observations des checks et des reviews avant la complétion | CLI partielle | DC 120, DC 150 pour un projet inscrit |

### Étape 5 : complétion

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W42 | `wave checkpoint` avec résumé et prochaine action | CLI partielle | DC 120 pour un projet inscrit ; consigne pour les autres |
| W43 | Commiter l'arbre relu, puis `wave complete --commit HEAD` | CLI | RC 525 |
| W44 | Écrire `EXPLAIN-POST.simple.md` | Consigne | |
| W45 | PR brouillon après la 1re phase si autorisé, puis la même PR ; vérifier l'identité distante | Consigne | |
| W46 | Sans autorisation, continuer en local | Consigne | |

### Étape 6 : enchaînement et fin

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W47 | En `loop`, ne pas demander de test ni d'approbation ; une PR ne met pas en pause | CLI partielle | RC 388, comme W6 |
| W48 | En `guided`, s'arrêter aux frontières du contrat | CLI partielle | RC 448 |
| W49 | Après la dernière phase : vérification globale et review de livraison (`finish --review`, `finish --check`) | CLI | DC 120 |
| W50 | Corriger les défauts trouvés par une phase de correction explicite | Consigne | |
| W51 | Publier la tête finale, passer la PR en prête, rapporter le vrai résultat | Consigne | |
| W52 | Merge et déploiement restent des actions séparées | Consigne | |

### Tri des observations et interdits finaux

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| W53 | Tri par l'agent à chaque phase ; ne pas déléguer les jugements techniques ; ne pas marquer résolu sans vérifier | CLI partielle | DC 150, RC 688 pour la note de tri ; « sans vérifier » reste une consigne |
| W54 | Jamais de `codex exec` imbriqué | Consigne | Devient « jamais d'hôte qui se relance lui-même », hors pont de review |
| W55 | Jamais de planificateur | Consigne | |
| W56 | Jamais d'issue GitHub sans `$riff:issue` | Consigne | |
| W57 | Jamais de commande publique `next` | CLI | `riff next` refuse déjà (`bin/riff.mjs`) ; la règle peut disparaître |
| W58 | Passage d'amélioration en fin de phase : 0 à 3 propositions, sans doublon, jamais appliquées | CLI pour l'existence, le plafond et les doublons ; consigne pour la qualité | RC « phase completion requires… » (refus sans passage), RC « improvement pass caps proposals… » |

### Bilan `wave`

- **Sortent du skill** (CLI prouvée) : W3, W4, W5, W13, W15, W21, W24, W31, W33, W35, W36a, W43, W49, W57. Ce sont exactement les phrases qui alourdissent le plus le skill actuel.
- **Sortent aussi, tests ajoutés le 2026-10-04** : W18, W28, W36b, W39, W40. Les tests montrent que le hook Git pre-commit bloque déjà un commit sans reçu de sécurité ou avec un reçu périmé : la garantie est double.
- **Partielles** : la CLI couvre les projets inscrits, mais pas les anciens. Le skill garde une phrase courte (« checkpoint, tri des observations, preuve rendue pour l'UI ») pour les projets non inscrits.
- **Consignes** : elles restent, regroupées sous « but, condition de fin, vérification ». La plupart sont des procédures (références à lire, Git, PR) qui peuvent descendre dans les références.

## `quick` (15 règles)

`quick` n'a **aucune commande dans la CLI**. Sa validation et sa review ne sont enregistrées nulle part. Seul le hook Git pre-commit le protège.

| # | Règle | Classement | Preuve |
| --- | --- | --- | --- |
| Q1 | Suivre le contrat de conseil ; une demande de conseil seul s'arrête | Consigne | |
| Q2 | Conseil optionnel, choix explicites préservés, pas de changement de modèle | CLI | MA 48, MAP 27 |
| Q3 | Lire le goût ; UI : skills de design et checks rendus | Consigne | |
| Q4 | Enregistrer une leçon prouvée, proportionnée au changement | Consigne | |
| Q5 | Seulement pour un changement borné qui ne touche pas le roadmap | Consigne | |
| Q6 | Branche dédiée avant d'implémenter | Consigne | |
| Q7 | Un seul écrivain, valider seulement ce qui change, review fonctionnelle fraîche | Consigne | Rien n'enregistre ni la validation ni la review |
| Q8 | Référence sécurité si la zone est sensible | Consigne | |
| Q9 | Réutiliser les leçons (`learning.md`) | Consigne | |
| Q10 | Parcours UI : captures réelles et rapport HTML, jamais de captures inventées | Consigne | `riff report` refuse un manifeste invalide (RC 581), mais `quick` n'est pas obligé de l'appeler |
| Q11 | Tri des observations avant de finir | Consigne | |
| Q12 | Un seul commit atomique, sans secret ni fichier d'environnement | CLI partielle | Le hook pre-commit bloque secrets, `.env` et findings HIGH (RC 302, RC 327, RC 341, RC 356) ; « atomique » reste une consigne |
| Q13 | Les événements passent seulement par les hooks normaux | Consigne | |
| Q14 | PR si autorisé, URL vérifiée, ne jamais annoncer merge ni déploiement | Consigne | |
| Q15 | Si le périmètre grossit, s'arrêter et proposer `add-phase` | Consigne | |

### Bilan `quick`

- Presque rien ne peut sortir : seule Q2 est prouvée par la CLI.
- `quick` peut quand même raccourcir en déplaçant les procédures (conseil de modèle, Git, rapport) dans les références.
- **Décision (2026-10-04)** : pas de reçu dans la CLI pour `quick`. Alexandra préfère le moins de cérémonie possible. Sa validation et sa review restent des consignes du skill, et c'est la garantie la plus faible de RIFF, acceptée pour des changements bornés.

## `start` (25 règles, plus 10 venues de `promote`)

Comparé ligne à ligne avec `git show main:riff/skills/start/SKILL.md` et `main:riff/skills/promote/SKILL.md`. « Gardée » veut dire que la nouvelle version la contient encore ; « référence » veut dire qu'elle vit dans une référence citée par le skill.

| # | Règle | Classement | Où elle est maintenant |
| --- | --- | --- | --- |
| S1 | Choisir le chemin : dossier complet sur demande explicite ou application de production, sinon chemin léger ; la demande explicite l'emporte | Consigne | Gardée (But) |
| S2 | Un prototype de risque reste isolé, jamais une phase cachée | Consigne | Gardée (But) |
| S3 | `doctor`, puis lire mode, dépôt, `PROJECT.md`, `ROADMAP.yaml`, docs et goût avant toute question | Consigne | Gardée (étape 1) |
| S4 | Dossier complet ou production : établir ou fusionner `taste.md` ; UI : direction frontend et skills de design | Consigne | Gardée (étape 2) |
| S5 | Chemin léger : lire le goût existant sans créer de fichiers de production | Consigne | Gardée (étape 2) |
| S6 | Préserver les specs existantes et les changements sans rapport | Consigne | Gardée (étape 4) |
| S7 | Les faits techniques viennent du dépôt, du gabarit, du goût et de la stack, pas de l'utilisateur | Consigne | Gardée (étape 1) |
| S8 | `loop` : plus petit choix réversible, hypothèse notée, pas de confirmation, jamais `awaiting_human` ; seuls les blocages durs arrêtent | Consigne | Remplacée le 2026-10-04 par décision d'Alexandra : interview produit dans les deux modes (étape 3). Après la confirmation du résumé, plus de question ; seuls les blocages durs arrêtent |
| S9 | `guided` : présenter le résumé et faire confirmer avant de figer | Consigne | Étendue aux deux modes (étape 3) |
| S10 | Dossier complet avant toute phase | CLI pour un projet inscrit | DC 101 : `wave activate` refuse sans `discovery check` |
| S11 | `PROJECT.md` synthèse et index, `ROADMAP.yaml` liste canonique, détails liés et non copiés | Consigne | Gardée (étape 4) |
| S12 | Contenu du dossier (stories, parcours, wireframes, données, architecture, risques, diagrammes Mermaid, design) | Consigne | Gardée en une phrase à l'étape 5 ; le détail reste dans `discovery.md`, « Dossier quality bar » |
| S13 | Chaque zone a des fichiers utiles ou une raison `not_applicable` | CLI partielle | DK 23 prouve la structure et les fichiers ; l'utilité reste une consigne (Done when) |
| S14 | Jamais de section bouche-trou | Consigne | Gardée (étape 4) |
| S15 | Référence externe absente : continuer, noter la dépendance, ne rien inventer | Consigne | Gardée (étape 4, Verify) |
| S16 | Design RIFF seulement sur autorisation | Consigne | Gardée (étape 4) |
| S17 | Écrire `PROJECT.md` et `ROADMAP.yaml` ; chaque phase a `done_when` et `verify` | CLI partielle | RC 791 : `doctor` signale une phase sans eux ; gardée (Done when, Verify) |
| S18 | `wave sync` et artefacts lisibles | Consigne | Gardée (Done when) |
| S19 | `EXPLAIN.simple.md` par phase | Consigne | Gardée (Done when) |
| S20 | Manifeste, snapshot, review, corrections, check | CLI partielle | DC 101 et DK 23 ; l'indépendance du relecteur reste une consigne (Verify) |
| S21 | La preuve de review atteste, elle ne prouve pas le produit | Consigne | Gardée (Verify) |
| S22 | `start` s'arrête et n'active jamais de phase | Consigne | Gardée (But, Done when) |
| S23 | Pas d'issue ni d'artefact externe sans demande | Consigne | Gardée |
| S24 | Conseil de modèle : demande seule s'arrête, pas de changement de modèle, pas de pause en `loop` | CLI partielle | Comme Q2 (MA 48, MAP 27) ; gardée |
| S25 | Compaction native, pas de `codex exec` imbriqué | Consigne | Compaction : référence `execution.md` (vocabulaire Codex, phase 3). `codex exec` devient « ne pas relancer son propre hôte », comme dans `wave` |
| P1 | `riff promote` pour voir le périmètre ; déjà en production, s'arrêter | CLI | RC 609 ; gardée (étape 6) |
| P2 | Limites de production dans les trois fichiers partagés, décisions existantes gardées | CLI partielle | La CLI exige les trois fichiers non vides et indexés ; le contenu reste une consigne (étape 6) |
| P3 | Résoudre les phases actives et les blocages avant | CLI | RC 821 (ajouté le 2026-10-04) ; gardée en une phrase pour éviter le refus |
| P4 | Reviews architecture, roadmap, fonctionnelle, et sécurité pour un projet sensible | CLI | RC 609 et RC 821 ; l'indépendance reste une consigne |
| P5 | Vérifier le périmètre et `INCIDENTS.md` après | Consigne | Gardée (étape 6) |
| P6 | Dire ce qui reste invérifié hors du dépôt | Consigne | Gardée (rapport) |
| P7 | Seulement sur demande explicite, jamais pour un push, un déploiement, un audit | Consigne | Gardée (But) |
| P8 | La promotion n'autorise ni push, ni merge, ni déploiement, ni publication | Consigne | Gardée |
| P9 | Une finalisation Git ultérieure passe d'abord par `finish --check` | Consigne | Perdue dans la fusion, remise le 2026-10-04 |
| P10 | Charger la référence sécurité | CLI partielle | La CLI détecte un projet sensible et exige `--security` ; `security.md` est dans les références |

### Bilan `start`

- Aucune garantie perdue. P9 avait disparu lors de la fusion avec `promote` et revient.
- Le contenu du dossier (S12) tient en une phrase à l'étape 5 ; le détail reste dans `discovery.md`.
- Seul changement de comportement : l'interview produit (S8, S9), décidée par Alexandra.
- Taille : 6,6 Ko, comme l'ancien `start` et l'ancien `promote` réunis (6,6 Ko) pour l'ancien `start` et `promote` réunis.

## Tests ajoutés

Deux tests dans `test/riff-codex.test.mjs` couvrent W18, W28, W36b, W39 et W40, un troisième couvre W58, un quatrième (RC 821) couvre P3 et P4. Suite complète : 59 tests passent (`npm test`).

## Avancement au 2026-10-04 (branche `phase-2-prompting`)

Fait et testé (58 tests CLI, 2 tests dashboard) :

- Tableau des garanties et cinq tests qui prouvent les règles retirées de `wave`.
- Passage d'amélioration en fin de phase (`riff improve`), visible dans le dashboard, boîte à idées `ideas/inbox.ndjson`.
- `done_when` et `verify` dans le roadmap, transmis par `wave context`, signalés par `doctor`, écrits par `start`, `evolve` et `add-phase`.
- Lien `.riff-cli` créé dans tous les projets par `resync`, même sans migration de l'état ; les skills et références citent `.riff-cli/`.
- Catalogue de modèles sans préférence de fournisseur, profil Opus `max` retiré.
- Principe de goût pour le code et trois interdits design.
- Fusions : `incident` dans `debug`, `map` dans `onboard`, `promote` dans `start` ; `resync` retire les liens des skills supprimés.
- Brouillons de `wave` (4,4 Ko contre 6,2 Ko) et `quick` (2,4 Ko) au gabarit « but, condition de fin, vérification », ton validé par Alexandra. `debug` et `onboard` sont aussi au gabarit.
- Skills nommés sans syntaxe d'hôte (« le skill `wave` » au lieu de `$riff:wave`), dossier d'état cité `.riff-data/`, branches créées en `riff/<change>`.
- Comparaison avant/après (Opus 5.5, effort medium, un essai par cas) : les deux versions vont au bout sans question et évitent le piège `src/dates.js`. La nouvelle fait en plus la review indépendante de `quick` (sautée par l'ancienne) et le passage d'amélioration de `wave` (absent dans l'ancienne). Coût : `quick` 0,64 $ contre 0,41 $, `wave` 2,27 $ contre 2,03 $. Les deux `wave` ont réparé le script `npm test` cassé du projet de test pour que la validation passe, et l'ont signalé.

Reste :

1. Réécriture au gabarit des autres skills (`start` fait, ton à relire par Alexandra) : `evolve`, `add-phase`, `learn-stack`, `issue`, `status`, `dashboard`.
2. Avant la fusion dans `main` : `riff resync` dans chaque projet connecté pour créer `.riff-cli` (accord d'Alexandra requis), puis mise à jour de la documentation en phase 7.
