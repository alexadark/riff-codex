# Phase 2 : tableau des garanties de `wave` et `quick`

Date : 2026-10-04. Plan parent : [plan-riff-claude-astra.md](plan-riff-claude-astra.md).

## Décisions déjà prises pour la phase 2

- Travail dans le worktree `riff-codex-phase2`, branche `phase-2-prompting`. Fusion dans `main` seulement après validation complète.
- Skills : `dashboard` reste ; `deep-audit` sort du plugin Claude (reste côté hôte Codex) ; `incident` fusionne dans `debug` comme mode « panne en production » ; `onboard` et `map` fusionnent ; `promote` fusionne dans `start` (« transformer ce prototype en projet de production »), la commande `riff promote` reste. Résultat : 11 skills. Fusions faites le 2026-10-04 sur la branche ; README, `docs/usage.md` et `riff-documentation.html` citent encore `$riff:map`, `$riff:incident` et `$riff:promote` et seront mis à jour en phase 7.
- Amélioration automatique (validée le 2026-10-04) : à la fin de chaque phase de `wave`, 0 à 3 propositions enregistrées par `riff improve record`. Celles du projet vont dans l'état local et le dashboard, sans jamais bloquer ; celles de RIFF vont dans la boîte à idées `ideas/inbox.ndjson` du dépôt RIFF, non versionnée. `wave complete` refuse tant que le passage n'est pas enregistré, même vide. L'agent propose, il n'applique jamais.
- Design : seulement trois interdits pour l'instant (copywriting générique, dégradés violets, eyebrows). Le goût design viendra plus tard, avec une validation visuelle.
- Un seul style de prompt pour tous les modèles (décision du 2026-10-04, d'après le guide d'OpenAI pour GPT-6 Astra du 5 septembre 2026 cité par Alexandra) : but, condition de fin explicite, vérification, peu de règles, descriptions courtes. Le style `guarded` est abandonné ; les profils gardent seulement le modèle et l'effort.
- Questions de `start` (décision d'Alexandra du 2026-10-04) : `start` mène une interview produit dans les deux modes, `loop` comme `guided`, car il se passe avant le loop. Le mode autonome ne règle que les waves. L'interview porte sur le produit (utilisateurs, parcours, écrans, données et droits, exclusions, critères de réussite, design), jamais sur les faits techniques que le dépôt établit, et se termine par un résumé à confirmer. Sans code existant (départ d'une simple idée), l'interview couvre aussi la stack : options, compromis et recommandation, NowStack par défaut quand il convient ; le choix est noté comme décision et la première phase l'installe. Pour ce départ, `riff init` crée lui-même le dépôt Git dans un dossier vide ou inexistant ; un dossier non vide sans Git exige `--git-init` (test RC en fin de fichier). La doc d'installation, qui demande encore un `git init` préalable, sera mise à jour en phase 7. Étendu à `evolve` le même jour, à la demande d'Alexandra. Mis à jour : les deux skills, `discovery.md`, `project-framing.md`, `operating-contract.md`, `evolution.md`.
- Questions de `add-phase` (décision d'Alexandra du 2026-10-04) : 1 à 3 questions courtes seulement si le résultat, la priorité ou les critères sont flous, dans les deux modes, quand elle lance le skill elle-même. Aucune question quand une wave ajoute une phase de correction.
- Deux idées reprises de ce guide : des tests proportionnés au changement, et une liste de tics d'écriture typiques de l'IA à éviter. Cette liste vit dans les instructions globales d'Alexandra (`claude-code-private/instructions/global-shared.md`, pour Claude et Codex), pas dans RIFF.

## Classement

Chaque règle du skill reçoit un classement :

- **CLI** : la commande `riff` la refuse ou l'impose, et un test le prouve. La règle peut sortir du skill.
- **CLI, test à ajouter** : le code l'applique, mais aucun test ne le prouve. La règle sort seulement après l'ajout du test.
- **CLI partielle** : la CLI couvre une partie (souvent seulement les projets inscrits au contrat discovery). Le reste reste une consigne.
- **Consigne** : rien ne l'applique hors du prompt. La règle reste dans le skill ou dans une référence.

Les tests cités sont dans `test/` : `riff-codex.test.mjs` (RC), `delivery-cli.test.mjs` (DC), `delivery-contract.test.mjs` (DK), `evolve-planning.test.mjs` (EP), `evolve-sync.test.mjs` (ES), `model-advice.test.mjs` (MA), `model-advice-plan.test.mjs` (MAP). Le numéro est la ligne du test.

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

## `evolve` (24 règles)

Comparé ligne à ligne avec `git show main:riff/skills/evolve/SKILL.md`.

| # | Règle | Classement | Où elle est maintenant |
| --- | --- | --- | --- |
| E1 | `doctor` et `status` ; exiger `PROJECT.md`, `ROADMAP.yaml` et l'état ; sinon nommer l'étape suivante sans la faire | Consigne | Gardée (étape 1) |
| E2 | Inspecter la base réelle et l'état CLI avant de modifier | Consigne | Gardée (étapes 1, 2 ; Verify) |
| E3 | Exploration ou autorisation ; la suggestion d'un collaborateur est une entrée ; une exploration ne modifie rien | Consigne | Gardée (But) |
| E4 | Problème, utilisateurs, résultat, demandes concurrentes, plus petit périmètre, exclusions ; réutiliser le travail déjà prévu | Consigne | Gardée (Done when) |
| E5 | `loop` sans question, `guided` avec questions décisives et confirmation | Consigne | Remplacée le 2026-10-04 par décision d'Alexandra : interview produit dans les deux modes, puis résumé à confirmer (étapes 3, 4) |
| E6 | Lire le goût et les seules références utiles ; réutiliser la carte après contrôle de dérive | Consigne | Gardée (étape 2) |
| E7 | Expliquer l'actuel et le proposé, conséquences pour utilisateurs, données, droits, parcours, intégrations, reprise ; distinguer preuve, inférence et dépendance | Consigne | Gardée (étapes 3, 4) |
| E8 | Critères observables pour le nouveau résultat et pour l'existant touché | Consigne | Gardée (Done when) |
| E9 | Ne modifier que le contenu touché et les phases en attente ; `done_when` et `verify` | CLI partielle | RC 791 pour `done_when` et `verify` ; gardée (Done when) |
| E10 | Préserver contrats actifs et terminés, preuves, IDs stables, format YAML et champs inconnus | CLI partielle | ES 59 (contrat protégé, historique non supprimable), ES 217 (reçus et champs inconnus) ; format YAML et IDs non recyclés restent des consignes (étape 5) |
| E11 | Règles de remplacement des phases en attente ; jamais de statut inventé | CLI partielle | ES 217 ; référence `evolution.md` ; gardée (étape 5) |
| E12 | Conflit avec un travail actif : brouillon hors du dossier vivant jusqu'à une frontière sûre ; ne pas interrompre | CLI partielle | ES 59 protège le contrat actif ; le reste est une consigne (étape 6) |
| E13 | `wave sync` et `EXPLAIN.simple.md` touchés | Consigne | Gardée (Done when, étape 7) |
| E14 | Projet inscrit : manifeste, review indépendante, `discovery check` | CLI | EP 78 et DC 101 : une review périmée bloque l'activation ; l'indépendance reste une consigne (Verify) |
| E15 | Demande explicite de version complète : contrat discovery | Consigne | Gardée (Done when) |
| E16 | Changement borné d'une application non inscrite : chemin léger, jamais présenté comme discovery | CLI partielle | EP 78 : reste non inscrite ; la présentation reste une consigne (Done when) |
| E17 | Rapport : résultat, hypothèses, phases, comportement gardé, checks réels, `wave` seulement si prêt | Consigne | Gardée |
| E18 | S'arrêter après la planification ; jamais d'activation, d'implémentation, d'issue ni de déploiement | Consigne | Gardée (Done when, interdits) |
| E19 | Règles de blocage et de reprise du contrat d'exécution, pas de second système d'état | Consigne | Gardée (étapes 4, 7) |
| E20 | Conseil de modèle : la demande seule n'autorise rien, pas d'enregistrement en exploration, pas de changement de modèle ni de pause | CLI partielle | Comme Q2 (MA 48, MAP 27) ; gardée |
| E21 | Compaction native, travail sans rapport préservé | Consigne | Compaction : référence `execution.md` (vocabulaire Codex, phase 3) ; préservation gardée |
| E22 | Ne pas refaire la discovery pour ce qui n'est pas touché | Consigne | Gardée (étape 5) |
| E23 | Analyse du changement enregistrée dans les specs, liée depuis `PROJECT.md` | Consigne | Gardée (Done when) ; détail dans `evolution.md` |
| E24 | Pas pour la définition initiale, l'ajout simple d'une phase ni l'implémentation | Consigne | Gardée (description, But) |

### Bilan `evolve`

- Aucune garantie perdue. Seul changement de comportement : l'interview produit dans les deux modes (E5), décidée par Alexandra.
- Taille : 5,8 Ko contre 4,4 Ko. La hausse vient de l'interview et des sections « Done when » et « Verify », absentes de l'ancien texte.

## `add-phase` (15 règles)

| # | Règle | Classement | Où elle est maintenant |
| --- | --- | --- | --- |
| A1 | Un seul résultat compris et indépendant ; sinon `evolve`, jamais d'ajout à l'aveugle | Consigne | Gardée (But) |
| A2 | Lire `PROJECT.md`, `ROADMAP.yaml`, l'état et le mode ; gros projet : référence de cadrage et réutilisation | Consigne | Gardée (étape 1) |
| A3 | Dans le périmètre et pas déjà couvert | Consigne | Gardée (Done when) |
| A4 | `loop` : détails tranchés prudemment, sans question | Consigne | Remplacée le 2026-10-04 par décision d'Alexandra : 1 à 3 questions si le résultat, la priorité ou les critères sont flous, dans les deux modes, seulement quand elle lance le skill ; aucune question pour une phase de correction ajoutée par une wave (étape 2) |
| A5 | Résultat qui élargit le produit sans autorisation : rien ajouté, signalé, jamais `awaiting_human` | Consigne | Gardée (étape 3) |
| A6 | `guided` : demander avant un changement produit important | Consigne | Gardée (« guided keeps its confirmations ») et couverte par l'étape 2 |
| A7 | Phase verticale avec `done_when`, `verify`, priorité P0 à P3 justifiée, dépendances réelles, risques, sensibilité, exclusions | CLI partielle | RC 791 pour `done_when` et `verify` ; la CLI exige une priorité valide (`normalizeRoadmapPriority`) sans test ; la justification reste une consigne (Done when) |
| A8 | Gros projet : lier aux stories et critères, détailler seulement l'utile | Consigne | Gardée (étape 4) |
| A9 | Ne pas hériter la priorité des voisines | Consigne | Gardée (Done when) |
| A10 | Format du roadmap, commentaires, ordre des clés, champs inconnus ; pas de conversion `phase-*` ↔ `phases` ; pas de renumérotation | CLI partielle | RC 231 : `wave sync` ne réécrit aucun des deux formats ; l'édition par l'agent reste une consigne (Verify) |
| A11 | `wave sync` et dire quand la phase est prête | Consigne | Gardée (Done when) |
| A12 | S'arrêter seulement pour un blocage dur | Consigne | Gardée |
| A13 | Projet inscrit : mapping, review indépendante, `discovery check` | CLI | DC 101, EP 78 ; l'indépendance reste une consigne |
| A14 | Défaut trouvé en vérification finale : phase de correction sans nouvelle approbation, historique intact | CLI partielle | ES 59 protège l'historique ; gardée (étape 5) |
| A15 | Paquets indépendants nommés, une seule phase active, pas de plan fichier par fichier | CLI partielle | RC « activation refuses… a second active phase » ; gardée (étape 4) |

## `learn-stack` (21 règles)

Aucune commande ne contrôle ce skill : toutes les règles sont des consignes et toutes restent dans le skill. Comparaison ligne à ligne avec `git show main:riff/skills/learn-stack/SKILL.md` :

- Inférence de la stack, variante NowStack, stack nommée pas encore installée, rapport sans fichier en `loop` si rien n'est identifiable : étape 1.
- Lire goût et notes existants, `stack-notes.md` comme pistes sans supprimer : étape 2.
- Recherche limitée au sujet, documentation des mainteneurs, meilleur code de référence à la version installée, activité récente et usage réel plutôt que les étoiles : étape 3.
- Étiquettes `[official]`, `[project]`, `[example]` et inférence signalée, affirmations sans source exclues : Done when.
- Liens, version et affirmations vérifiés ; pas de nombre fixe de sources ; une source pauvre n'autorise pas l'invention ; accès manquant = blocage : Verify.
- Écrire seulement dans le projet courant, slug contrôlé, cible hors projet laissée intacte, même frontière pour les deux index : étape 4.
- Contenu attendu du fichier, ligne d'index, lien depuis `taste.md`, index minimal créé si absent : Done when.
- Fusion prudente et idempotente, sections par version, correction justifiée, pas de question en `loop` : étape 5.
- Pas d'implémentation, de mise à jour de dépendance, de déploiement ni de promotion dans RIFF : But.
- Dans une wave active, les modifications du goût entrent dans le candidat avant les reçus : étape 6.
- Rapport des chemins, règles clés et lacunes : fin du skill.

## `issue` (8 règles)

Aucune commande RIFF ne publie sur GitHub : toutes les règles sont des consignes et restent dans le skill. Publication seulement sur demande explicite, jamais parce que `start`, `add-phase` ou `wave` a tourné (But, étape 1) ; dépôt déduit du remote, jamais deviné (étape 2) ; regroupement par résultat avec stories, critères, frontières, intégrations, dépendances, exclusions et validation (Done when) ; exclusions de contenu (étape 3) ; `gh auth status`, recherche de doublon, blocage si accès absent (étapes 2, 4) ; relecture du titre, du dépôt, du numéro et de l'URL, rapport séparé (Verify) ; aucune phase ajoutée, aucun état modifié, aucun contrôle contourné (Done when, fin). Changement : un nouveau périmètre renvoie à `add-phase` ou `evolve`, au lieu de `add-phase` seul.

## `status` et `dashboard`

- `status` : rapport de la phase active, du nombre terminé, de la suivante, du travail parqué ou bloqué, des preuves périmées et de l'action attendue (Done when) ; détails par l'instantané du dashboard et `events.ndjson` (étape 2) ; ne jamais faire avancer le roadmap (étape 3, et `riff status` ne fait que lire). Ajout : lire `riff status --json`, car la sortie texte ne montre ni les phases parquées ni la validité des reviews ; ne rapporter que ce que montrent les commandes.
- `dashboard` : aucun appel de modèle (en-tête) ; ne jamais modifier roadmap ou état, décisions d'observation par le formulaire (fin) ; colonnes fixes, statut lu dans l'état et non le roadmap, badge de priorité seulement si déclarée (Verify, pour un résumé en texte ; l'interface les applique déjà dans `dashboard/public/app.js`). `--snapshot` ne fait que lire.

### Bilan des cinq derniers skills

- Aucune garantie perdue. Un seul changement de comportement : les questions de `add-phase` (A4), décidées par Alexandra.
- Tailles (avant, après) : `add-phase` 2,8 → 3,2 Ko, `learn-stack` 4,0 → 3,7 Ko, `issue` 1,9 → 2,1 Ko, `status` 0,5 → 1,1 Ko, `dashboard` 1,1 → 1,3 Ko. Les petits skills grossissent un peu avec les sections du gabarit.

## Tests ajoutés

Deux tests dans `test/riff-codex.test.mjs` couvrent W18, W28, W36b, W39 et W40, un troisième couvre W58, un quatrième (RC 821) couvre P3 et P4, un cinquième la création du dépôt Git par `riff init`. Suite complète : 60 tests passent (`npm test`).

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

1. Réécriture au gabarit : faite et validée par Alexandra le 2026-10-04 pour tous les skills.
2. Avant la fusion dans `main` : `riff resync` dans chaque projet connecté pour créer `.riff-cli` (accord d'Alexandra requis), puis mise à jour de la documentation en phase 7.
