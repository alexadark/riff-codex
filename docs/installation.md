# Install RIFF

[Back to the README](../README.md) · [Everyday use](usage.md)

RIFF is installed once on your computer, then connected to each project you want to use it in. Your projects keep their own plans and progress.

RIFF works in two coding tools, called hosts: **Claude Code** and **Codex**. Connecting a project sets it up for both, so you can switch from one to the other without reinstalling anything. The main difference is how you call a skill: `/riff:wave` in Claude Code, `$riff:wave` in Codex.

## Before you begin

You need:

- **Claude Code** or **Codex**, installed and signed in. This is where you talk to RIFF.
- **Git**, which keeps a history of changes to your project.
- **Node.js 20 or newer**, which runs RIFF's commands. Its installer includes **npm**.
- **Bun**, which runs the local dashboard. RIFF's installation check also requires it.
- **Access to the private GitHub repository** `alexadark/riff-codex`.
- **The Codex CLI signed in to ChatGPT** (`codex login`), recommended even if you build in Claude Code. RIFF uses it to have another model family, GPT-6 Astra by default, review the work. Without it, reviews fall back to a fresh Claude session and are labeled as same-family.

To see which tools are already installed, run these in Terminal:

```sh
git --version
node --version
npm --version
bun --version
claude --version
codex --version
codex login status
```

A version number means the tool is available. If Terminal says a command cannot be found, install that tool before continuing. If GitHub refuses the download, check that you're signed in with an account that has access to the repository.

## Download RIFF once

In Terminal:

```sh
git clone https://github.com/alexadark/riff-codex.git ~/riff-codex
cd ~/riff-codex
npm install
npm link
```

`npm install` downloads what RIFF needs. `npm link` makes the `riff` command available on your computer. The older name `riff-codex` still works as an alias. There is no published npm package to install instead.

Keep `~/riff-codex` in place. Projects refer to that folder rather than receiving separate copies of RIFF. You can choose another permanent folder if you prefer.

If you already downloaded this repository, use its existing folder and run the last two commands there. You don't need a second copy.

## Register the Claude Code plugin once

Claude Code finds the RIFF skills and subagents through a plugin. Register its marketplace once per computer, from the RIFF folder:

```sh
claude plugin marketplace add ~/riff-codex/riff
```

This only tells Claude Code where RIFF lives. Each project then turns the plugin on for itself when you connect it. You can skip this step if you only use Codex.

## Connect a project

Open Terminal in your application's folder, or replace the example path below:

```sh
cd /path/to/your-project
riff init
```

For a completely new folder, create it and start its Git history first:

```sh
mkdir my-recipe-app
cd my-recipe-app
git init
riff init
```

RIFF asks about the project scope, conversation language, document language, explanation level, and autonomy. The default **loop** mode keeps moving through ready work. **Guided** pauses at planning decisions and between steps.

Initialization connects the tools. It doesn't write your product plan or build your application yet. It creates:

- `.riff-cli`, a link to your RIFF folder, and `.riff-data/`, the project's RIFF state. Both stay out of Git.
- Git hooks that check commits.
- For Claude Code, `.claude/settings.local.json`: RIFF's automatic checks, the plugin switched on, and context compaction at 400,000 tokens. This file is specific to your computer and stays out of Git. RIFF never edits your project's `CLAUDE.md`.
- For Codex, `.codex/hooks.json` and the skill links under `.agents/skills/riff-codex-*`.

## Check the installation

```sh
riff doctor
```

Read any `ERROR` or `WARN` line. A missing roadmap is normal before your first `start` or `onboard`.

