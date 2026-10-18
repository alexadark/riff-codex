# Audit RIFF : vitesse, parallélisme, qualité finale

Date : 2026-10-18. Objectif : que RIFF tourne le plus vite possible, lance un maximum d'agents en parallèle, sans dégrader le résultat final.

## Verdict

Le goulot principal n'est pas le modèle, c'est la structure : une seule phase active à la fois, une délégation découragée, une cérémonie de choix de modèle avant chaque délégation, et des reviews lancées en série qui bloquent le terminal. Les garde-fous qui assurent la qualité (état CLI, `done_when`/`verify`, preuve navigateur, review indépendante liée au candidat, goût) sont structurels et doivent rester. Le reste peut fondre.

## 1. Ce qui ralentit le plus (par impact)

### 1.1 Une seule phase active à la fois

- `operating-contract.md` : « One roadmap phase is active at a time ». `execution.md` : « Do not … execute multiple roadmap phases at once ».
- Le CLI le code en dur : `state.phases.find(status === 'active')`, un seul `state.activeWave`, `selectReadyPhase` renvoie une seule phase.
- Conséquence : deux phases sans dépendance entre elles (par exemple « profil utilisateur » et « export CSV ») s'enchaînent alors qu'elles pourraient tourner ensemble.
- C'est le plus gros levier de vitesse, et il ne coûte rien en qualité : chaque phase garde sa validation, sa review et son commit.

### 1.2 Délégation découragée dans une phase

- `execution.md` : « Do not turn every phase into a mandatory multi-agent exercise », « Delegate independent work only when it adds value ».
- Avec Opus 5.5 comme intégrateur, le risque d'une mauvaise intégration a baissé. Le texte pousse encore au mode un seul écrivain.

### 1.3 La cérémonie de choix de modèle

- `model-routing.md` (10,5 Ko), `model-advice-input.md` (7,9 Ko), `model-profiles.json` (11,5 Ko), plus `riff model-advice plan --input -` avant chaque délégation.
- Ça représente environ 30 Ko de texte à lire, plus un JSON à construire, juste pour décider quel sous-agent lancer. Les sous-agents `riff:<profil>` existent déjà avec modèle et effort figés.
- Une table de cinq lignes suffit (voir 3.3).

### 1.4 Reviews en série et bloquantes

- `review-bridge.mjs` utilise `spawnSync` avec un timeout de 1200 s : le terminal reste bloqué pendant toute la review Codex.
- Le skill dit que fonctionnelle et sécurité « peuvent tourner en parallèle », mais rien ne l'organise : l'agent les lance l'une après l'autre en pratique.
- Pendant la review, rien d'autre n'avance.

### 1.5 Cérémonie par phase

À chaque phase : passe d'amélioration (`riff improve record`), `EXPLAIN.simple.md` puis `EXPLAIN-POST.simple.md`, checkpoint, tri des observations, rapport HTML uxtest. Chacune est petite, l'ensemble pèse sur chaque phase.

### 1.6 Prose défensive

`operating-contract.md` (13 Ko), `evidence.md` (10 Ko), `execution.md` (9 Ko), `git-delivery.md` (7,7 Ko) répètent les mêmes interdits sous plusieurs formes (« never relaunch your host » apparaît dans au moins cinq fichiers). C'était utile pour des modèles qui dérivaient. Opus 5.5 lit tout ça à chaque phase pour un gain faible.

## 2. Ce qu'il faut garder tel quel (la qualité en dépend)

| Garde-fou | Pourquoi il reste |
| --- | --- |
| État via CLI, checkpoints | Mémoire entre sessions ; aucun modèle ne s'en passe |
| `done_when` et `verify` par phase | Définit « fini » de façon vérifiable |
| Validation exécutée, liée au tree Git | Empêche « c'est fait » sans preuve |
| Preuve navigateur pour l'UI | Un build ou un HTTP 200 ne prouve pas un écran |
| Review indépendante d'une autre famille | Attrape les angles morts du modèle qui a écrit le code |
| Review de livraison finale + `finish --check` | Vérifie les parcours connectés de toute la version |
| Taste et `learn-stack` | Tes conventions ne se devinent pas |
| Un budget de correction, pas de re-review de complaisance | Empêche de boucler jusqu'à un avis favorable |
| Discovery complète au `start` | Tu l'as dit : c'est la partie qui définit l'app |

## 3. Propositions

### 3.1 Phases parallèles (gros chantier, gros gain)

