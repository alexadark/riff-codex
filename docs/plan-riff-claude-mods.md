# Plan : RIFF pour Claude Code avec des mods

Date : 2026-10-03

Statut : proposition. Complète le [plan Claude Code et Astra du 2 octobre](plan-riff-claude-astra.md) ; ne le remplace pas. Aucune implémentation n'est autorisée par ce document. Méthode générale : [docs/mods/methode.md](mods/methode.md).

## En bref

Les mods ne doivent pas devenir un second RIFF. Ils sont la **couche hôte Claude Code** prévue par le plan agnostique : la CLI `riff` reste la seule source de vérité (état, gates, reçus, preuves), et les mods donnent à Claude Code ce que Codex ne peut pas offrir : un cockpit dans l'interface, une compaction pilotée par les phases, une review Astra suivie en direct, le modèle réellement utilisé enregistré comme preuve, et une boucle autonome qui ne s'arrête pas trop tôt.

Un seul plugin Claude `riff` peut tout porter : les skills, les sous-agents, les hooks de settings et le module de mod (`hooks.json` accepte à la fois `hooks` et `modules`).

## Ce que RIFF a aujourd'hui, et ce qui peut devenir un mod

| Brique actuelle | Où elle vit | Devient un mod ? |
| --- | --- | --- |
| État, phases, reçus, preuves, `finish` | CLI `riff-codex` (`bin/riff.mjs`) | **Non.** Reste dans la CLI, portable entre hôtes. |
| Garde destructif, garde secrets, avertissement de périmètre (`preTool`) | Hook de settings via `managed-dispatch.mjs` | **Non pour la règle.** Le mod peut seulement en améliorer l'affichage (étape M6). |
| Scan des fichiers modifiés, findings HIGH bloquants (`postTool`) | Hook de settings | **Non.** Même raison. |
| Contexte injecté au démarrage (`session-start`) | Hook de settings | **Partiellement** : le mod ajoute la réinjection après compaction et l'affichage. |
| Horodatage de checkpoint avant compaction (`pre-compact`) | Hook de settings | **Oui, en mieux** : compaction déclenchée aux frontières de phase. |
| « RIFF needs you » (`stop`) | Hook de settings, message système | **Oui** : toast, bande persistante, notification. |
| Dashboard | Serveur Bun, navigateur | **En complément** : vue compacte dans Claude Code, le dashboard web reste pour le détail. |
| Conseil de modèle (`model-advice`) | CLI, conseil seulement | **Oui** : application aux sous-agents et preuve du modèle utilisé. |
| Pont de review Astra (prévu, phase 4 du plan Astra) | CLI à créer | **L'interface oui, le pont non** : la CLI lance `codex exec`, le mod suit et relance un tour. |

Pourquoi garder les garde-fous hors des mods : la doc officielle recommande un hook de settings quand on veut « bloquer, autoriser ou journaliser avec un script qui existe déjà ». C'est exactement le cas de RIFF, et ces règles doivent tenir aussi sous Codex, dans `claude -p` et dans le hook Git.

## Les mods recommandés

Classés par valeur et par risque. Tous appellent la CLI via `$.process.run` et n'écrivent jamais `state.json` eux-mêmes.

### M-A. Cockpit RIFF (bande + panneau + commandes instantanées)