For Claude Code, `doctor` checks the hooks, the compaction setting, the plugin marketplace, and that `claude` is available. If it reports the marketplace missing, run the command from [Register the Claude Code plugin once](#register-the-claude-code-plugin-once).

For Codex, `doctor` also reports whether you've approved the hooks. See [Approve the Codex hooks](#approve-the-codex-hooks).

## Use RIFF in Claude Code

Open a new Claude Code session in the project. On the first session, Claude Code installs the RIFF plugin by itself. You then have:

- the skills `/riff:start`, `/riff:wave`, `/riff:quick`, `/riff:status` and the others;
- subagents named after RIFF's model profiles, such as `riff:sonnet-5-5-medium`, each with its model and effort fixed. RIFF uses them when a wave delegates work;
- the RIFF context, injected automatically when a session starts, resumes, or restarts after `/clear` or a compaction.

Every skill is available except `deep-audit`, which routes to Codex Security and stays in Codex.

Try a first request. Use start for a new idea, or onboard for an existing app:

```text
/riff:start I want a simple app where I can save and find my recipes.
```

Read the project brief and roadmap it produces, then enter:

```text
/riff:wave
```

### Independent reviews

When a phase, a dossier or the final version is ready, RIFF runs `riff review run`. It asks another model to attack the work read-only: GPT-6 Astra through the Codex CLI, then GPT-6.1 Sol, then a fresh Claude session, moving to the next one only when a reviewer can't run (missing CLI, not signed in, quota). A negative review is never skipped. The agent corrects what the reviewer finds and records the result itself, without asking you. Each review takes about a minute.

Security findings are corrected during the wave and never stop it. A point that needs a security expert's judgment rather than a code fix gets the most cautious interim decision that keeps the app working, documented in its note. Delivery isn't blocked: `riff finish --check` lists these points so you can show them to an expert when one is available.

Reviews run the same way whichever host builds. A review files its result under `.riff-data/reviews/`, and the dashboard shows which reviewer ran, with a label when it comes from the same model family as the builder.

`riff doctor` shows whether the Codex and Claude reviewers are available. To change the order, the models or the effort, add a `reviewers` object to `.riff-data/config.json`, for example:

```json
"reviewers": {
  "chain": [{ "via": "codex", "model": "gpt-6-astra" }, { "via": "claude", "model": "opus" }],
  "effort": { "default": "medium", "security": "high", "delivery": "high" }
}
```

The [technical reference](technical-reference.md#review-bridge) details the chain, the fallback rules and every setting.

[Continue with the everyday guide](usage.md).

## Use RIFF in Codex

A skill is a named instruction you choose in Codex, such as "start" or "wave." There are two ways Codex gets them:

- **Project installation:** `riff init` adds the RIFF skills to the project. Open the project in a fresh Codex session, then select the relevant RIFF entry in the skill picker. The entries are stored under `.agents/skills/riff-codex-*`.
- **Native RIFF plugin:** enabling the local plugin from this checkout's `riff/` folder supplies the exact `$riff:start`, `$riff:wave` and other `$riff:...` names. Its definition is in `riff/.codex-plugin/plugin.json`. `npm link` and `riff init` don't enable that plugin in Codex.

If `$riff:wave` isn't recognized, use the project skill picker after reopening the session.

### Approve the Codex hooks

Hooks are automatic checks that run at certain moments while the agent works. If `riff doctor` reports matching system-managed hooks, reload the Codex configuration or restart the app; no individual approval is needed. Otherwise, open `/hooks` in Codex, review the RIFF project hooks, and approve them. Only after approving them, run:

```sh
riff doctor --record-hooks-approved
```

The command records that you approved the current checks. It can't give that approval on your behalf.

## Change your preferences

In your project's Terminal:

```sh
riff init --configure
```

Choose the conversation language, document language, explanation level, scope, and autonomy again. Your existing product brief and roadmap are preserved.

Model advice has a separate per-project preference. It defaults to advice from the current agent using RIFF's catalogue:

```sh
riff model-advice configure --mode local
```

To allow Jev through OpenRouter for this project, explicitly permit curated decision summaries:

```sh
riff model-advice configure --mode jev --allow-jev-summary
```

Use `--mode off` to disable advice. Switching to `local` or `off` revokes the persistent Jev-summary permission. Credentials stay in the environment; RIFF doesn't store them in project state. Configuring advice doesn't switch the active model, call the provider immediately, resync another project, or activate the setting globally. See [optional model advice](model-advice.md) for the data boundary and one-off commands.

## Update RIFF

Because your projects use the same RIFF folder, an update can affect all of them. Finish active work before updating.

In the RIFF folder, check for your own edits first:

```sh
cd ~/riff-codex
git status
```

If it reports a clean working tree, download the update:

```sh
git pull --ff-only
npm install
```

Then run the following once in each project using RIFF. It refreshes the installation files for both hosts and preserves the project brief, roadmap and preferences:

```sh
riff resync
riff doctor
```

Projects linked to that folder immediately read its updated files. Start a fresh session to load updated skill instructions; a running conversation may keep earlier ones. Restart an already-running dashboard and reload its page when an update changes the dashboard server.

A different RIFF folder or another machine needs its own update. If Git reports local edits or refuses the update, keep those edits and resolve the reported issue before continuing.

### Projects connected before the rename

Projects connected before RIFF was renamed have `.riff-codex` and `.riff-codex-state/`. When no phase is active, `riff resync` moves the state to `.riff-data/`, after a full backup in `.riff-data/backups/`, and adds the `.riff-cli` link. The old names stay as links so nothing breaks. If a phase is active, the move waits and `resync` says so; run it again once the phase is finished.

## Common setup problems

| What you see | What to do |
| --- | --- |
| `riff: command not found` | Run `npm link` in the permanent RIFF folder, then reopen Terminal. |
| GitHub access denied | Check the signed-in account and its access to the private repository. |
| RIFF can't find a Git project | Enter your application's folder. For a new project, run `git init` there first. |
| `/riff:wave` is missing in Claude Code | Run `riff doctor`. Register the marketplace if it's missing, then open a new session in the project. |
| RIFF skills are missing in Codex | Open a fresh Codex session in the initialized project and check the skill picker. |
| Codex hook approval is pending | Review and approve in `/hooks`, then record the approval. |
| Bun is missing | Install Bun, then run `riff doctor` again. |
| `riff doctor` warns about `reviewer codex` | Install the Codex CLI or run `codex login`. Reviews still work through Claude meanwhile, labeled same-family. |
| The framework folder can't be found | Restore it to its original location. See the [technical reference](technical-reference.md) before changing existing links. |

## System-managed hooks on macOS

For an explicitly configured personal machine, [system-managed hooks](managed-hooks.md) let the Codex desktop runtime trust the RIFF hook set by policy. Installing the system TOML requires macOS administrator authorization once. RIFF detects a matching installation and removes duplicate Codex project hooks during `init` or `resync`; ordinary project installation remains the fallback.
