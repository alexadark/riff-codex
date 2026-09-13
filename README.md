```text
██████╗ ██╗███████╗███████╗
██╔══██╗██║██╔════╝██╔════╝
██████╔╝██║█████╗  █████╗
██╔══██╗██║██╔══╝  ██╔══╝
██║  ██║██║██║     ██║
╚═╝  ╚═╝╚═╝╚═╝     ╚═╝
```

# RIFF for Codex

**Build like a band of six. Ship like one.**

Turn an idea into working software, one checked step at a time.

You describe what you want. RIFF helps Codex keep a clear plan, build it in useful steps, check the result, and remember where to continue. You can follow the work without having to direct every move.

The slogan comes from the original RIFF for Claude Code. Here, Codex coordinates the work and brings in extra help when it is useful.

[Visual field manual](riff-documentation.html) · [Installation](docs/installation.md) · [Everyday use](docs/usage.md) · [How it works](docs/how-it-works.md)

The visual manual is a local HTML page: download or open `riff-documentation.html` in your browser. GitHub shows its source rather than a live preview.

## What RIFF does for you

- **Keeps the goal clear.** A short project brief says what you are building and what matters.
- **Breaks the work into useful steps.** Each step should produce something you can try.
- **Builds and checks.** Codex implements a step, checks it, and reviews the result before recording it as complete.
- **Remembers progress.** You can return later and continue the same project.
- **Shows where things stand.** A local dashboard displays the plan, completed work, and anything blocked.

RIFF works with Codex. You still need Codex installed and signed in.

## How the work flows

```mermaid
flowchart TD
    You[You describe what you want] --> Brief[Project brief: what we are building]
    Brief --> Plan[Roadmap: small useful steps]
    Plan --> Pick[Choose the next ready step]
    Pick --> Build[Codex builds it]
    Build --> Check[Check and review the result]
    Check -->|Pass| Save[Save the checked result and progress]
    Check -->|Fail| Fix[Try a focused correction]
    Fix --> CheckAgain[Check again]
    CheckAgain -->|Pass| Save
    CheckAgain -->|Still fails| Stop[Record the blocker]
    Save -->|More ready work| Pick
    Save -->|Everything complete| Done[Ready for you to try]
    Plan -.-> View[Dashboard: view progress]
    Save -.-> View
    Stop -.-> View
```

The brief is saved as `PROJECT.md`; the steps are saved as `ROADMAP.yaml`. The dashboard reads progress. You start the work in Codex.

By default, RIFF continues through ready steps automatically. You can choose **guided** mode if you prefer a pause between steps. Uploading code to GitHub or putting an application online still needs your instruction.

## Install

You need **Git**, **Node.js 20 or newer** (which includes npm), and **Bun** for the dashboard and the full installation check. The repository is currently private, so your GitHub account needs access. The [installation guide](docs/installation.md) explains each requirement.

**1. In Terminal, download RIFF once.** Keep this folder in place; your projects will use it.

```sh
git clone https://github.com/alexadark/riff-codex.git ~/riff-codex
cd ~/riff-codex
npm install
npm link
```

**2. In Terminal, connect your project to RIFF.** Replace the example path with your project's folder. It must already use Git; the guide includes the new-folder setup.

```sh
cd /path/to/your-project
riff-codex init
```

Choose your languages, how much explanation you want, and whether RIFF should continue automatically. Press Enter to accept the suggested choices.

**3. Open that project in Codex.** Start a fresh Codex session so it can find the installed RIFF skills. Open `/hooks` and review and approve RIFF's automatic checks. Once you have actually approved them, record that in the project's terminal:

```sh
riff-codex doctor --record-hooks-approved
```

This command records your approval and checks the setup. It does not approve anything for you.

## Start using it

The examples below go **in the Codex conversation**, not Terminal. They use the `$riff:...` names supplied by the RIFF plugin. If those names are unavailable, choose the corresponding RIFF skill from Codex's skill picker; [the installation guide explains the two ways to make skills available](docs/installation.md#make-the-skills-available).

**For a new idea:**

```text
$riff:start I want a simple app where I can save and find my recipes.
```

**For an application that already exists:**

```text
$riff:onboard Understand this app and make a plan for improving it.
```

These prepare the project brief and roadmap. Read them, then start building:

```text
$riff:wave
```

A “wave” means working through the next ready steps. Run the same command when you return to continue unfinished work. If RIFF has recorded a blocker, it needs to be resolved before that work can resume.

## What to ask next

| You want to… | Use in Codex |
| --- | --- |
| See progress and the next step | `$riff:status` |
| Open the dashboard | `$riff:dashboard` |
| Make a small, separate change | `$riff:quick Make the empty screen easier to understand.` |
| Fix something that is broken | `$riff:debug The save button does nothing.` |
| Add a larger improvement to the plan | `$riff:add-phase Let people share a recipe.` |
| Continue building | `$riff:wave` |

You can also open the dashboard from Terminal with `riff-codex dashboard`. It normally opens at `http://127.0.0.1:4000` on your computer.

## Read more when you need it

| Guide | What it answers |
| --- | --- |
| [Visual field manual](riff-documentation.html) | See the whole workflow, explore the diagram, and copy starter commands. |
| [Installation](docs/installation.md) | What do I need? How do I connect a project, update RIFF, or fix setup problems? |
| [Everyday use](docs/usage.md) | What should I type for a new project, existing app, fix, or interruption? |
| [How it works](docs/how-it-works.md) | Who does what? Where does the plan live? How do checks and progress connect? |
| [Technical reference](docs/technical-reference.md) | Which files, checks, and internal rules power RIFF? |

Already using RIFF for Claude Code? Both can share the same project brief and roadmap. Use only one of them to work on a given step at a time. [See the coexistence details](docs/technical-reference.md#using-riff-with-claude-code).
