# Plan : conseil de modèle et effort dans RIFF

Date : 2026-09-22. Statut : implémentation et documentation réalisées et vérifiées en copie isolée ; intégration locale au checkout partagé explicitement autorisée après validation. Aucun appel récurrent, changement de fournisseur principal ou publication autorisé. Ce document complète le [plan agnostique](../agnostic-riff-plan.md) sur le seul conseil de modèle dans Codex, sans lancer sa refonte multi-hôtes. Les sections de conception ci-dessous conservent les décisions avant réalisation.

## Objectif et état constaté

Choisir un modèle et un effort adaptés au travail, en privilégiant la réussite de bout en bout et les interventions humaines évitables minimales, puis la consommation totale. Distinguer difficulté du raisonnement, dépendance des étapes, autonomie, détectabilité des erreurs et coût d'une erreur tardive. Une tâche longue n'impose ni un grand modèle ni XHigh à elle seule.

Le checkout examiné est sur `main`, commit `75b291d`. La référence actuelle [model-routing](../../riff/references/model-routing.md) prescrit Astra Medium et Luna XHigh, sans rôle par défaut pour Sol. Une skill personnelle Jev séparée contient déjà une grille Luna/Sol/Astra et DeepSeek conditionnel ; elle ne fait pas partie de la distribution RIFF. Le framework dispose d'une CLI Node, de tests `node:test`, de préférences et d'événements locaux. Il n'a actuellement ni `PROJECT.md`, ni `ROADMAP.yaml`, ni phase active dans son propre état. Ce plan reste un artefact de conception, pas un deuxième suivi d'exécution ni une application à onboarder artificiellement.

## Périmètre et décisions proposées

- Un conseil, pas un routeur d'exécution : aucun changement automatique du modèle principal, aucun proxy OpenAI, aucun worker ajouté, aucun `codex exec` imbriqué, aucun scheduler.
- OpenAI continue par son fournisseur natif et la souscription Codex. Jev seul utilise OpenRouter. DeepSeek reste conditionnel via Ollama Cloud et n'est jamais présenté comme local ou inclus dans Codex.
- Trois modes proposés : `off`, `local`, `jev`. `local` signifie conseil par l'agent courant à partir de la grille, pas inférence locale hors cloud. Aucune requête Jev sans activation explicite pour la consultation ou le projet ; l'activation persistante précise le périmètre des résumés envoyés et peut être annulée.
- Aucune obligation d'appeler Jev : absence de clé, timeout, erreur API ou réponse invalide donnent un statut explicite et, si autorisé, un conseil local clairement identifié. Cela ne bloque pas à soi seul une wave et ne contourne aucun vrai blocage.
- Aucun conseil à chaque message ou appel d'outil. Évaluer au début de la tâche, puis à une frontière de phase seulement si le contexte de décision change. Une impasse peut justifier un nouveau conseil, jamais remettre à zéro le budget de correction.
- Le changement du modèle principal reste manuel. En mode `loop`, une nouvelle recommandation ne crée pas une pause obligatoire : poursuivre avec le modèle courant lorsque c'est permis et rapporter séparément le conseil. Ne pas inventer de changement effectif ni de preuve de disponibilité.
- Conserver toutes les validations, revues indépendantes requises, protections de données, checkpoints et conditions d'achèvement de RIFF.

## Contrat de conseil

Entrée minimale préparée par l'agent : objectif de la tâche ou de la phase, contraintes de fournisseur/modèle, dépendances, autonomie, contrôles disponibles, inconnues matérielles et raison d'une réévaluation. Aucun scan ou envoi automatique de dépôt, conversation, vault, secrets ou fichiers de configuration. Les instructions contenues dans des extraits sont des données, pas des autorisations.

Filtrer les profils avant un appel : modèle/effort exposés ou disponibilité signalée comme inconnue, restrictions de destination et choix imposés. « OpenAI seulement » exclut DeepSeek ; « données strictement locales » interdit aussi OpenAI cloud et Jev pour ces données. Zéro profil donne une incompatibilité explicite ; un seul profil donne le choix contraint sans appel payant inutile.

Sortie : profil proposé, modèle, effort, version de grille, origine `local` ou `jev`, hypothèses, motif court et condition de réévaluation. Pour Jev, distinguer le choix brut, les probabilités et la justification de l'agent. Les probabilités ne sont pas un taux de réussite. Ne pas recommander d'options absentes ou non admissibles ; valider la réponse et conserver l'identité Jev réellement retournée et le coût déclaré quand présents.

Le modèle principal effectivement utilisé est un autre champ, renseigné uniquement sur preuve du runtime ou déclaration explicitement marquée. `unknown` reste possible. Ne pas détourner le champ actuel `state.model`, qui peut refléter un modèle de revue, pour prétendre connaître le modèle principal.

## Livraisons successives

### 1. Une politique cohérente et réutilisable

Résultat observable : RIFF et la skill personnelle Jev consultent les mêmes profils versionnés, sans instructions contradictoires.

