# Phase 4 : pont de review

Date : 2026-10-04. Plan parent : [plan-riff-claude-astra.md](plan-riff-claude-astra.md), section « Le pont de review ». Statut : proposition, à valider avant implémentation.

Résultat attendu (plan parent) : Astra via `codex exec` produit des reçus acceptés par les trois commandes de review existantes, un candidat volontairement buggé est bloqué, une indisponibilité suit le fallback de façon visible.

## Ce que l'exploration a montré

- Les reviews s'enregistrent déjà par trois chemins qui partagent la même validation (`reviewArtifact` dans `riff/bin/riff.mjs`) : `wave review <phase> --type functional|security --evidence FILE`, `discovery review --evidence FILE`, `finish --review FILE`. `promote --apply` réutilise le même format pour `architecture`, `roadmap` et `functional`.
- L'artefact attendu : `version: 1`, `candidate`, `type`, `status`, `reviewer.id`, `reviewer.independent: true`, `evidence` non vide, `findings`. Un `pass` avec un finding HIGH ou CRITICAL est refusé. Les champs en plus sont acceptés, donc on peut enrichir `reviewer` sans casser les reçus existants.
- Le candidat n'est pas le même selon le type : arbre Git indexé (`git write-tree`) pour `functional` et `security`, digest du dossier (`discovery snapshot`) pour `discovery`, arbre de `HEAD` avec un worktree propre pour `delivery`.
- Le CLI bloque déjà une deuxième review sur un candidat inchangé après un échec, et exige une validation exécutée avant un `pass` fonctionnel.
- Aujourd'hui, les skills disent seulement « un agent frais qui n'a pas écrit le code ». Rien ne lance le reviewer : c'est ce que le pont ajoute.
- La configuration du projet vit dans `.riff-data/config.json` (langues, préférences). Les profils de modèles dans `riff/references/model-profiles.json`.
- La règle actuelle (`execution.md`, `model-routing.md`) interdit tout `codex exec` ou `claude -p`. Elle devient : « jamais d'hôte qui se relance lui-même pour travailler » ; seul le pont appelle un autre hôte, en lecture seule, pour le rôle reviewer.

Vérifié sur le Mac le 2026-10-04 : `codex-cli 0.160.0` connecté avec ChatGPT, `gpt-6-astra` et `gpt-6-sol` répondent tous les deux en `exec --ephemeral -s read-only`. `gpt-6.1-sol` répond aussi. Claude Code `2.1.288` offre `-p --json-schema --no-session-persistence --bare`. Un appel Codex charge ta config et tes hooks globaux (un hook `Stop` a tourné pendant le test) ; `--ignore-user-config` écarte la config mais pas les hooks.

## Architecture proposée

