# Recherche : bien utiliser les modèles dans RIFF

Date : 2026-10-19. Sources : doc officielle Anthropic et Claude Code, doc OpenAI et dépôt openai/codex, la vidéo de Melvin (https://youtu.be/pnD1PafeXic), retours de la communauté. Cinq agents Haiku ont lu les sources en parallèle ; les chiffres officiels viennent aussi de la référence API embarquée.

## Ce qui ressort

1. **Un modèle fort à effort bas bat souvent un modèle moyen à effort haut.** Anthropic le dit (« mesurer le modèle le plus capable à effort plus bas avant de construire une cascade »), et la vidéo aussi (Opus en medium coûte moins cher que Sonnet en extra-high, pour une intelligence proche). Un retour non vérifié dit même que Sonnet 5.5 consomme environ 60 % de tokens de plus qu'Opus 5.5 par tâche.
2. **Déléguer n'est rentable que dans deux cas mesurés par Anthropic** : du travail routinier avec une longue traîne de coût, et du travail plus grand qu'une fenêtre de contexte. Pour une chaîne de tâches dépendantes, le modèle principal seul, à effort plus bas, a gagné dans tous les cas mesurés. Chaque sous-agent doit relire le contexte, réexplorer, puis l'agent principal relit son rapport.
3. **Haiku 5.5 change la donne pour la lecture.** Il coûte 0,10 $ / 0,50 $ par million de tokens (20 fois moins que Sonnet 5.5), avec 1M de contexte et les cinq niveaux d'effort. Anthropic le présente comme fait pour l'extraction, le routage et les tâches de sous-agent. Point d'attention officiel : en effort `low` dans un long prompt d'agent, il saute plus souvent une recherche ou une vérification. Il faut donc partir de `medium`.
4. **La famille Opus 5 délègue trop d'elle-même.** Anthropic recommande de plafonner : pas de sous-agent pour quelques lectures, ni pour vérifier son propre travail ; un brief précis du premier coup ; ne jamais refaire le travail d'un sous-agent. Côté Codex, la communauté rapporte le même travers avec Sol (166 agents pour une page, d'après un témoignage).
5. **Fable 5.1 sert à débloquer, pas à travailler au quotidien.** Il coûte 2,5 fois le prix d'Opus 5.5, il est plus lent, et ses refus de sécurité basculent sur un autre modèle. CodeRabbit le juge moins précis qu'Opus en review. Anthropic le recommande quand Opus 5.5 en effort haut ne suffit plus.
6. **Le reviewer d'une autre famille reste un bon choix.** Personne ne remet en cause la review croisée ; c'est la partie que RIFF fait déjà.

## Effort par modèle (officiel)

| Modèle | Prix entrée / sortie ($/MTok) | Défaut | Conseil officiel |
| --- | --- | --- | --- |
| Fable 5.1 | 10 / 50 | high | Monter en `xhigh` ou `max` pour le travail difficile, descendre quand les évals tiennent |
| Opus 5.5 | 4 / 20 | medium | Faire un balayage d'effort sur ses propres tâches |
| Sonnet 5.5 | 2 / 10 | high | `medium` pour du code bien spécifié, `high` pour plus dur ou plus long |
| Haiku 5.5 | 0,10 / 0,50 | medium | Partir de `medium`, `high` pour les tâches d'agent longues |
| GPT-6 Astra | 10 / 50 | medium | Codex conseille de démarrer en Light (`low`) |
| GPT-6.1 Sol | 2 / 10 | medium | Démarrer au défaut |
| GPT-6 Luna | 0,10 / 0,50 | — | Codex conseille de démarrer en High |

Côté Claude Code, le frontmatter d'un sous-agent accepte `model` (`haiku`, `sonnet`, `opus`, `fable`, un ID complet, ou `inherit`) et `effort`. Jusqu'à 20 sous-agents tournent en même temps par défaut (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`).

## Table retenue pour RIFF

Décisions d'Alexandra du 2026-10-19 : pas de Fable 5.1, Opus Low plutôt que Sonnet Medium pour les changements bornés.

| Travail | Claude Code | Codex |
| --- | --- | --- |
| Lire, chercher, extraire, résumer (lecture seule) | Haiku 5.5 `medium` (`high` pour une longue exploration) | Luna `high` |
| Changement borné, contrats stables | Opus 5.5 `low` | Sol 6.1 défaut |
| Phase entière ou code qui touche données, droits, intégrations | Opus 5.5 `medium` | Astra `medium` |
| Diagnostic dur, arbitrage d'architecture | Opus 5.5 `high`, puis `xhigh` en dernier recours | Astra `high` |
| Planification (`start`, `evolve`) | Session principale en Opus 5.5 `medium`, `high` pour fixer données, architecture et découpage d'un dossier complet | Astra `medium` |
| Review | Autre famille (chaîne actuelle) | Autre famille |

Les profils Sonnet restent dans le catalogue pour le cas où la capacité Opus manque.

## Ce que ça change dans RIFF

- **Catalogue** : `haiku_4_5` remplacé par `haiku_5_5_medium` et `haiku_5_5_high`, en lecture seule via un champ `readOnly`. Les profils Sol pointent sur `gpt-6.1-sol`.
- **Délégation** : « déléguer là où ça paie » au lieu de « déléguer par défaut ». Lecture en éventail et paquets ou phases indépendants et conséquents vont aux sous-agents ; une chaîne dépendante, un petit changement ou la vérification de son propre travail restent chez l'agent principal.
- **Phases en lot** : inchangées. Ce sont exactement les « pistes indépendantes et conséquentes » où Anthropic dit que le parallélisme paie.

## Ce qui reste incertain

- Aucun chiffre officiel ne compare Haiku 5.5 et Sonnet 5.5 sur du code. Anthropic dit de mesurer avant d'utiliser Haiku comme worker.
- La communauté ne s'accorde pas sur Astra : un rapport dit qu'il n'est pas sorti, alors que la page officielle des modèles OpenAI le liste. C'est la page officielle qui fait foi.
- Bug signalé côté Codex : des sous-agents héritent du modèle parent au lieu de celui configuré. Ça vaut la peine de vérifier `effectiveModel` sur un vrai run.
- Les règles de la vidéo (50 % d'exécution en low, 40 % en medium, ne jamais utiliser max) sont affirmées, pas mesurées.

## Sources principales

- https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
- https://platform.claude.com/docs/en/build-with-claude/effort
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/costs
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/guides/reasoning
- https://learn.chatgpt.com/docs/models
- https://www.coderabbit.ai/blog/fable-5-model-review
- https://community.openai.com/t/issue-where-chatgpt-codex-sub-agents-inherit-the-parent-model-instead-of-using-the-model-specified-in-the-agent-configuration/1386539
