// RIFF cockpit: a band above the prompt with the project's RIFF progress, a /riff pane
// with Roadmap, Phase, Findings and Reviews tabs, and /riff-status and /riff-context,
// which answer at once without a Claude turn. Outside a RIFF project it draws nothing.
//
// Refreshed when the session starts, after each main turn and after each Bash call that
// runs the RIFF CLI. The mod never writes RIFF state: it runs the project's own CLI
// through the `.riff-codex` link, so it shows exactly what `status --json` and
// `wave context --json` report.

import {
  clip,
  describe,
  describeContext,
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
const NOT_RIFF = 'Not a RIFF project: no .riff-codex link at the repository root.'
const RIFF_COMMAND = /(^|[\s;&|/])(riff|riff-codex|riff\.mjs)(\s|$)/

let status: RiffStatus | null = null
let raw: string | null = null
let context: WaveContext | null = null
let contextError: string | null = null
let tab: Tab = 'roadmap'

export function register(on) {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'riff', description: 'Open the RIFF cockpit: roadmap, phase, findings, reviews' })
    await $.command.register({ name: 'riff-status', description: 'RIFF progress for this project, read from the RIFF CLI' })
    await $.command.register({ name: 'riff-context', description: 'The RIFF phase in progress, its checkpoint and references' })
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

  on('command.run', { command: 'riff-status' }, async ($) => {
    await refresh($)
    if (status) return { text: describe(status) }
    return { text: raw ?? NOT_RIFF }
  })

  on('command.run', { command: 'riff-context' }, async ($) => {
    await refresh($)
    return { text: status ? describeContext(context, contextError) : NOT_RIFF }
  })

  on('command.run', { command: 'riff' }, async ($) => {
    await refresh($)
    if (!status) return { text: NOT_RIFF }
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
    const lines = tabLines(tab, status, context, contextError)
    return Box({
      flexDirection: 'column',
      children: [
        Box({ flexDirection: 'row', gap: 2, children: tabs }),
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

async function refresh($) {
  const cwd = await $.session.cwd()
  const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd, timeoutMs: 5000 })
  const root = top.exitCode === 0 ? top.stdout.trim() : null
  const script = root ? `${root}/.riff-codex/bin/riff.mjs` : null
  // An older CLI ignores --json on status and prints its text output, which parseStatus also reads.
  const statusRun = script && (await $.fs.exists(script)) ? await runCli($, script, root, ['status', '--json']) : null
  raw = statusRun?.ok ? statusRun.text : null
  status = raw ? parseStatus(raw) : null
  // `wave context` has always printed JSON; no flag keeps older CLIs answering.
  const contextRun = status ? await runCli($, script, root, ['wave', 'context']) : null
  context = contextRun?.ok ? parseContext(contextRun.text) : null
  contextError = contextRun && !contextRun.ok ? contextRun.text : null
  $.ui.invalidate('ui.render')
}

// The CLI's answer, or the first line of its error so the cockpit can say why it failed.
async function runCli($, script: string, root: string, args: string[]): Promise<{ ok: boolean; text: string }> {
  let failure = { ok: false, text: 'node was not found' }
  for (const node of NODES) {
    try {
      const run = await $.process.run([node, script, ...args], { cwd: root, timeoutMs: 10000 })
      if (run.exitCode === 0) return { ok: true, text: run.stdout.trim() }
      failure = { ok: false, text: (run.stderr || run.stdout).trim().split('\n')[0] || `exit code ${run.exitCode}` }
    } catch {
      // try the next location
    }
  }
  return failure
}
