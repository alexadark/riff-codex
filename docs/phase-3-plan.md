# Phase 3 : hôte Claude Code

Date : 2026-10-04. Plan parent : [plan-riff-claude-astra.md](plan-riff-claude-astra.md), phase 3. Travail sur la branche `phase-2-prompting`, fusion avec la phase 2.

Résultat attendu (plan parent) : `riff init --host claude-code` installe skills, hooks et sous-agents avec leur modèle, règle la compaction ; `riff doctor` vérifie le tout.

## Ce que l'exploration a montré

- Les hooks RIFF utilisent déjà les événements et le format de sortie de Claude Code (`SessionStart` avec `compact`, `PreCompact`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`, `hookSpecificOutput.additionalContext`). Le gestionnaire `riff hook` peut servir tel quel ; seul le fichier où on les déclare change.
- Codex ne reçoit aucun pointeur `AGENTS.md` : le hook `SessionStart` injecte le contexte RIFF au démarrage, à la reprise et après compaction.
- Doc officielle de Claude Code vérifiée le 2026-10-04 : un plugin porte skills, sous-agents (`agents/`) et hooks (`hooks/hooks.json`, avec `CLAUDE_PROJECT_DIR`) ; `autoCompactWindow` est accepté dans `.claude/settings.json` et `.claude/settings.local.json` ; un sous-agent fixe `model` et `effort` dans son frontmatter.
- Le hook `SessionStart` dit encore « en `loop`, ne jamais demander de décision », ce qui contredit l'interview de `start`, `evolve` et `add-phase`. À corriger quel que soit l'hôte.

## Architecture proposée

| Élément | Où | Pourquoi |
| --- | --- | --- |
| Plugin `riff` | Racine `riff/` (y ajouter `.claude-plugin/plugin.json` et `agents/`) | Les mêmes `skills/` servent aux deux hôtes ; commandes `/riff:wave`, `/riff:start` (décision de la phase 0). |
| Marketplace local | `riff/hosts/claude-code/.claude-plugin/marketplace.json`, qui liste `riff` et `riff-cockpit` | Existe déjà pour le cockpit. |
| Sous-agents | `riff/agents/<profil>.md`, générés depuis les profils Anthropic de `model-profiles.json` | `model` et `effort` fixés ; un test vérifie qu'ils correspondent au catalogue. |
| Réglages machine | `.claude/settings.local.json` du projet, exclu de Git : hooks (chemin absolu de la CLI), `autoCompactWindow: 400000`, plugin activé, marketplace local | Chemins propres à chaque machine (Mac, VPS), comme `.codex/hooks.json` aujourd'hui. |
| Hooks | Même fusion que pour Codex (`mergeHooks`), dans ce fichier | Code existant et testé ; les hooks de l'utilisateur sont préservés. |
| Contexte après compaction | Hook `SessionStart` (`compact`) enrichi : phase active, dernier checkpoint, prochaine action | Remplace le pointeur `CLAUDE.md` du plan parent (voir décision 1). |
| `doctor` | Contrôles Claude Code : hooks à jour, `autoCompactWindow` ≤ 400K, plugin activé, version de Claude Code | |
| Configuration | Les deux hôtes installés par `init` et `resync` | Décision 2. |

Vocabulaire Codex à neutraliser dans la même phase : « RIFF Codex », « native Codex compaction », « nested `codex exec` », message de `riff init`, `deep-audit` exclu du plugin Claude.

## Décisions (Alexandra, 2026-10-04)

1. **Injection par hook, sans `CLAUDE.md`.** RIFF ne touche pas au `CLAUDE.md` du projet. Le hook `SessionStart` écoute aussi `clear` : le mod auto-handoff lance un vrai `/clear` à 300K, puis `/pickup`. Sans `clear`, le contexte RIFF manquerait après chaque auto-handoff. Avec, les deux s'additionnent : contexte RIFF lu dans l'état réel, puis note de reprise. La doc confirme que la première réponse de Claude attend la fin des hooks après `/clear`.
2. **Les deux hôtes installés** dans chaque projet. Leurs fichiers sont propres à la machine et exclus de Git ; revenir à Codex ne demande aucune réinstallation.
3. **Sonnet 5.5 et Haiku 4.5 ajoutés au catalogue**, avec leurs sous-agents : Sonnet pour `quick` et l'exploration, Haiku pour la lecture simple.

## Complexité

Agent : moyenne (beaucoup de chemins d'installation, mais le code de fusion et de hash existe). Validation par Alexandra : moyenne, approuver l'installation une fois et vérifier une session réelle dans un projet de test.

## Avancement

- Fait (commits `da27b5f` à `448478f`) : hook `SessionStart` sur `clear`, profils Sonnet 5.5 et Haiku 4.5, plugin `riff` et ses 8 sous-agents, marketplace `riff`, réglages machine dans `.claude/settings.local.json`, contrôles de `doctor`.
- Cockpit : il lisait déjà `.riff-cli` avec repli sur `.riff-codex` depuis le renommage ; tests et validation repassés.
- Vocabulaire neutralisé dans les références, les skills `dashboard` et `onboard`, le message de `riff init` et le dashboard : « RIFF Codex » devient « RIFF », « Claude RIFF » devient « le framework RIFF d'origine », la compaction et l'interdiction de relancer l'hôte ne nomment plus Codex. `model-routing.md` explique qu'un profil devient le sous-agent `riff:<profil>` sous Claude Code. Restent propres à Codex, volontairement : `deep-audit`, les fichiers `agents/openai.yaml`, `.codex-plugin/plugin.json` et le marqueur `# RIFF Codex managed wrapper` des hooks Git, qui sert à reconnaître les installations existantes.
- Essai en vraie session, le 2026-10-04, après ajout du marketplace `riff` avec l'accord d'Alexandra : dans un projet initialisé par `riff init`, Claude Code installe les deux plugins au démarrage de la session, charge les 11 skills et les 8 sous-agents, et le hook injecte le contexte RIFF au démarrage puis après `/clear` (vérifié par Alexandra dans l'app). Un sous-agent `riff:haiku-4-5` lancé depuis une session Sonnet tourne bien sur Haiku. Bug trouvé et corrigé : un `.DS_Store` dans la liste des skills empêchait le chargement du plugin, sans que `claude plugin validate --strict` le signale.
- Reste : migration de l'ancien marketplace `riff-claude-code` au moment de la fusion (d'ici là, deux cockpits s'affichent dans un projet RIFF), documentation en phase 7. Projet de test à supprimer : `~/DEV/frameworks/riff-test-claude`.

## Fusion (2026-10-04)

- `phase-2-prompting` fusionnée dans `main` en avance rapide (`60202f0`) et poussée. Marketplace `riff` repointé vers `~/DEV/frameworks/riff-codex/riff` ; l'ancien `riff-claude-code` est retiré.
- Mac : 12 projets migrés vers `.riff-cli` et `.riff-data` par `riff resync`, avec sauvegarde dans `.riff-data/backups/`, sans erreur de `doctor`. planazo, qui embarquait sa propre copie de RIFF, est mis à la corbeille à la demande d'Alexandra. Le worktree `findlaw-production-remediation` est retiré ; sa branche `codex/production-demo-hardening` reste dans findlaw et sur le dépôt `demo`, et ses captures `phase-18-miro-advanced` sont copiées dans `findlaw/.artifacts/verification/`.
- VPS : copie de `riff/` mise à jour depuis `main` (sauvegarde `riff.backup-20261004T234326Z.tgz`), skills `incident`, `map` et `promote` retirés, 6 projets migrés sans erreur, marketplace `riff` enregistré.
- Reste pour Alexandra : approuver les hooks Codex (`/hooks`, puis `riff doctor --record-hooks-approved`) là où `doctor` le demande, et commiter dans chaque projet les changements Git laissés par `resync` (liens des skills retirés, `.codex/hooks.json`, explications de dashboard suivies dans storycrews).
- Bug connu : quand `.riff-codex-state` est un lien vers l'état d'un autre checkout, `resync` crée un `.riff-data` neuf et vide au lieu de signaler que l'état partagé par lien n'est pas pris en charge.
