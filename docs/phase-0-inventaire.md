# Phase 0 : inventaire des dépendances Codex

Date : 2026-10-04. Plan parent : [plan-riff-claude-astra.md](plan-riff-claude-astra.md).

Chaque dépendance à Codex reçoit un propriétaire :

- **Cœur** : reste dans RIFF, valable pour tous les hôtes. Seul le nom change (phase 1).
- **Hôte Codex** : part dans `riff/hosts/codex/`, à côté de `riff/hosts/claude-code/`.
- **Profil** : dépend du modèle, pas de l'outil. Va dans les profils de modèle (phase 2).

## En bref

- La logique de RIFF est déjà neutre. La CLI, l'état, les preuves, les reviews et le dashboard ne dépendent de Codex que par des **noms** (`riff-codex`, `.riff-codex`, `.riff-codex-state`) et par **l'installation** (où poser les skills et les hooks).
- Les 15 skills sont courts (10 à 42 lignes) mais très denses : `wave` tient en 23 lignes et 6 Ko, avec une douzaine de règles par paragraphe. La logique détaillée vit dans 13 références (719 lignes).
- Le vocabulaire Codex dans les skills et références se limite à trois choses : le chemin `.riff-codex/...` (environ 70 fois), la syntaxe d'appel `$riff:x`, et une dizaine de phrases propres à Codex (listées plus bas).
- Rien ne bloque la phase 1.

## Inventaire par propriétaire

### Cœur (reste, renommé en phase 1)

| Élément | Où | Ce qui change |
| --- | --- | --- |
| CLI | `riff/bin/riff.mjs`, `riff/lib/*.mjs` | Commande `riff`, alias `riff-codex`. Chemins d'état renommés. |
| État du projet | `.riff-codex-state/` (state.json, events.ndjson, config.json, reçus, rapports) | Nouveau nom, migration versionnée avec sauvegarde. |
| Lien vers le framework | `.riff-codex` (lien symbolique posé par `init`) | Nouveau nom. |
| Références | `riff/references/*.md` (sauf modèle, voir Profil) | Chemins `.riff-codex/...` remplacés ; phrases Codex déplacées (voir plus bas). |
| Taste | `riff/references/taste*`, `taste.md` | Inchangé. |
| Dashboard | `riff/dashboard/` (parsers, server, watcher) | Chemins d'état seulement. |
| Hook Git et contrat de livraison | `riff/lib/delivery-contract.mjs`, `safety.mjs` | Inchangé. |
| Hooks gérés | `riff/hooks/managed-dispatch.mjs`, `riff/lib/managed-hooks.mjs` | Le dispatch reste cœur ; l'écriture du fichier de hooks devient propre à chaque hôte. |
| Tests | `test/*.mjs` | Suivent les renommages. |
| Documentation | `README.md`, `riff-documentation.html` | Réécrite en phase 7. |

### Hôte Codex (part dans `riff/hosts/codex/`)

| Élément | Où | Équivalent Claude Code (phase 3) |
| --- | --- | --- |
| Manifeste de plugin | `riff/.codex-plugin/plugin.json` | Plugin Claude `riff` (M7 du plan mods). |
| Métadonnées d'interface des skills | `riff/skills/*/agents/openai.yaml` (15 fichiers) | Champ `description` du `SKILL.md`, rien d'autre. |
| Installation des skills | `init` écrit des liens dans `.agents/skills/riff-codex-*` | Liens dans `.claude/skills/`. |
| Fichier de hooks | `init` écrit `.codex/hooks.json` | Hooks dans `.claude/settings.json` du projet. |
| Détection de hooks désactivés | lecture de `.codex/config.toml` et `~/.codex` (`CODEX_HOME`) | `doctor` lit les réglages Claude Code. |
| Pointeur d'instructions | `AGENTS.md` | `CLAUDE.md`. |
| Syntaxe d'appel | `$riff:wave`, `$riff:issue`… dans skills et CLI | `/riff:wave` via le plugin `riff`, à injecter par l'hôte plutôt qu'écrit en dur. |
| Règle « jamais de `codex exec` imbriqué » | `skills/wave/SKILL.md` | Équivalent Claude : jamais de `claude -p` imbriqué hors pont de review. |
| Compaction native | `references/execution.md` : « Use native Codex compaction » | Formulation neutre ; la compaction Claude est gérée par auto-handoff et M3. |
| Branches `codex/<change>` | `references/git-delivery.md` | Préfixe configurable par hôte (`claude/`, `codex/`). |
| Audit profond | `skills/deep-audit` appelle `$codex-security:deep-security-scan` | Reste un skill Codex ; côté Claude, `/security-review` ou désactivé. |

