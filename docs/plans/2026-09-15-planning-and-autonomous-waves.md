# Plan : conception complète et waves autonomes

## Objectif convenu

Préparer toute la version engagée avant l'implémentation, puis enchaîner des phases fonctionnelles avec vérification, revue indépendante et correction par l'agent. Garder la compaction native de Codex, les phases séquentielles et les contrôles RIFF existants. Aucun moteur externe ni appel imbriqué à `codex exec`.

## Critères d'acceptation

- `start` produit un dossier indexé par `PROJECT.md` : objectifs, utilisateurs, stories et critères observables, parcours, wireframes ASCII et états, modèle de données détaillé, architecture et intégrations, décisions sourcées par taste/stack/dépôt modèle, contraintes transversales, risques éprouvés, stratégie de vérification et roadmap reliée aux stories.
- Les diagrammes Mermaid sont de vrais fichiers sources liés aux documents. Les rubriques sans objet sont justifiées ; les hypothèses restent distinctes des faits. La version engagée est détaillée, les versions futures restent indicatives.
- La référence visuelle et les tokens, produits ailleurs ou par RIFF selon l'autorisation, sont intégrés avant toute wave. Aucun écran n'est implémenté pendant la conception ; seuls les essais bornés nécessaires pour vérifier un risque sont permis.
- Une revue indépendante du dossier corrigé précède l'exécution. Un contrôle vérifie la présence des artefacts et une preuve de revue correspondant à leurs contenus. Les anciens projets restent utilisables sans réécriture implicite de leurs documents.
- Chaque phase recherche les composants/services existants, préserve les comportements convenus et vérifie le résultat intégré. Les observations sont traitées avant sa clôture, avec preuve ou justification ; les problèmes plus larges ont une suite explicite, les risques critiques bloquent le travail concerné.
- Les phases restent séquentielles. Les travaux suffisamment indépendants peuvent être délégués, avec contrats explicites, propriété des fichiers et worktrees isolés pour les agents qui écrivent. L'agent principal garde décisions, intégration et jugement final.
- Chaque phase possède une reprise exploitable depuis les fichiers, avec contexte ciblé. La compaction ne vaut pas nouveau contexte. Les répétitions sans progrès ne contournent pas la limite de correction existante.
- Une revue finale des parcours de la version et les corrections nécessaires précèdent la déclaration de livraison complète. Aucun push ou déploiement automatique.

## Répartition et ordre d'exécution

1. Conception du contrat et intégration : agent principal.
2. Dossier de découverte : Luna XHigh, worktree `codex/discovery-contract`, propriété de `riff/skills/start/` et `riff/references/project-framing.md` ; création d'une référence de dossier et d'un exemple de manifeste si utile.
3. Contrôles CLI : Luna XHigh, worktree `codex/lifecycle-contract`, propriété de `riff/bin/riff.mjs`, du nouveau module de contrat et des tests correspondants. Vérifications du dossier/revue, checkpoints, observations et clôture finale, sans nouvelle boucle d'exécution.
4. Contrat de wave, reprise, délégation, revue et documentation publique : agent principal, fichiers distincts des deux workers.
5. Intégration des changements, tests ciblés puis suite existante pertinente ; revue indépendante de la version intégrée et correction des constats.
6. Commit local limité aux fichiers de cette tâche. Préserver les changements préexistants de `handoffs/`, les autres consommateurs et les caches de plugins.

Le choix Luna XHigh suit `efficient-delegation` et le routage RIFF ; Fast n'est pas exposé séparément (`fast_available: false`). Chaque worker reçoit un contexte minimal et des décisions déjà arrêtées.

## Validation

Au plus cinq nouveaux tests de comportement couvrent les passages autorisés et refusés du contrat. Réutiliser la suite existante pour les validations, preuves, reprises et observations. Vérifier les références des skills et leurs déclencheurs positifs/négatifs. La revue du plan et la revue finale évaluent le fond ; la CLI vérifie la structure et l'intégrité des preuves, sans prétendre prouver leur vérité.

## Avancement

- Plan écrit avant les modifications du framework.
- Revue indépendante du plan effectuée. Précisions intégrées : adoption explicite par manifeste et compatibilité legacy, rubriques visuelles sans objet pour un produit non-UI, attente réelle d'une référence externe, correction finale par phase dédiée, blocage HIGH et CRITICAL, préservation du budget à la reprise et responsabilité exclusive de l'état RIFF par l'intégrateur.
- Implémentation intégrée : dossier complet et manifeste, revue de découverte liée aux contenus, checkpoints, contexte ciblé, contrôles de clôture des observations, revue finale et documentation des worktrees.
- Deux workers Luna XHigh ont travaillé dans des worktrees distincts. L'agent principal a intégré leurs changements et ajouté les essais CLI de bout en bout. Une revue indépendante a identifié puis validé la correction de deux défauts : premier checkpoint sans commit et effacement possible d'un échec formel. Le verrou de la revue finale a aussi été vérifié.
- Validation : `npm test` réussit avec 32 tests, dont cinq nouveaux tests de contrat ; contrôles syntaxiques Node, liens Markdown, YAML et métadonnées des skills réussis. `doctor` : aucune erreur ni alerte. Le validateur personnel générique exclut explicitement RIFF ; cette limite est conservée et les vérifications directes sont documentées ici.
- Déclencheurs positifs et cas voisins négatifs de `start`, `wave` et `add-phase` revus indépendamment. Les observations actuelles du dépôt ne contiennent aucun item pending.
- Plan exécuté. Livraison locale uniquement ; les modifications préexistantes de `handoffs/` sont exclues du commit. Aucun consommateur ni cache de plugin n'est modifié. Un essai sur une nouvelle application réelle reste distinct des tests du framework ; aucune qualité produit empirique n'est revendiquée ici.
