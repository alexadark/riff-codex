// RIFF cockpit, M0 spike: a band above the prompt with the project's RIFF progress,
// refreshed when the session starts and after each main turn, and /riff-status,
// which answers at once without a Claude turn. Outside a RIFF project it draws nothing.
//
// The mod never writes RIFF state: it runs the project's own CLI through the
// `.riff-codex` link, so the band reads exactly what `riff-codex status --json` reports.

import { clip, describe, parseStatus, summary, type RiffStatus } from './core.ts'

// Node may be missing from the app's PATH (nvm), so known locations follow.
const NODES = ['node', '/usr/local/bin/node', '/opt/homebrew/bin/node']

let status: RiffStatus | null = null
let raw: string | null = null

export function register(on) {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'riff-status', description: 'RIFF progress for this project, read from the RIFF CLI' })
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await refresh($)
    return result
  })

  on('command.run', { command: 'riff-status' }, async ($) => {
    await refresh($)
    if (status) return { text: describe(status) }
    return { text: raw ?? 'Not a RIFF project: no .riff-codex link at the repository root.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.hasSurvey || !status) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const columns = e.bodyColumns ?? 80
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
  raw = script && (await $.fs.exists(script)) ? await runStatus($, script, root) : null
  status = raw ? parseStatus(raw) : null
  $.ui.invalidate('ui.render')
}

async function runStatus($, script: string, root: string): Promise<string | null> {
  for (const node of NODES) {
    try {
      // An older CLI ignores --json and prints its text output, which parseStatus also reads.
      const run = await $.process.run([node, script, 'status', '--json'], { cwd: root, timeoutMs: 10000 })
      if (run.exitCode === 0) return run.stdout.trim()
    } catch {
      // try the next location
    }
  }
  return null
}