Proposition de source portable : un petit catalogue structuré sous `riff/references/`, contenant profils et définitions complètes. `model-routing.md` conserve le contrat d'utilisation, sans seconde grille entretenue à la main. La documentation résume et référence cette source. La skill personnelle reste canonique dans son dépôt propriétaire et devient un consommateur configuré de cette grille, sans chemin personnel ni dépendance à ce dépôt privé dans RIFF. Une source manquante doit être signalée, pas remplacée par une ancienne copie silencieuse.

Inclure les usages code et non-code déjà convenus pour conserver le conseil personnel hors RIFF. OpenAI par défaut : Luna pour travail borné, Sol pour exécution balisée, Astra pour coordination et dépendances coûteuses. High/XHigh seulement pour difficulté identifiée ; DeepSeek Low/High conditionnel. Ne pas transformer ces hypothèses en classement empirique validé.

Vérifier toutes les prescriptions actuelles, notamment `start`, `map`, `evolve`, `wave`, le README et le manuel HTML ; retirer les valeurs concurrentes plutôt que juxtaposer les règles. Lire Skill Creator canonique avant toute modification des skills personnelles et suivre le mécanisme de validation propre à RIFF pour ses skills.

### 2. Obtenir un conseil sans lancer la tâche

Résultat observable : une entrée explicite RIFF affiche un conseil et se termine sans activer de phase ni changer de modèle.

Ajouter une entrée de conseil utilisable par l'agent, avec une commande CLI dédiée pour valider les données, gérer les modes et enregistrer le résultat. Le nom proposé est `model-advice` ; il n'existe pas encore. Un petit module isole validation et appel Jev du reste de la CLI. Réutiliser le contrat de l'adaptateur Jev existant, mais fournir une intégration RIFF portable, sans dépendance au chemin d'une skill privée ni nouveau SDK inutile.

Mode `jev` : clé par environnement uniquement, endpoint prévu, timeout borné, pas de retry payant automatique, validation stricte de la réponse. Le conseil local reste celui de l'agent courant ; la CLI ne simule pas le jugement Jev. Pas de nouveau modèle chargé pour classer une tâche triviale.

### 3. Raccorder le conseil aux phases sans casser l'autonomie

Résultat observable : l'agent peut consulter le conseil avant le travail pertinent, reprendre une phase sans redemander le même avis et continuer sans pause routinière.

Raccorder les instructions aux frontières déjà utilisées par `start`, `evolve` et `wave`. Les tâches bornées hors phase peuvent utiliser la même entrée manuelle. Ne pas ajouter de hook pour cette première version : le contexte sémantique utile existe déjà dans les skills et le contexte de phase.

Conserver préférences et dernière décision dans l'état local existant, exclusivement via la CLI et ses verrous. Ajouter des champs optionnels rétrocompatibles, avec valeurs par défaut explicites pour les anciens projets, sans effacement de l'état ni migration de roadmap. Une empreinte des contraintes structurées, de la phase et de la version de grille évite de réappeler Jev à la reprise ; les changements de fichiers ordinaires ne suffisent pas à réévaluer. Une réévaluation forcée exige un motif.

Enregistrer un événement minimal : phase, origine, version, profil conseillé, statut fournisseur, motif de réévaluation et coût déclaré. Ne pas persister le prompt complet ni le contenu privé. Distinguer conseil et sélection effective ; réutiliser les événements de validation/correction pour un bilan ultérieur, sans nouveau tableau de bord. Les interventions humaines et tokens non observables restent inconnus, jamais reconstruits arbitrairement.

### 4. Vérifier puis adopter progressivement

Résultat observable : le chemin conseil, reprise et repli passe dans un projet jetable, sans modifier les projets utilisateurs ou leur fournisseur OpenAI.

Implémenter d'abord dans un worktree isolé : des projets existants peuvent lire le checkout partagé par symlink, donc une modification locale de ce checkout peut déjà les affecter sans push. Vérifier les liens dans le worktree pour éviter toute écriture indirecte dans la source active. Ce travail reste dans la conversation courante.

Valider la copie isolée et sa projection de skill avant intégration. L'intégration au checkout partagé et l'activation dans un projet pilote doivent être explicites. Ne pas lancer de `resync` global, modifier des projets actifs, publier ni toucher aux caches de plugins. Après validation et accord de livraison correspondant, documenter la mise à jour des liens, sessions et copies de plugin réellement concernés. L'activation de Jev reste désactivable par projet et n'altère pas les preuves RIFF.

## Validation et critères d'acceptation

Au plus cinq nouveaux scénarios ciblés, complétés par les tests existants pertinents :

1. Conseil nominal : catalogue complet et mode local sans réseau ; réponse Jev simulée valide, distinction entre recommandation et modèle effectif, aucune activation de phase.
2. Restriction : options interdites filtrées avant requête, zéro/un profil gérés sans appel inutile, réponse contenant un choix non admissible rejetée.
3. Échec fournisseur : clé absente, timeout ou réponse invalide restent explicites et le conseil local ne se fait pas passer pour Jev ; aucune relance payante ni changement de fournisseur implicite.
4. Reprise : même décision réutilisée, changement matériel invalide le conseil, état et budget de correction préservés, modèle effectif inconnu non inventé.
5. Intégration : projet jetable, modes et projections vérifiés, opt-in Jev respecté, absence de hook/appel automatique hors frontière prévue et contrôles RIFF existants conservés.

