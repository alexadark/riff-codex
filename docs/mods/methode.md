# Méthode réutilisable pour construire un mod Claude Code

Date : 2026-10-03. Sources : [doc officielle des mods](https://code.claude.com/docs/en/plugins/mods), [mods intégrés](https://github.com/anthropics/claude-code/tree/main/mods), [mods exemples](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods), skill intégré `plugin-authoring`.

Un mod est un plugin dont le fichier `hooks/hooks.json` pointe vers un module JS ou TS. Ce module exporte `register(on)`. Chaque `on(événement, filtre?, hook)` branche une fonction `($, e, next)` qui peut **observer** (`return next(e)`), **réécrire** (`return next({ ...e, x })`) ou **répondre** (retourner un résultat sans appeler `next`). Tout ce qui sort du module passe par `$` : dessiner, lancer un process, lire un fichier, appeler un modèle.

Prérequis : Claude Code 2.1.287 ou plus récent (`claude --version`). Au 2026-10-03, ta machine est en 2.1.286.

## 1. Décider si c'est vraiment un mod

| Besoin | Outil |
| --- | --- |
| Des instructions que tu recolles souvent | Skill |
| Bloquer, autoriser ou journaliser avec un script qui existe déjà, valable dans plusieurs hôtes | Hook de settings (ou CLI + hook Git) |
| Donner à Claude l'accès à un système externe | Serveur MCP |
| Un panneau, une bande au-dessus du prompt, une commande instantanée sans tour de Claude, retenir un appel d'outil le temps de demander, partager un état entre plusieurs événements, router un modèle | **Mod** |

Règle : si la logique doit marcher aussi dans Codex ou un autre hôte, elle vit dans une CLI ou un script, et le mod n'en est que l'interface Claude Code.

## 2. Écrire la fiche en une phrase

> Quand **[événement]**, le mod **[observe | réécrit | répond]** pour que **[résultat visible]**. Là où rien ne s'affiche (VS Code, `claude -p`), il **[repli]**.

Exemple : « Quand Claude veut créer une tâche ClickUp, le mod répond par un refus si le titre dépasse cinq mots, pour que les titres restent courts. Sans interface, le refus suffit. »

Ajouter trois lignes :

- **Source de vérité** : où vivent les données (module, `$.state`, `$.store`, une CLI externe).
- **Échec** : un garde-fou échoue fermé (refuse), un affichage échoue ouvert (`next(e)`).
- **Ce que le mod touche** : la liste attendue des appels `$` (elle sera comparée à `claude plugin validate`).

## 3. Choisir la forme

| Tu veux | Forme |
| --- | --- |
| Un panneau à côté du transcript | `$.ui.open({ id, title })` + `on('ui.render', { component: 'Pane' })` filtré sur `e.requestId` |
| Une bande au-dessus du prompt | `on('ui.render', { component: 'AbovePrompt' })` |
| Une ligne de statut, un toast, une ligne de log | `$.ui.status`, `$.ui.toast`, `$.ui.log` |
| Modifier un élément natif (spinner, ligne d'outil) | `ui.render` sur le composant, `next({ ...e, props })` |
| Garder ou modifier un appel d'outil | `on('tool.call', { tool: 'Bash' })`, retour `{ deny }`, `{ result }` ou `next` |
| Réécrire ou compléter un prompt | `on('prompt.submit')`, `next({ ...e, context: [...] })` |
| Une commande instantanée | `$.command.register` dans `session.start` + `on('command.run', { command })` |
| Un outil que Claude appelle | `$.tool.register` + `tool.call` filtré sur `mcp__<plugin>__<nom>` |
| Un type de sous-agent, ou choisir son modèle | `$.agent.register`, `on('agent.spawn')` qui retourne `{ model }` |
| Suivre un tour, router une requête | `turn.start`, `turn.step` (générateur async), `turn.complete` |
| Travail en arrière-plan | `$.clock.every` dans `session.start`, `$.process.spawn`, puis `$.prompt.submit` pour lancer un tour |
| Contrôler la compaction | `session.compact` (instructions, messages), `$.session.compact({ instructions })` |

## 4. Architecture du code

- **Cœur pur, hooks minces.** Les règles (classer une commande, formater une ligne) sont des fonctions sans `$`, testables seules. Les hooks ne font que lire l'événement, appeler le cœur et parler à `$`.
- **Où garder l'état** : variable du module si une remise à zéro au rechargement est acceptable ; `$.state` (avec contrat de types) pour ce qu'un dessin lit et qui doit survivre au rechargement ; `$.store` (4 MiB, partagé entre sessions) pour ce qui doit durer ; un fichier ou une CLI externe quand un autre outil en est propriétaire.
- **Dessin en repli** : un panneau ouvert sans action de l'utilisateur n'apparaît qu'à partir de 144 colonnes. Prévoir la bande comme repli, comme `blast-radius`.

## 5. Règles d'analyse statique (sinon la validation échoue)

- Écrire chaque appel en entier : `$.ui.toast(...)`. Jamais `const ui = $.ui`, ni déstructuration.
- Nom d'événement en chaîne littérale dans chaque `on(...)`. Pas de boucle sur une liste d'événements.
- Une fonction qui reçoit `$` doit être déclarée au premier niveau du même fichier.
- Imports statiques, relatifs au plugin ; seul import nu autorisé : `claude-code`.
- Pas de second `on` déclaré dans `register`.

## 6. Robustesse

- Un hook a environ 10 s de temps propre ; le temps passé dans `next` ou un appel `$` ne compte pas (sauf `$.clock.sleep`). Pour attendre une décision, boucler sur un court `$.process.run(['sleep', '0.25'])`, comme `blast-radius`.
- Respecter `next.signal` (interruption par l'utilisateur).
- `$.process.run` : 30 s par défaut, 10 min maximum. Au-delà, `$.process.spawn`.
- Appeler `$.ui.invalidate('ui.render')` après chaque changement de données ; c'est limité à 10 rafraîchissements par seconde.
- Ne jamais `await $.prompt.submit` dans un hook qui tourne pendant un tour de Claude.
- Un mod qui **approuve** un appel d'outil peut contourner une règle `ask` ou un hook `PreToolUse`. Préférer refuser ou laisser passer, jamais approuver.
- Penser aux sessions sans humain : un mod installé tourne aussi dans `claude -p`, donc dans une session de review lancée par un autre outil.

## 7. Construire

**Avec Claude (le plus rapide)** : dans une session interactive, demander le mod en collant la fiche de l'étape 2. Claude charge `plugin-authoring` et écrit dans `~/.claude/dev-mods/<session>/<mod>/`. Accepter « Enable for this session » : le mod se recharge à la fin de chaque tour qui le modifie.

**À la main** : trois fichiers.

```text
mon-mod/
├── .claude-plugin/plugin.json   { "name": "mon-mod", "version": "0.1.0", "description": "..." }
└── hooks/
    ├── hooks.json               { "modules": ["./register.ts"] }
    └── register.ts
```

Charger avec `claude --plugin-dir ./mon-mod`. Le dossier est surveillé et rechargé à chaque sauvegarde. Les types exacts de ta version sont écrits dans `.claude-plugin/types/` au chargement.

## 8. Vérifier

1. `claude plugin validate ./mon-mod` : comparer les lignes `hooks:` et `calls:` à la liste prévue à l'étape 2. Un appel inattendu est un défaut.
2. `claude plugin test` avec des tests dans `tests/*.test.ts` (`import { expect, test } from 'claude-code/testing'`), y compris le cas d'échec et le repli sans affichage.
3. Essai réel dans le terminal, puis dans l'onglet Code de l'app Desktop, à une largeur étroite (moins de 144 colonnes).
4. `/plugin`, onglet Installed : le mod est listé.

## 9. Livrer

- Sortir le mod de `~/.claude/dev-mods/` : ce dossier est supprimé après `cleanupPeriodDays`.
- Le ranger dans un dépôt (un dossier par mod), décrit dans un marketplace, puis `claude plugin install <mod>@<marketplace>`.
- Incrémenter `version` à chaque livraison : une copie installée est mise en cache par version.
- Le README indique la version de Claude Code testée.
- Le nom ne doit pas commencer par `claude-`.

## Gabarit de demande à Claude

```text
Fais un mod avec /plugin-authoring.
Fiche : Quand [événement], le mod [observe|réécrit|répond] pour que [résultat]. Sans interface : [repli].
Source de vérité : [...]. Échec : [fermé|ouvert].
Appels $ attendus : [...]. Rien d'autre.
Cœur pur testable séparé des hooks, tests avec claude plugin test, puis claude plugin validate.
```

## Backlog d'idées (hors RIFF)

| Mod | Forme | Ce que ça règle |
| --- | --- | --- |
| `context-200k` | Bande, `session.measure` | Jauge de contexte calculée sur ta fenêtre de compaction (200K) et non sur 1M, avec tendance par tour |
| `task-title-guard` | `tool.call` sur les outils ClickUp et Monday de création | Refuse un titre de plus de cinq mots, avec `;` ou `Done when`, et dit à Claude quoi corriger |
| `dash-guard` | `tool.call` sur `Write` et `Edit` des fichiers `.md` destinés à être publiés | Refuse les tirets cadratins, demi-cadratins et tirets espacés |
| `auto-caffeinate` | `turn.start`, `turn.complete`, `$.process.spawn` | Garde le Mac éveillé pendant un tour long, sans y penser |
| `session-radar` | Panneau, `$.store`, `$.session.send` | Voir toutes tes sessions ouvertes, leur projet et leur état, et leur envoyer un message |
| `client-clock` | `turn.start`/`turn.complete`, `$.store`, commande `/hours` | Temps passé par projet client et par jour, exportable vers ClickUp après confirmation |
| `handoff-band` | Bande au démarrage, `session.compact` | Affiche le dernier handoff du projet et en sauvegarde un avant chaque compaction |
| `pr-checks` | `$.clock.every`, `$.ui.status` | État des checks de la PR courante sous le prompt |
