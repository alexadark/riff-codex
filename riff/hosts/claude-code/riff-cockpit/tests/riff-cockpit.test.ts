import { expect, test } from 'claude-code/testing'
import { describe, parseStatus, summary } from '../hooks/core.ts'

const ROOT = '/work/app'
const STATUS_JSON = JSON.stringify({
  schema: 'riff.status/1',
  version: '0.1.0',
  project: { name: 'TAMOS Outreach', objective: 'Build a guided discovery-first application.' },
  progress: { completed: 7, total: 15 },
  active: 'phase-8',
  next: null,
  humanAction: { reason: 'Scoped Brave Search API key is missing.' },
})
const STATUS = [
  'TAMOS Outreach: Build a guided discovery-first application.',
  '7/15 phases completed. Active: phase-8. Next: none.',
  'Human action: Scoped Brave Search API key is missing.',
].join('\n')

function setup(on, world: { isGit: boolean; isRiff: boolean; firstNodeMissing?: boolean; legacyCli?: boolean }) {
  const runs: string[][] = []
  on('session.start', () => ({ cwd: ROOT }))
  on('command.register', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: ROOT }))
  on('fs.exists', () => ({ value: world.isRiff }))
  on('turn.complete', () => ({ text: '' }))
  on('process.run', ($, e) => {
    runs.push(e.argv)
    if (e.argv[0] === 'git') return { value: { exitCode: world.isGit ? 0 : 128, stdout: `${ROOT}\n`, stderr: '' } }
    if (world.firstNodeMissing && e.argv[0] === 'node') return { deny: 'spawn node ENOENT' }
    return { value: { exitCode: 0, stdout: world.legacyCli ? STATUS : STATUS_JSON, stderr: '' } }
  })
  return runs
}

test('/riff-status answers from the RIFF CLI without a turn', async ($, on) => {
  const runs = setup(on, { isGit: true, isRiff: true })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: ROOT })
  const answer = await $.command.run({ command: 'riff-status', args: '' })
  expect(answer.text).toBe(STATUS)
  expect(runs.at(-1)).toEqual(['node', `${ROOT}/.riff-codex/bin/riff.mjs`, 'status', '--json'])
})

test('a project linked to a CLI without --json still gets its status', async ($, on) => {
  setup(on, { isGit: true, isRiff: true, legacyCli: true })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: ROOT })
  const answer = await $.command.run({ command: 'riff-status', args: '' })
  expect(answer.text).toBe(STATUS)
})

test('a missing node on PATH falls back to a known location', async ($, on) => {
  const runs = setup(on, { isGit: true, isRiff: true, firstNodeMissing: true })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: ROOT })
  expect(runs.some((argv) => argv[0] === '/usr/local/bin/node')).toBe(true)
})

test('outside a RIFF project the command says so', async ($, on) => {
  setup(on, { isGit: true, isRiff: false })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: ROOT })
  const answer = await $.command.run({ command: 'riff-status', args: '' })
  expect(answer.text).toMatch(/^Not a RIFF project/)
})

test('status JSON is read into the band fields', () => {
  const status = parseStatus(STATUS_JSON)
  expect(status).toMatchObject({ name: 'TAMOS Outreach', completed: 7, total: 15, active: 'phase-8', next: null })
  expect(status?.humanAction).toBe('Scoped Brave Search API key is missing.')
  expect(describe(status!)).toBe(STATUS)
  expect(parseStatus(JSON.stringify({ schema: 'other/1' }))).toBe(null)
})

test('status text is parsed into the band fields', () => {
  const status = parseStatus(STATUS)
  expect(status).toMatchObject({ name: 'TAMOS Outreach', completed: 7, total: 15, active: 'phase-8', next: null })
  expect(status?.humanAction).toBe('Scoped Brave Search API key is missing.')
  expect(summary(status!, 120)).toBe('TAMOS Outreach · 7/15 phases · active phase-8')
  expect(parseStatus('something else')).toBe(null)
})