- **Bande au-dessus du prompt** : `RIFF · phase-3 Auth · checks 4/6 · 1 finding HIGH · contexte 142K/200K · loop`.
- **Panneau `/riff`** avec onglets Roadmap, Phase, Findings, Reviews, et boutons « Checkpoint » et « Ouvrir le dashboard ».
- **Commandes sans tour de Claude** : `/riff-status`, `/riff-context`. Zéro token, réponse immédiate, même pendant que Claude travaille.
- Rafraîchi sur `turn.complete` et après chaque commande `riff` observée dans `tool.call`.
- Prérequis CLI : `riff status --json` (contrat stable, aujourd'hui la sortie est du texte).

### M-B. Gardien de compaction

Depuis le 2026-10-03, le mod global `auto-handoff` (`~/DEV/claude-code-private/mods/auto-handoff/`) fait déjà handoff, `/clear` et `/pickup` à 300K dans toutes les sessions. M-B doit s'appuyer dessus plutôt que le dupliquer : il ajoute seulement ce qui est propre à RIFF (checkpoint de phase, contenu de `wave context`, déclenchement aux frontières de phase).

Conflit à trancher : si RIFF règle `autoCompactWindow` à 200K, la compaction passe avant 300K et le handoff ne se déclenche jamais. Proposition : fenêtre de compaction au-dessus du seuil (par exemple 400K), la compaction devenant un filet de sécurité.

Répond directement au risque principal du plan Astra (Opus compacte trop tard, à 967K).

- **Jauge calculée sur la fenêtre RIFF** (200K) et non sur 1M, puisque le status line natif ne le fait plus une fois `autoCompactWindow` réglé.
- **Compaction aux frontières de phase** : quand `riff wave complete` réussit et que le contexte dépasse un seuil, le mod lance `$.session.compact({ instructions })` avec la liste de ce qu'il faut garder. On compacte entre deux phases plutôt qu'au milieu d'une correction.
- **Instructions de compaction** : un hook `session.compact` ajoute aux instructions le résultat de `riff wave context` (phase, candidat, checks passés, findings ouverts, prochaine action).
- **Checkpoint avant toute compaction** : `riff wave checkpoint` appelé avant `next(e)`.
- Critère du pilote (repris du plan Astra) : une wave traverse deux compactions sans refaire un check enregistré ni perdre un finding.

### M-C. Suivi de review Astra

- Commande `/riff-review functional` ou bouton du cockpit : lance `riff review run ...` en arrière-plan avec `$.process.spawn` (une review peut dépasser les 10 min de `$.process.run`).
- Panneau : reviewer réellement utilisé (Astra, Sol ou Claude frais), progression, findings par gravité.
- À la fin : `$.prompt.submit` lance un tour de correction avec le résumé des findings. Le reçu reste produit par la CLI.
- Dépend du pont de review (phase 4 du plan Astra).

### M-D. Routeur de modèles et preuve d'identité

- `agent.spawn` applique aux sous-agents le profil prévu par `riff model-advice plan` (exploration en Sonnet `low`, paquets parallèles en Opus `medium`...). Le modèle principal n'est jamais changé, conformément à la règle actuelle.
- `turn.step` lit `result.usage.model` pour chaque requête et l'envoie à la CLI comme événement. Ça règle un manque documenté dans le README : « le modèle réellement utilisé reste `unknown` sans preuve du runtime ». Les reçus peuvent alors citer le modèle observé.
- Option : `$.agent.register` pour des types `riff:explorer`, `riff:builder`, `riff:reviewer` générés depuis les profils, si les fichiers d'agents natifs ne suffisent pas.

### M-E. Pilote de boucle et alertes humaines

- En autonomie `loop`, sur `turn.complete` : si `riff status --json` indique une phase prête, aucun blocage et aucune action humaine, le mod relance `/riff:wave` via `$.prompt.submit`. Ça corrige la tendance des modèles à s'arrêter trop tôt.
- Limites strictes : plafond de relances par session, arrêt si le tour a été interrompu (`e.isAborted`), arrêt sur toute action humaine, désactivé hors session interactive.
- Action humaine requise : toast, bande rouge persistante, et `$.audio.speak` en option.
- Le plus risqué : à construire après le pilote, une fois M-A et M-B éprouvés.

### M-F. Garde destructif interactif (optionnel)

- Inspiré de `blast-radius` : en mode `guided`, au lieu d'un refus sec, le mod retient la commande, montre ce qu'elle toucherait, et propose Annuler ou « Approbation destructive explicite ».
- La classification reste celle de la CLI (`riff hook pre-tool` reçoit l'appel). Le mod ne fait que l'interface. Il ne doit jamais approuver un appel que le hook de settings refuse.
- À décider après le pilote : utile seulement si les refus actuels gênent vraiment.

## Points d'attention

- **Version** : le CLI est en 2.1.288 (mods actifs). L'app Desktop embarque sa propre version (2.1.286 le 2026-10-03) : les mods n'y sont garantis qu'après sa mise à jour.
- **Sessions de review** : un mod installé tourne aussi dans `claude -p`. Si le reviewer de repli est un Claude frais lancé par `claude -p`, M-C, M-D et M-E doivent se neutraliser (variable `RIFF_ROLE=reviewer` posée par le pont, et contrôle de `$.session.surfaces()`).
- **Affichage** : rien ne s'affiche dans l'extension VS Code ni en `-p`. Chaque mod garde un repli texte (`$.ui.log`, réponse de commande).
- **Où développer** : dans ce dépôt (par exemple `riff/hosts/claude-code/`), chargé avec `--plugin-dir` ou `CLAUDE_CODE_PLUGIN_DIRS`. Jamais dans `~/.claude/dev-mods/`, nettoyé automatiquement.
- **Confiance** : le mod a les mêmes droits que toi. `claude plugin validate` doit lister exactement les appels prévus ; `riff doctor` le vérifiera.
- **Réversibilité** : comme la logique reste dans la CLI, revenir à Codex ne perd rien ; seul le confort d'interface disparaît.

## Plan d'action

Pas de durée : complexité pour l'agent et poids de validation pour toi. Les étapes s'insèrent dans la séquence du plan Astra (phases 0 à 7).

| Étape | Résultat observable | Dépend de | Complexité agent | Validation par toi |
| --- | --- | --- | --- | --- |
| M0. Prérequis et spike (**fait le 2026-10-03**) | Claude Code ≥ 2.1.287. Un mod minimal dans `riff/hosts/claude-code/` affiche `riff-codex status` dans la bande d'un projet de test ; `claude plugin validate` et `claude plugin test` passent. | Rien | Faible | Faible : voir la bande apparaître |
| M1. Contrats JSON de la CLI | `riff status --json` et `riff wave context --json`, avec tests dans `test/`. Sortie texte inchangée. | Phase 1 du plan Astra (renommage), ou avant si le nom reste `riff-codex` | Faible | Faible |
| M2. Cockpit (M-A) | Bande, panneau à onglets, `/riff-status` et `/riff-context`, repli texte hors interface, tests du cockpit. | M1 | Faible à moyenne | Faible : juger la lisibilité |
| M3. Gardien de compaction (M-B) | Jauge 200K, checkpoint avant compaction, compaction proposée puis lancée aux frontières de phase, instructions issues de `wave context`. | M1, phase 3 du plan Astra (`autoCompactWindow`) | Moyenne (vérifier le comportement réel de `session.compact`) | Moyenne : une wave à deux compactions |
| M4. Routeur et preuve de modèle (M-D) | Profils appliqués aux sous-agents ; modèle observé enregistré par la CLI et visible dans les reçus. | Phase 2 du plan Astra (profils) | Moyenne | Faible |
| M5. Suivi de review (M-C) | `/riff-review` lance le pont en arrière-plan, affiche les findings, relance un tour de correction. Neutralisé dans les sessions reviewer. | Phase 4 du plan Astra (pont) | Moyenne | Moyenne : utilité des findings affichés |
| M6. Pilote de boucle (M-E) | Relance automatique bornée, alertes humaines. Un projet jetable enchaîne trois phases sans relance manuelle et s'arrête net sur une action humaine. | M2, M3, pilote du plan Astra | Moyenne à élevée (risque de boucle) | Moyenne |
| M7. Empaquetage | Plugin Claude `riff` unique (skills, agents, hooks de settings, mod) dans un marketplace privé. `riff init --host claude-code` l'installe, `riff doctor` contrôle la version de Claude Code et la sortie de `claude plugin validate`. | M2 au minimum | Moyenne | Faible : approuver l'installation une fois |
| Plus tard | M-F (garde interactif) si les refus gênent ; mods hors RIFF du backlog de la méthode. | Retour du pilote | Faible à moyenne | Faible |

Ordre conseillé : M0, M1, M2 rapidement (gain visible, risque faible), puis M3 qui sert directement le pilote Astra. M4 et M5 suivent les phases 2 et 4 du plan Astra. M6 vient en dernier.

## Questions ouvertes

1. Le cockpit remplace-t-il l'ouverture automatique du dashboard web, ou les deux coexistent-ils ?
2. M3 : compaction lancée automatiquement aux frontières de phase, ou seulement proposée avec un bouton ?
3. M6 : quel plafond de relances automatiques par session ?

## Résultat de M0 (2026-10-03)

- Mod `riff/hosts/claude-code/riff-cockpit/` : bande « RIFF · projet · phases · active ou next » plus une ligne rouge « Needs you » quand une action humaine est en attente ; `/riff-status` répond sans tour de Claude.
- Le mod lance la CLI du projet via le lien `.riff-codex` (avec repli sur `/usr/local/bin/node` et `/opt/homebrew/bin/node` si `node` manque au PATH de l'app) et n'écrit jamais l'état RIFF.
- `claude plugin validate` passe ; `claude plugin test` : 4 tests passent.
- Vérifié en session réelle (CLI 2.1.288) sur une copie en lecture seule de l'état de `tamos-outreach` : la bande et `/riff-status` affichent bien 7/15 phases et l'action humaine.
- Limite connue : la sortie texte de `status` est analysée ligne à ligne. M1 la remplace par `status --json`.

Essai : `claude --plugin-dir ~/DEV/frameworks/riff-codex/riff/hosts/claude-code/riff-cockpit` dans un projet RIFF.

Prochaine action : M1.