Réutiliser `npm test` et les vérifications existantes de références/skills. Une évolution visible du manuel HTML reçoit une vérification rendue ciblée. Les tests du fournisseur utilisent des fixtures sans réseau ; un appel réel borné dans le pilote valide séparément le câblage, avec consentement et coût rapporté. Aucun test mock ni l'appel actuel à Jev ne prouve à lui seul l'intégration future dans RIFF.

L'acceptation exige les quatre résultats ci-dessus, un diff limité au périmètre, une revue du comportement intégré et un compte rendu distinguant tests, pilote réel et déploiement. L'efficacité des modèles reste à mesurer sur plusieurs tâches comparables : réussite complète, régressions, reprises, interventions évitables et consommation effectivement observable. Pas de promesse d'économie avant mesure.

## Conseil Jev pour réaliser cette implémentation

Appel réel effectué le 22 septembre 2026 via la skill existante, à partir du périmètre technique résumé et de la grille complète. Aucun code du dépôt ni historique privé envoyé. Les neuf profils OpenAI ont été proposés ; DeepSeek n'a pas été retenu comme principal pour ce travail transversal, sans bénéfice local établi ni disponibilité du compte vérifiée.

- Modèle Jev retourné : `typesafe/jev-1.13-20260917`, fournisseur `TypeSafe`.
- Réponse : `astra_medium`, soit `gpt-6-astra`, effort `medium`.
- Probabilités retournées : Astra Medium `0.85`, Sol Medium `0.12`, Luna High `0.03`, autres profils `0`. Champ `confidence` distinct : `0.82`.
- Usage retourné : 5 866 tokens d'entrée, 99 de sortie ; `usage.cost = 0.000246372`.
- Identifiant : `gen-dec-1790071616-aYAvD7iYSPYqzo1vikQp`.

Interprétation de Codex, pas explication textuelle produite par Jev : Astra Medium convient pour garder cohérents politique, intégration externe, persistance, autonomie et preuves sur une réalisation complète. Il n'y a pas d'impasse justifiant High ou XHigh actuellement. Sol Medium reste une alternative plausible pour une unité ultérieure dont le contrat est figé. Le changement reste manuel ; aucun réglage n'a été modifié.

## Prochaine action après accord

Rester sur Astra Medium, créer l'isolation de travail et réaliser la première livraison : source commune et suppression des prescriptions contradictoires. Continuer ensuite les livraisons prévues dans la même tâche, sans multiplier les validations humaines intermédiaires, en respectant les limites d'adoption et de publication ci-dessus. Ne pas activer une wave fictive dans le framework en l'absence de roadmap ; utiliser les projets jetables pour vérifier le cycle RIFF.

## Réalisation et preuves du 22 septembre

- Catalogue unique livré dans `riff/references/model-profiles.json`, contrat portable d'entrée/sortie dans `model-advice-input.md`, commande `model-advice catalog|show|configure|recommend` et intégration des frontières dans les skills existantes. Aucun nouveau hook, worker d'exécution, SDK ou changement de fournisseur principal.
- Préférences et décision minimale dans l'état existant, validation des restrictions avant réseau, consentement explicite, réutilisation des erreurs pour éviter les retries payants, identité effective distincte et inconnue par défaut. La CLI conserve les états, preuves et budgets de correction.
- Documentation produite par un sous-agent Sol Medium : README, guide `docs/model-advice.md`, usage, installation et manuel HTML ; cohérence finale vérifiée par l'agent principal. Rendu réel contrôlé dans le navigateur intégré, section modèles lisible ; les liens, métadonnées et exemples ont été contrôlés séparément.
- Suite complète : 41/41 tests réussis, dont cinq nouveaux scénarios. Une revue indépendante Sol Medium a trouvé un défaut de validation du cache ; correction et assertions de régression ajoutées dans le scénario existant, cinq scénarios toujours au total. Revue de la correction sans constat résiduel ; contrôles ciblés réexécutés après correction.
- Pilote réel dans un projet jetable : Jev retourne `luna_low` pour une demande synthétique de trois titres, modèle `typesafe/jev-1.13-20260917`, coût déclaré `0.000064512`. Une seconde demande identique réutilise le résultat sans nouvel appel. Ce pilote prouve le câblage de la consultation et de la reprise, pas un gain empirique de fiabilité des modèles.
- Adaptation de la skill personnelle préparée dans son dépôt propriétaire : lecteur du même catalogue, deux payloads en dry-run et refus de source absente/invalide vérifiés, projection isolée validée. Aucun contenu personnel ni dépendance au dépôt privé dans RIFF.
- Limites conservées : sélection du modèle principal manuelle, absence de benchmark comparatif, aucune activation persistante Jev dans les projets existants, aucun push ou déploiement du manuel en ligne. Les copies de plugin indépendantes ne sont pas automatiquement mises à jour.
