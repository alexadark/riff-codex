import { expect, test } from 'claude-code/testing'
import { describe, describeContext, parseContext, parseStatus, summary, tabLines } from '../hooks/core.ts'

const ROOT = '/work/app'
const STATUS_JSON = JSON.stringify({
  schema: 'riff.status/1',
  version: '0.1.0',
  project: { name: 'TAMOS Outreach', objective: 'Build a guided discovery-first application.' },
  progress: { completed: 7, total: 15 },
  active: 'phase-8',
  next: null,
  humanAction: { reason: 'Scoped Brave Search API key is missing.' },
  phases: [
    { id: 'phase-7', title: 'Lead sourcing', status: 'completed' },
    { id: 'phase-8', title: 'Search provider', status: 'active' },
  ],
  findings: [{ id: 'f1', severity: 'HIGH', summary: 'Key logged in clear', phase: 'phase-8' }],
  reviews: { functional: { phase: 'phase-7', status: 'pass', summary: 'Leads import works', valid: true }, security: null },
})
const CONTEXT_JSON = JSON.stringify({
  schema: 'riff.wave-context/1',
  phase: { id: 'phase-8', title: 'Search provider', status: 'active', outcome: 'Search returns sourced companies' },
  checkpoint: { summary: 'Adapter written', next: 'Run a live sample' },
  checkpointStale: false,
  references: ['docs/search.md'],
})
const STATUS = [
  'TAMOS Outreach: Build a guided discovery-first application.',
  '7/15 phases completed. Active: phase-8. Next: none.',
  'Human action: Scoped Brave Search API key is missing.',
].join('\n')

function setup(on, world: { isGit: boolean; isRiff: boolean; firstNodeMissing?: boolean; legacyCli?: boolean; noPane?: boolean }) {
  const runs: string[][] = []
  on('session.start', () => ({ cwd: ROOT }))
  on('command.register', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: ROOT }))
  on('fs.exists', () => ({ value: world.isRiff }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.open', () => ({ value: world.noPane ? { isPlaced: false, reason: 'too narrow' } : { isPlaced: true } }))
  on('process.run', ($, e) => {
    runs.push(e.argv)
    if (e.argv[0] === 'git') return { value: { exitCode: world.isGit ? 0 : 128, stdout: `${ROOT}\n`, stderr: '' } }
    if (world.firstNodeMissing && e.argv[0] === 'node') return { deny: 'spawn node ENOENT' }
    const stdout = e.argv.includes('context') ? CONTEXT_JSON : world.legacyCli ? STATUS : STATUS_JSON
    return { value: { exitCode: 0, stdout, stderr: '' } }
  })
  return runs
}

async function start($) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: ROOT })
}

test('/riff-status answers from the RIFF CLI without a turn', async ($, on) => {
  const runs = setup(on, { isGit: true, isRiff: true })
  await start($)
  const answer = await $.command.run({ command: 'riff-status', args: '' })
  expect(answer.text).toBe(STATUS)
  expect(runs.some((argv) => argv.join(' ') === `node ${ROOT}/.riff-codex/bin/riff.mjs status --json`)).toBe(true)
})

test('a project linked to a CLI without --json still gets its status', async ($, on) => {
  setup(on, { isGit: true, isRiff: true, legacyCli: true })
  await start($)
  const answer = await $.command.run({ command: 'riff-status', args: '' })
  expect(answer.text).toBe(STATUS)
})

test('a missing node on PATH falls back to a known location', async ($, on) => {
  const runs = setup(on, { isGit: true, isRiff: true, firstNodeMissing: true })
  await start($)
  expect(runs.some((argv) => argv[0] === '/usr/local/bin/node')).toBe(true)
})

test('outside a RIFF project the commands say so', async ($, on) => {
  setup(on, { isGit: true, isRiff: false })
  await start($)
  for (const command of ['riff-status', 'riff-context', 'riff']) {
    const answer = await $.command.run({ command, args: '' })
    expect(answer.text).toMatch(/^Not a RIFF project/)
  }
})

test('/riff-context describes the phase in progress', async ($, on) => {
  setup(on, { isGit: true, isRiff: true })
  await start($)
  const answer = await $.command.run({ command: 'riff-context', args: '' })
  expect(answer.text).toMatch(/^phase-8 \(active\): Search provider\n/)
  expect(answer.text).toContain('Next: Run a live sample')
})

test('/riff opens the pane, or answers in text where no pane can be placed', async ($, on) => {
  setup(on, { isGit: true, isRiff: true, noPane: true })
  await start($)
  const answer = await $.command.run({ command: 'riff', args: '' })
  expect(answer.text).toContain('## Roadmap\n✓ phase-7  Lead sourcing\n▶ phase-8  Search provider')
  expect(answer.text).toContain('## Findings\nHIGH  Key logged in clear  (phase-8)')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the pane tabs switch on press (${surface})`, async ($, on) => {
    setup(on, { isGit: true, isRiff: true })
    await start($)
    expect((await $.command.run({ command: 'riff', args: '' })).text).toBe('RIFF cockpit opened.')
    const ui = await $.ui.mount({
      plugin: 'riff-cockpit',
      surface,
      component: 'Pane',
      requestId: 'riff',
      props: { title: 'RIFF', isFocused: true, bodyColumns: 80, placement: 'dock' } as never,
    })
    expect(await ui.find({ text: '▶ phase-8  Search provider' })).toBeDefined()
    await ui.press({ key: 'tab-findings' })
    expect(await ui.find({ text: 'HIGH  Key logged in clear  (phase-8)' })).toBeDefined()
    await ui.press({ key: 'tab-reviews' })
    expect(await ui.find({ text: 'functional: pass on phase-7 · Leads import works' })).toBeDefined()
  })
}

test('status JSON is read into the band fields', () => {
  const status = parseStatus(STATUS_JSON)
  expect(status).toMatchObject({ name: 'TAMOS Outreach', completed: 7, total: 15, active: 'phase-8', next: null })
  expect(status?.humanAction).toBe('Scoped Brave Search API key is missing.')
  expect(describe(status!)).toBe(STATUS)
  expect(summary(status!, 120)).toBe('TAMOS Outreach · 7/15 phases · active phase-8 · 1 open finding')
  expect(parseStatus(JSON.stringify({ schema: 'other/1' }))).toBe(null)
})

test('status text is parsed into the band fields, without the tab data', () => {
  const status = parseStatus(STATUS)
  expect(status).toMatchObject({ name: 'TAMOS Outreach', completed: 7, total: 15, active: 'phase-8', next: null })
  expect(summary(status!, 120)).toBe('TAMOS Outreach · 7/15 phases · active phase-8')
  expect(tabLines('roadmap', status!, null)).toEqual(['Update the RIFF CLI linked by .riff-codex to see this tab.'])
  expect(parseStatus('something else')).toBe(null)
})

test('the phase tab flags a stale checkpoint', () => {
  const context = parseContext(CONTEXT_JSON)!
  expect(describeContext({ ...context, checkpointStale: true })).toContain('Checkpoint (stale: the code changed since): Adapter written')
  expect(describeContext(null)).toMatch(/did not answer/)
  expect(describeContext(null, 'RIFF: discovery file is missing')).toBe('No wave context. RIFF: discovery file is missing')
})
