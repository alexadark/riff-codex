// Pure rules for the RIFF cockpit: read `riff-codex status --json`, decide what the band shows.
// The CLI stays the source of truth; the text parser only serves projects linked to an older CLI.

export type RiffStatus = {
  name: string
  objective: string | null
  completed: number
  total: number
  active: string | null
  next: string | null
  humanAction: string | null
}

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
  }
}

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`
}

/** The band's summary line, shortened to the terminal width. */
export function summary(status: RiffStatus, columns: number): string {
  const parts = [`${status.completed}/${status.total} phases`]
  if (status.active) parts.push(`active ${status.active}`)
  else if (status.next) parts.push(`next ${status.next}`)
  return clip(`${status.name} · ${parts.join(' · ')}`, Math.max(20, columns - 8))
}