### Profil (part dans les profils de modèle, phase 2)

| Élément | Où | Ce qui change |
| --- | --- | --- |
| Catalogue de modèles | `riff/references/model-profiles.json` | Sans préférence de fournisseur ; Opus en profil `autonomous`. |
| Contrat de routage | `riff/references/model-routing.md`, `model-advice-input.md` | « le modèle Codex sélectionné » devient « le modèle principal ». |
| Conseil de modèle | `riff/lib/model-advice*.mjs` (Sol, Luna, Astra, Jev) | Reste ; les règles « préférer OpenAI » deviennent un réglage. |
| Style de prompt | aujourd'hui implicite, écrit pour Codex | Deux styles : `autonomous` (Opus) et `guarded` (Astra, open source). |

## Les skills, vus pour la phase 2

| Skill | Lignes | Interdits / obligations | Remarque |
| --- | --- | --- | --- |
| start | 42 | 6 | Le plus long ; cadrage et discovery. |
| learn-stack | 29 | 4 | |
| evolve | 24 | 7 | Le plus chargé en interdits. |
| wave | 23 (6 Ko) | 6 | Le cœur ; paragraphes très denses, à découper. |
| quick | 20 | 2 | |
| onboard | 18 | 4 | |
| add-phase, debug, issue | 16 chacun | 4, 2, 3 | |
| map | 14 | 1 | |
| dashboard, promote | 12 chacun | 1 | |
| deep-audit, incident, status | 10 chacun | 1 | deep-audit est propre à Codex. |

Ce que la phase 2 devra faire, skill par skill :

- **Séparer ce que la CLI garantit déjà de ce qui est vraiment une consigne.** Exemples dans `wave` : « ne pas remettre à zéro le budget de relances », « un candidat modifié invalide les reçus », « respecter les dépendances » sont déjà appliqués par la CLI. Ils peuvent sortir du prompt.
- **Réécrire selon « but, condition de fin, vérification »**, avec le `done_when` et la méthode de vérification de chaque phase.
- **Faire porter les chemins par l'hôte** plutôt que les écrire en dur (`.riff-codex/references/...` revient environ 70 fois).

## Noms des dossiers projet (à trancher)

Dossiers de l'ancien RIFF Claude, à ne pas réutiliser : `.riff`, `.planning`, `.riff_runtime`, `.riff-private`, `.riff-tmp`, `.riff_hook_sha`, `.riff-next-*`. On en trouve encore dans 5 projets (`.riff`) et 9 projets (`.planning`).

Proposition :

| Rôle | Aujourd'hui | Proposé |
| --- | --- | --- |
| Lien vers le framework | `.riff-codex` | `.riff-cli` |
| État du projet | `.riff-codex-state/` | `.riff-data/` |

Ces deux noms n'existent nulle part dans l'ancien RIFF, et ils disent ce qu'ils contiennent.

## Décisions

Tranchées le 2026-10-04 :

1. Dossiers : `.riff-cli` (lien vers le framework) et `.riff-data` (état du projet).
2. Commandes Claude : `/riff:wave`, `/riff:start`… via un plugin `riff`.

Reste ouvert : le projet du pilote réel (question du plan Astra), à choisir parmi ceux sans phase active.

## Phase 1 : faite le 2026-10-04

- La commande s'appelle `riff` ; `riff-codex` reste un alias.
- Les nouvelles installations utilisent `.riff-cli` et `.riff-data`.
- `riff resync` migre un projet `.riff-codex-state` quand aucune phase n'est active, après une sauvegarde complète dans `.riff-data/backups/`. Sinon il garde l'ancien dossier et le dit.
- Les anciens noms restent comme liens (`.riff-codex`, `.riff-codex-state`), pour que le dashboard, les hooks Codex, le cockpit et le texte des skills continuent de marcher. Ils disparaîtront quand tous les lecteurs utiliseront les nouveaux noms (phases 2, 3 et 7).
- Vérifié sur une copie de planazo : état migré, sauvegarde présente, `doctor` et dashboard OK, seul `.codex/hooks.json` change dans Git.
