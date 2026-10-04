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