| Élément | Où | Rôle |
| --- | --- | --- |
| Commande | `riff review run --type <discovery\|functional\|security\|delivery> [--phase <id>]` | Vérifie le candidat, construit le prompt, essaie la chaîne, écrit l'artefact, affiche la commande d'enregistrement à lancer. N'enregistre rien elle-même : l'agent garde la main (étape 5 du plan parent). |
| Module | `riff/lib/review-bridge.mjs` | Construction du prompt, adaptateurs `codex` et `claude`, classement des erreurs, conversion en artefact. Le CLI principal fait déjà 2 259 lignes. |
| Gabarits | `riff/references/review-prompts/<type>.md` (anglais) | Cadrage adversarial : contester l'approche et les hypothèses, pas seulement chercher des bugs. Contenu injecté : critères d'acceptation et `done_when` de la phase, diff depuis `baseCommit` (tronqué au-delà d'une limite, avec la liste complète des fichiers), consignes de preuve. Le reviewer lit lui-même le dépôt en lecture seule. |
| Schéma de sortie | `riff/references/review-prompts/output.schema.json` | `status`, `evidence[]`, `findings[]` (`severity`, `title`, `location`, `evidence`, `recommendation`). Le pont ajoute lui-même `version`, `candidate`, `type` et `reviewer`. |
| Configuration | `.riff-data/config.json`, clé `reviewers` | `chain` (ordre), `effort` par type (`medium` par défaut, `high` pour `security` et `delivery`), `timeoutSeconds`. Valeurs par défaut écrites par `init` et `resync` si absentes. |
| Artefacts | `.riff-data/reviews/<type>-<candidat court>-<horodatage>.json` | Hors Git, comme les autres preuves. Le reçu enregistré en garde une copie hachée, comme aujourd'hui. |

Identité dans l'artefact :

```json
"reviewer": {
  "id": "codex:gpt-6-astra@high",
  "independent": true,
  "family": "openai",
  "sameFamily": false,
  "cli": "codex-cli 0.160.0",
  "skipped": [{"id": "…", "reason": "quota"}]
}
```

## Règles de la boucle, et qui les applique

| Règle | Application |
| --- | --- |
| Un HIGH ou CRITICAL non résolu bloque | Déjà dans le CLI. En plus, le pont force `status: fail` si le modèle répond `pass` avec un finding bloquant. |
| Nouvelle review = nouveau candidat | Déjà dans le CLI pour les trois commandes ; le pont refuse aussi de lancer un reviewer sur un candidat déjà en échec, pour ne pas gaspiller un appel. |
| 3 tours maximum pour un dossier ou un plan d'évolution | Nouveau : compteur des reviews `discovery` en échec depuis le dernier `pass`. Au quatrième, le pont refuse et l'agent ouvre un blocage. Pour une phase, le budget de correction existant ne change pas. |
| Fallback seulement sur indisponibilité réelle | Classement des erreurs : CLI absente, non connectée, modèle hors du plan, quota ou limite de débit, délai dépassé. Une sortie qui ne respecte pas le schéma est réessayée une fois avec le même reviewer, puis compte comme indisponibilité. Une review négative ne déclenche jamais le suivant. |
| Autre famille de modèles quand c'est possible | `sameFamily` calculé depuis l'hôte (`claude-code` donc famille `anthropic`). Un Claude frais est signalé « même famille » dans l'artefact et dans le dashboard. |
| Désaccord sur un finding moins grave | Inchangé : justification via `riff observations review`. |

Isolation des appels :

- Codex : `codex exec -m <modèle> -c model_reasoning_effort=<effort> -s read-only --ephemeral --output-schema <schéma> -o <fichier> -C <racine>`, avec `--ignore-user-config` (Astra reste disponible avec ce drapeau ; tes hooks globaux tournent quand même).
- Claude : `claude -p --model <modèle> --json-schema <schéma> --no-session-persistence --permission-mode plan` avec outils limités à la lecture ; `--bare` seulement si l'authentification par abonnement fonctionne avec ce mode, à vérifier pendant l'implémentation.

## Tests et preuve

- Tests automatiques, ajoutés en fin de fichier : des reviewers factices remplacent `codex` et `claude` par variable d'environnement (`RIFF_REVIEW_CODEX_BIN`, `RIFF_REVIEW_CLAUDE_BIN`). Cas couverts : artefact accepté par `wave review`, `discovery review` et `finish --review` ; review `fail` avec HIGH qui bloque ; quota sur Astra puis passage à Sol, visible dans `skipped` ; review négative d'Astra sans passage au suivant ; sortie invalide ; candidat déjà en échec refusé ; quatrième tour de dossier refusé.
- Essai réel dans un projet jetable : une phase avec un bug volontaire (par exemple une vérification d'autorisation manquante) passe par `riff review run --type security`, Astra doit la bloquer ; la version corrigée doit passer. Puis une review `discovery` réelle sur un petit dossier.
- Tu juges si les findings d'Astra sont utiles ou du bruit sur ces deux essais.

## Changements autour

- Skills `wave`, `start`, `evolve` et `quick` : remplacer « un agent frais » par `riff review run`, avec repli sur un sous-agent natif frais si le pont est indisponible en entier, signalé comme tel.
- `quick` sans phase : `riff review run --type functional` sans `--phase` produit un artefact consultatif, sans reçu.
- `execution.md`, `model-routing.md`, `evidence.md` : nouvelle règle sur les hôtes, le pont comme source normale des artefacts.
- `doctor` : présence et connexion des CLI de la chaîne, sans lancer de modèle.
- Dashboard : badge « même famille » sur les reviews concernées.

Hors phase 4 : les types `architecture` et `roadmap` de `promote` (même mécanisme, gabarits à ajouter plus tard), la doc complète (phase 7).

## Décisions à prendre

1. **Le pont enregistre-t-il le reçu lui-même ?** Proposition : non, il écrit l'artefact et affiche la commande ; l'agent qui fait la wave enregistre aussitôt avec `--summary`, comme le prévoit le plan parent. Ça garde une seule porte d'entrée pour les reçus. Tout se passe entre l'agent et le CLI : en `loop`, aucune review ne s'arrête pour te demander quoi que ce soit, sauf le blocage existant quand un finding HIGH ou CRITICAL résiste au budget de correction.
2. **Sol : `gpt-6.1-sol` plutôt que `gpt-6-sol`.** Les deux répondent sur ton plan (vérifié le 2026-10-04) ; proposition, la version la plus récente en deuxième position de la chaîne, réglable dans la config.
3. **Ta config Codex pendant une review** : Astra reste accessible avec `--ignore-user-config`, mais tes hooks globaux tournent quand même (le hook `Stop` s'est déclenché). Proposition : utiliser `--ignore-user-config` et accepter les hooks tels quels, puisque le reviewer est en lecture seule ; les désactiver demanderait de toucher à ta config Codex, ce que RIFF ne fait pas.

## Complexité

Agent : moyenne à élevée (adaptateurs de deux CLI, classement d'erreurs, trois chemins d'enregistrement à couvrir). Validation par toi : moyenne, juger la qualité des reviews d'Astra sur les deux essais réels.

## Avancement (2026-10-04)

Choix validés par Alexandra : les trois propositions ci-dessus, sans interruption pendant les waves.

- Fait sur la branche `phase-4-review-bridge` : `riff review run`, module `riff/lib/review-bridge.mjs`, gabarits et schéma dans `riff/references/review-prompts/`, contrôle des reviewers dans `doctor`, compteur des tours de dossier, reviewer et badge « même famille » dans le dashboard, skills `wave`, `start`, `evolve`, `quick` et références mis à jour. La chaîne par défaut s'applique quand `.riff-data/config.json` n'a pas de clé `reviewers` ; `init` et `resync` n'écrivent rien.
- Écarts avec la proposition : `--quick` est obligatoire pour une review consultative hors phase (sinon une phase parquée recevait une review consultative silencieuse) ; `claude -p` tourne sans `--bare`, qui coupe l'authentification par abonnement ; le prompt impose la langue d'artefact du projet, car Astra répondait en français en lisant tes instructions globales.
- Tests : 4 nouveaux tests avec de faux reviewers (`test/review-bridge.test.mjs`), suite complète à 68 tests verte.
- Essai réel dans un projet jetable (scratchpad) : Astra (`high`) bloque la suppression sans contrôle du propriétaire en CRITICAL, et trouve un second bug réel non planté (identifiants réutilisés qui écrasent la note d'un autre). Après correction, elle bloque encore en HIGH sur l'absence de couche d'authentification, que la feuille de route sous-entendait ; après précision du périmètre dans `PROJECT.md`, elle passe. Review fonctionnelle `pass` avec un LOW juste sur un test mal écrit, review de livraison `pass`, reçus acceptés par `wave review` et `finish --review`. Durée : 50 à 80 secondes par review. Fallback réel : modèle inexistant classé `model-unavailable`, puis Claude Haiku, marqué `sameFamily`.

## Failles de sécurité pendant une wave (décision d'Alexandra, 2026-10-04)

Une faille trouvée en review ne parque plus la phase : l'agent la corrige et refait la review sur le nouveau candidat, puis marque l'ancienne observation `resolved`. Ce qui demande le jugement d'un expert en sécurité plutôt qu'une correction de code (modèle de menace, conformité, choix cryptographique ou d'infrastructure, configuration hors dépôt) passe en `expert_review` : les phases continuent, les reviews suivantes en sont informées, et `riff finish --check` refuse la livraison tant que la décision de l'expert n'est pas enregistrée. Un défaut de code ordinaire est toujours corrigé, jamais renvoyé à l'expert ; après trois corrections sans succès sur le même finding, il est renvoyé à l'expert avec son historique.

Inchangé : les hooks qui détectent avec certitude une migration destructrice ou un secret commité parquent toujours la phase (cible destructrice), et `deep-audit`, lancé explicitement, garde sa règle.
