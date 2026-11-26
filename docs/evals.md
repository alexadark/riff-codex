# Compare two versions of RIFF

[Back to the README](../README.md) · [Technical reference](technical-reference.md)

`npm run eval` gives the same small task to two Git revisions of this repository and reports what each one did. It is for people who change RIFF itself.

## When to run it

Run it when a change can alter what an agent does: a skill, a reference, a hook or a CLI refusal. `npm test` already covers the CLI's own behavior, and a change to documentation needs neither.

It needs Git, `tar`, Bash, Node.js 20 or newer and npm, on macOS or Linux. A model run also needs the Claude CLI, signed in. Both revisions must be commits, so commit the change on its branch first.

## Dry run

```sh
npm run eval -- --old main --new HEAD --dry
```

The dry run does everything except call the model, and costs nothing: it checks out both revisions, installs their dependencies, sets up the fixture project, replaces the model with a fixed edit, measures the result and writes the report. `npm test` runs it from a fresh clone. Its numbers say nothing about the revisions.

## Model run

```sh
npm run eval -- --old main --new HEAD --runs 2 --max-usd 4
```

`--runs` is the number of runs per arm and `--max-usd` the spending limit for the whole comparison; both are required. Each run gets an equal share of the limit, passed to the Claude CLI, and no run starts once the limit is spent. The CLI checks its share between two model turns, so a run can go over by the cost of one turn. A run that ends without a cost counts for its whole share. The amounts are the CLI's own cost estimate; with a subscription they measure usage rather than a bill.

`--skill` picks the task: `quick` (one error message to change) or `wave` (two roadmap phases, far longer). `--model` and `--effort` default to `opus` and `medium`. `--timeout-minutes` bounds one run, 30 by default. To see how much two runs of the same version differ, give the same revision to both arms.

## What a run can touch

- Everything happens in one scratch folder under the system's temporary folder: both revisions, the fixture project and a home folder for the tools. It is removed at the end, also after Ctrl+C or a failure. Only a forced kill leaves it behind (`riff-ab-*`).
- User settings, instructions, memory, skills, agents, plugins and MCP servers stay out: only the fixture's project settings load, and the RIFF skills come from the arm's revision. The first event of each session lists its MCP servers, plugins, skills and agents; a session that loaded one of yours, or another plugin, is stopped, the comparison ends, and its runs don't count. Your instruction files don't appear in that event: `/context` in the same setup showed none, but each run doesn't check them. Settings managed by an organization still apply.
- The environment is rebuilt from a short list. The model process keeps its login and the real home folder to find it; the commands it runs get the scratch home and none of the Claude login variables. Claude Code may still bring your shell's aliases and functions into those commands.
- The fixture has no Git remote, Git refuses every transport, and the GitHub CLI and package publishing have no credentials.
- External reviewers are turned off, because their cost is outside the limit. A wave falls back on a native subagent for its reviews, so it doesn't measure the usual review chain.

These are guards against accidents, not a sandbox: the agent runs shell commands as you. Compare revisions you would run yourself.

## Read the report

The report goes to `test/ab/runs/`, which Git ignores: `report.md`, the same data in `report.json`, and for each run its stream, its patch and its logs. They can hold local paths; don't publish them as they are.

- **Each run** comes first. *Goal met* is checked on the committed code (`quick`) or on the recorded phases (`wave`), and *Tests pass* by running the tests, never from the agent's own report. A run that timed out, failed, hit its share or wasn't isolated is listed and not counted.
- **Spread** gives the smallest, median and largest cost, time and turns of the counted runs.
- **Reading** stays at "Not enough data" below five counted runs per arm. From there it says, for each measure, whether the two ranges are separate or overlap. Overlapping ranges show no clear difference; separate ones describe this task, on this model, on that day.

One run proves nothing: the same revision can cost twice as much the next time. Look at the goal first, then at the spread. If runs weren't counted, read why before comparing costs: dropping the runs that failed makes an arm look cheaper.
