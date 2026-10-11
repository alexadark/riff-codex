// RIFF cockpit: a band above the prompt with the project's RIFF progress and a /cockpit
// pane with Roadmap, Phase, Findings and Reviews tabs and a button that (re)starts the
// shared dashboard. Outside a RIFF project it draws nothing. The command stays out of
// the `riff` prefix so typing /riff lists the RIFF skills, not the cockpit.
//
// Refreshed when the session starts, after each main turn and after each Bash call that
// runs the RIFF CLI. The mod never writes RIFF state: it runs the project's own CLI
// through the `.riff-cli` link (`.riff-codex` before the rename), so it shows exactly what `status --json` and
// `wave context --json` report.

import {
  clip,
  parseContext,
  parseStatus,
  summary,
  tabLines,
  TAB_LABELS,
  TABS,
  type RiffStatus,
  type Tab,
  type WaveContext,
} from './core.ts'

// Node may be missing from the app's PATH (nvm), so known locations follow.
const NODES = ['node', '/usr/local/bin/node', '/opt/homebrew/bin/node']
const PANE = 'riff'
const COMMAND = 'cockpit'
const NOT_RIFF = 'Not a RIFF project: no .riff-cli or .riff-codex link at the repository root.'
// Projects not yet migrated by `riff resync` only have the pre-rename link.
const LINKS = ['.riff-cli', '.riff-codex']
const RIFF_COMMAND = /(^|[\s;&|/])(riff|riff-codex|riff\.mjs)(\s|$)/

let status: RiffStatus | null = null
let raw: string | null = null
let context: WaveContext | null = null
let contextError: string | null = null
let tab: Tab = 'roadmap'
let root: string | null = null
let script: string | null = null
let dashboard: string | null = null

export function register(on) {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: COMMAND, description: 'Open the RIFF cockpit: roadmap, phase, findings, reviews, dashboard' })
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await refresh($)
    return result
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (RIFF_COMMAND.test(e.command ?? '')) await refresh($)
    return ran
  })

  on('command.run', { command: COMMAND }, async ($) => {
    await refresh($)
    if (!status) return { text: raw ?? NOT_RIFF }
    const opened = await $.ui.open({ id: PANE, title: `RIFF · ${status.name}`, closeOnEscape: true })
    if (opened.isPlaced) return { text: 'RIFF cockpit opened.' }
    // No pane here (narrow terminal, an extension, a headless run): answer in text.
    return { text: TABS.map((one) => `## ${TAB_LABELS[one]}\n${tabLines(one, status!, context, contextError).join('\n')}`).join('\n\n') }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    if (!status) return Text({ dimColor: true, children: NOT_RIFF })
    const columns = e.props?.bodyColumns ?? e.viewport?.columns ?? 80
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 4)
    const tabs = TABS.map((one, index) =>
      Button({
        key: `tab-${one}`,
        hotkey: String(index + 1),
        plain: true,
        dimColor: one !== tab,
        label: TAB_LABELS[one],
        onPress: () => {
          tab = one
          $.ui.invalidate('ui.render')
        },
      }),
    )
    const restart = Button({
      key: 'dashboard',
      hotkey: 'd',
      label: dashboard === STARTING ? 'Dashboard…' : 'Restart dashboard',
      onPress: () => void startDashboard($),
    })
    const lines = tabLines(tab, status, context, contextError)
    return Box({
      flexDirection: 'column',
      children: [
        Box({ flexDirection: 'row', gap: 2, children: [...tabs, restart] }),
        ...(dashboard && dashboard !== STARTING ? [Text({ dimColor: true, children: clip(dashboard, Math.max(20, columns - 2)) })] : []),
        ...lines.slice(0, room).map((line) => Text({ children: clip(line, Math.max(20, columns - 2)) })),
        ...(lines.length > room ? [Text({ dimColor: true, children: `… ${lines.length - room} more` })] : []),
      ],
    })
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if ((e.props?.hasSurvey ?? e.hasSurvey) || !status) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const columns = e.props?.bodyColumns ?? e.bodyColumns ?? 80
    const rows = [
      Box({
        flexDirection: 'row',
        children: [
          Text({ color: 'magenta', bold: true, children: 'RIFF  ' }),
          Text({ children: summary(status, columns) }),
        ],
      }),
    ]
    if (status.humanAction) {
      rows.push(Text({ color: 'red', children: clip(`Needs you: ${status.humanAction}`, Math.max(20, columns - 2)) }))
    }
    return Box({ flexDirection: 'column', paddingX: 1, children: rows })
  })
}

const STARTING = 'starting'

// `riff dashboard` starts the shared server when it is down, restarts it when the
// framework changed, reuses it otherwise, and opens it in the browser.
async function startDashboard($) {
  if (!script || !root || dashboard === STARTING) return
  dashboard = STARTING
  $.ui.invalidate('ui.render')
  const run = await runCli($, script, root, ['dashboard'], 60000)
  dashboard = run.ok ? run.text.split('\n').find((line) => line.startsWith('RIFF dashboard:')) ?? run.text : `Dashboard failed: ${run.text}`
  $.ui.toast(dashboard)
  $.ui.invalidate('ui.render')
}

async function refresh($) {
  const cwd = await $.session.cwd()
  const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd, timeoutMs: 5000 })
  root = top.exitCode === 0 ? top.stdout.trim() : null
  script = null
  for (const link of root ? LINKS : []) {
    if (await $.fs.exists(`${root}/${link}/bin/riff.mjs`)) { script = `${root}/${link}/bin/riff.mjs`; break }
  }
  // An older CLI ignores --json on status and prints its text output, which parseStatus also reads.
  const statusRun = script ? await runCli($, script, root, ['status', '--json']) : null
  raw = statusRun?.ok ? statusRun.text : null
  status = raw ? parseStatus(raw) : null
  // `wave context` has always printed JSON; no flag keeps older CLIs answering.
  const contextRun = status ? await runCli($, script, root, ['wave', 'context']) : null
  context = contextRun?.ok ? parseContext(contextRun.text) : null
  contextError = contextRun && !contextRun.ok ? contextRun.text : null
  $.ui.invalidate('ui.render')
}

// The CLI's answer, or the first line of its error so the cockpit can say why it failed.
async function runCli($, script: string, root: string, args: string[], timeoutMs = 10000): Promise<{ ok: boolean; text: string }> {
  let failure = { ok: false, text: 'node was not found' }
  for (const node of NODES) {
    try {
      const run = await $.process.run([node, script, ...args], { cwd: root, timeoutMs })
      if (run.exitCode === 0) return { ok: true, text: run.stdout.trim() }
      failure = { ok: false, text: (run.stderr || run.stdout).trim().split('\n')[0] || `exit code ${run.exitCode}` }
    } catch {
      // try the next location
    }
  }
  return failure
}
