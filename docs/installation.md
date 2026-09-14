# Install RIFF for Codex

[Back to the README](../README.md) · [Everyday use](usage.md)

RIFF is installed once on your computer, then connected to each project you want to use it in. Your projects keep their own plans and progress.

## Before you begin

You need:

- **Codex**, installed and signed in. This is where you talk to RIFF.
- **Git**, which keeps a history of changes to your project.
- **Node.js 20 or newer**, which runs RIFF's commands. Its installer includes **npm**.
- **Bun**, which runs the local dashboard. RIFF's installation check also requires it.
- **Access to the private GitHub repository** `alexadark/riff-codex`.

To see which tools are already installed, run these in Terminal:

```sh
git --version
node --version
npm --version
bun --version
```

A version number means the tool is available. If Terminal says a command cannot be found, install that tool before continuing. If GitHub refuses the download, check that you are signed in with an account that has access to the repository.

## Download RIFF once

In Terminal:

```sh
git clone https://github.com/alexadark/riff-codex.git ~/riff-codex
cd ~/riff-codex
npm install
npm link
```

`npm install` downloads what RIFF needs. `npm link` makes the `riff-codex` command available on your computer. There is no published npm package to install instead.

Keep `~/riff-codex` in place. Projects refer to that folder rather than receiving separate copies of RIFF. You can choose another permanent folder if you prefer.

If you already downloaded this repository, use its existing folder and run the last two commands there. You do not need a second copy.

## Connect a project

Open Terminal in your application's folder, or replace the example path below:

```sh
cd /path/to/your-project
riff-codex init
```

For a completely new folder, create it and start its Git history first:

```sh
mkdir my-recipe-app
cd my-recipe-app
git init
riff-codex init
```

RIFF asks about the project scope, conversation language, document language, explanation level, and autonomy. The default **loop** mode keeps moving through ready work. **Guided** pauses at planning decisions and between steps.

Initialization connects the tools. It does not yet write your product plan or build your application.

## Make the skills available

A skill is a named instruction you choose in Codex, such as “start” or “wave.” There are two ways RIFF exposes them:

- **Project installation:** `riff-codex init` adds the RIFF skills to the project. Open the project in a fresh Codex session, then select the relevant RIFF entry in the skill picker. The installed entries are stored under `.agents/skills/riff-codex-*` and have descriptions such as “Shape a new product” and “Execute or resume RIFF roadmap phases.”
- **Native RIFF plugin:** enabling the local plugin from this checkout's `riff/` folder supplies the exact `$riff:start`, `$riff:wave`, and other `$riff:...` names used throughout these guides. Its definition is in `riff/.codex-plugin/plugin.json`. `npm link` and `riff-codex init` do not themselves enable that plugin in Codex.

If `$riff:wave` is not recognized, use the project skill picker after reopening the session. If there is more than one RIFF installation, select the entry from this RIFF Codex checkout. Do not substitute commands from the older Claude framework.

## Approve the automatic checks

In Codex, open `/hooks`, review the RIFF project hooks, and approve them. “Hooks” are automatic checks that run at certain moments while Codex works.

Only after approving them, run this in your project's Terminal:

```sh
riff-codex doctor --record-hooks-approved
```

The command records that you approved the current checks and reports setup problems. It cannot give that approval on your behalf. If your Codex interface does not expose the required approval controls, that setup step remains incomplete.

You can check the installation again without recording approval:

```sh
riff-codex doctor
```

Read any `ERROR` or `WARN` line. A missing roadmap is normal before your first `$riff:start` or `$riff:onboard`.

## Try your first request

In the Codex conversation, choose the start skill for a new idea or onboard for an existing app:

```text
$riff:start I want a simple app where I can save and find my recipes.
```

Read the project brief and roadmap it produces, then enter:

```text
$riff:wave
```

[Continue with the everyday guide](usage.md).

## Change your preferences

In your project's Terminal:

```sh
riff-codex init --configure
```

Choose the conversation language, document language, explanation level, scope, and autonomy again. Your existing product brief and roadmap are preserved.

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

Then, in each project using RIFF:

```sh
riff-codex resync
riff-codex doctor
```

If the hooks changed, review and approve them again in Codex before recording approval. If Git reports local edits or refuses the update, keep those edits and resolve the reported issue before continuing.

## Common setup problems

| What you see | What to do |
| --- | --- |
| `riff-codex: command not found` | Run `npm link` in the permanent RIFF folder, then reopen Terminal. |
| GitHub access denied | Check the signed-in account and its access to the private repository. |
| RIFF cannot find a Git project | Enter your application's folder. For a new project, run `git init` there first. |
| RIFF skills are missing | Open a fresh Codex session in the initialized project and check the skill picker. |
| Hook approval is pending | Review and approve in `/hooks`, then record the approval. |
| Bun is missing | Install Bun, then run `riff-codex doctor` again. |
| The framework folder cannot be found | Restore it to its original location. See the [technical reference](technical-reference.md) before changing existing links. |

## System-managed hooks on macOS

For an explicitly configured personal machine, [system-managed hooks](managed-hooks.md) allow the desktop runtime to trust the RIFF hook set by policy. Installing the system TOML requires macOS administrator authorization once. RIFF detects a matching installation and removes duplicate project hooks during `init` or `resync`; ordinary project installation remains the fallback.
