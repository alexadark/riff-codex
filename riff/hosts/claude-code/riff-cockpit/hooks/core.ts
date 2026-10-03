// Pure rules for the RIFF cockpit: read `riff-codex status --json` and `wave context --json`,
// decide what the band, the pane tabs and the text commands show.
// The CLI stays the source of truth; the text parser only serves projects linked to an older CLI.

export type Phase = { id: string; title: string | null; status: string }
export type Finding = { id: string; severity: string | null; summary: string | null; phase: string | null }
export type Review = { phase: string; status: string; summary: string | null; valid: boolean }

export type RiffStatus = {
  name: string
  objective: string | null
  completed: number
  total: number
  active: string | null
  next: string | null
  humanAction: string | null
  // Absent when the project's CLI predates these fields.
  phases: Phase[] | null
  findings: Finding[] | null
  reviews: { functional: Review | null; security: Review | null } | null
}

export type WaveContext = {
  phase: { id: string; title: string | null; status: string; outcome: string | null } | null
  checkpoint: { summary?: string; next?: string } | null
  checkpointStale: boolean
  references: string[]
}

export const TABS = ['roadmap', 'phase', 'findings', 'reviews'] as const
export type Tab = (typeof TABS)[number]
export const TAB_LABELS: Record<Tab, string> = { roadmap: 'Roadmap', phase: 'Phase', findings: 'Findings', reviews: 'Reviews' }

const none = (value: string) => (value === 'none' ? null : value)

/** Reads `riff status --json`, falling back to the text output of CLIs older than the JSON contract. */
export function parseStatus(text: string): RiffStatus | null {
  return parseStatusJson(text) ?? parseStatusText(text)
}

export function parseStatusJson(text: string): RiffStatus | null {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (data?.schema !== 'riff.status/1') return null
  return {
    name: data.project?.name ?? 'Unshaped project',
    objective: data.project?.objective ?? null,
    completed: data.progress.completed,
    total: data.progress.total,
    active: data.active ?? null,
    next: data.next?.id ?? null,
    humanAction: data.humanAction?.reason ?? null,
    phases: data.phases ?? null,
    findings: data.findings ?? null,
    reviews: data.reviews ?? null,
  }
}

export function parseStatusText(text: string): RiffStatus | null {
  const lines = String(text).trim().split('\n')
  const progress = lines[1]?.match(/^(\d+)\/(\d+) phases completed\. Active: (.+?)\. Next: (.+?)\.$/)
  const human = lines[2]?.match(/^Human action: (.+)$/)
  if (!progress || !human) return null
  const split = lines[0].indexOf(': ')
  return {
    name: split > 0 ? lines[0].slice(0, split) : lines[0],
    objective: split > 0 ? none(lines[0].slice(split + 2)) : null,
    completed: Number(progress[1]),
    total: Number(progress[2]),
    active: none(progress[3]),
    next: none(progress[4]),
    humanAction: none(human[1]),
    phases: null,
    findings: null,
    reviews: null,
  }
}

export function parseContext(text: string): WaveContext | null {
  try {
    const data = JSON.parse(text)
    return data && typeof data === 'object' && 'phase' in data ? data : null
  } catch {
    return null
  }
}

/** The /riff-status answer, in the same three lines as `riff status`. */
export function describe(status: RiffStatus): string {
  return [
    `${status.name}: ${status.objective ?? 'no objective yet'}`,
    `${status.completed}/${status.total} phases completed. Active: ${status.active ?? 'none'}. Next: ${status.next ?? 'none'}.`,
    `Human action: ${status.humanAction ?? 'none'}`,
  ].join('\n')
}

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`
}

/** The band's summary line, shortened to the terminal width. */
export function summary(status: RiffStatus, columns: number): string {
  const parts = [`${status.completed}/${status.total} phases`]
  if (status.active) parts.push(`active ${status.active}`)
  else if (status.next) parts.push(`next ${status.next}`)
  const findings = status.findings?.length ?? 0
  if (findings) parts.push(`${findings} open finding${findings > 1 ? 's' : ''}`)
  return clip(`${status.name} · ${parts.join(' · ')}`, Math.max(20, columns - 8))
}

const OLD_CLI = 'Update the RIFF CLI linked by .riff-codex to see this tab.'

/** The lines of one pane tab; also the text of /riff where no pane can be drawn. */
export function tabLines(tab: Tab, status: RiffStatus, context: WaveContext | null, contextError: string | null = null): string[] {
  if (tab === 'roadmap') {
    if (!status.phases) return [OLD_CLI]
    if (!status.phases.length) return ['No phases yet.']
    return status.phases.map((phase) => `${mark(phase.status)} ${phase.id}  ${phase.title ?? ''}`.trimEnd())
  }
  if (tab === 'phase') return describeContext(context, contextError).split('\n')
  if (tab === 'findings') {
    if (!status.findings) return [OLD_CLI]
    if (!status.findings.length) return ['No open findings.']
    return status.findings.map((f) => `${f.severity ?? '?'}  ${f.summary ?? f.id}${f.phase ? `  (${f.phase})` : ''}`)
  }
  if (!status.reviews) return [OLD_CLI]
  return (['functional', 'security'] as const).map((type) => {
    const review = status.reviews![type]
    if (!review) return `${type}: none yet`
    return `${type}: ${review.status} on ${review.phase}${review.valid ? '' : ' (stale)'}${review.summary ? ` · ${review.summary}` : ''}`
  })
}

/** The /riff-context answer: the phase in progress or next, its checkpoint and references. */
export function describeContext(context: WaveContext | null, error: string | null = null): string {
  if (!context) return error ? `No wave context. ${error}` : 'No wave context: the RIFF CLI did not answer.'
  if (!context.phase) return 'No active or ready phase.'
  const { phase, checkpoint } = context
  const lines = [`${phase.id} (${phase.status}): ${phase.title ?? ''}`.trimEnd()]
  if (phase.outcome) lines.push(`Outcome: ${phase.outcome}`)
  if (checkpoint) {
    lines.push(`Checkpoint${context.checkpointStale ? ' (stale: the code changed since)' : ''}: ${checkpoint.summary ?? ''}`)
    if (checkpoint.next) lines.push(`Next: ${checkpoint.next}`)
  } else lines.push('No checkpoint yet.')
  if (context.references.length) lines.push(`References: ${context.references.join(', ')}`)
  return lines.join('\n')
}

function mark(status: string): string {
  return { completed: '✓', skipped: '–', active: '▶', blocked: '!', parked: '‖', awaiting_human: '?' }[status] ?? '·'
}