- Autoriser plusieurs phases actives quand elles n'ont pas de dépendance entre elles et ne touchent pas les mêmes zones.
- `start` déclare pour chaque phase les zones qu'elle possède (`owns: [src/billing, db/schema/billing]`), ce qui permet au CLI de refuser deux phases qui se chevauchent.
- `riff wave select --parallel` renvoie toutes les phases prêtes compatibles. L'agent principal lance un sous-agent par phase, chacun dans son worktree, avec son propre candidat, sa validation et sa review.
- L'agent principal intègre les branches une par une sur la branche d'intégration, relance la validation du candidat intégré, puis committe.
- Les migrations de base de données et les fichiers partagés (schéma, design system) restent sérialisés : une phase qui les touche passe seule.
- Agent comfort : élevé (état multi-phase dans le CLI de 141 Ko, intégration, tests). Charge de validation pour toi : moyenne (essayer sur un vrai projet).

### 3.2 Délégation par défaut dans une phase

- Inverser la règle : dès qu'une phase contient deux paquets indépendants avec des contrats stables, on les délègue. L'agent principal garde l'architecture, les contrats partagés et l'intégration.
- Exploration en lecture seule toujours parallèle (Sonnet low ou Haiku).
- Construire le dossier du `start` en parallèle aussi : stories, wireframes, modèle de données et diagrammes par des sous-agents distincts, une fois l'interview faite, puis une review unique du tout.
- Agent comfort : faible (texte des skills). Charge pour toi : faible.

### 3.3 Remplacer le model-advice par une table

Dans le skill `wave`, à la place de `model-routing.md` et de `riff model-advice plan` :

| Travail | Sous-agent |
| --- | --- |
| Lire, localiser, extraire | `riff:haiku-4-5` ou `riff:sonnet-5-5-low` |
| Changement borné et bien spécifié | `riff:sonnet-5-5-medium` |
| Code qui touche données, droits ou intégrations | `riff:opus-5-5-medium` |
| Diagnostic difficile ou arbitrage d'architecture | `riff:opus-5-5-high` |

Garder `model-advice` comme commande optionnelle, mode `off` par défaut dans le wave. Supprimer les ~30 Ko de la lecture obligatoire. Agent comfort : faible. Charge pour toi : faible.

### 3.4 Reviews en arrière-plan

- Lancer functional et security comme deux commandes en arrière-plan sur le même candidat gelé, et continuer pendant ce temps (par exemple préparer la phase suivante indépendante, ou écrire le checkpoint).
- Option CLI `riff review run --type functional,security` qui lance les deux reviewers en parallèle (`spawn` asynchrone au lieu de `spawnSync`).
- Garder la review indépendante pour chaque phase : c'est elle qui protège la qualité finale. Pour une phase non sensible et petite, la review peut passer en effort plus bas (déjà configurable via `reviewers` dans `.riff-data/config.json`).
- Agent comfort : moyen. Charge pour toi : faible.

### 3.5 Alléger la cérémonie par phase

- Passe d'amélioration : une seule fois à la fin de la version, plus à chaque phase.
- `EXPLAIN.simple.md` : garder (c'est ce que tu lis). `EXPLAIN-POST.simple.md` : fusionner dans le checkpoint ou le message de commit.
- Rapport HTML uxtest : seulement pour les phases avec un parcours UI.
- Agent comfort : faible à moyen (quelques gates CLI à assouplir). Charge pour toi : faible.

### 3.6 Couper la prose

- Fusionner `operating-contract.md`, `execution.md` et `evidence.md` en un seul contrat d'environ un tiers de leur taille : les états, les quatre blockers, les gates, la règle des worktrees. Un interdit est écrit une fois.
- Garder les exemples JSON (format des manifestes et des reviews) : ils servent vraiment.
- Supprimer de `git-delivery.md` les paragraphes déjà couverts par l'autorisation permanente de merge.
- Agent comfort : faible. Charge pour toi : faible, mais relecture du nouveau contrat utile.

## 4. Ordre conseillé

1. **3.3, 3.5, 3.6** ensemble : du texte surtout, gain immédiat, aucun risque pour la qualité.
2. **3.2** : la délégation par défaut, sur la même passe.
3. **3.4** : reviews parallèles dans le CLI.
4. **3.1** : phases parallèles, le plus gros gain, à faire en dernier parce qu'il touche l'état du CLI et demande un essai réel.

Pour mesurer que ça marche sans dégrader la qualité : rejouer une version existante (ou un petit projet de test) avant et après, et comparer le temps total, le nombre de findings HIGH à la review de livraison, et ce que tu as dû corriger toi-même.
