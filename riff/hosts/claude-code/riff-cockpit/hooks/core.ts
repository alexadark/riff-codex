// Pure rules for the RIFF cockpit: parse `riff-codex status`, decide what the band shows.
// The CLI stays the source of truth; M1 replaces this text parsing with `status --json`.

export type RiffStatus = {
  name: string
  completed: number
  total: number
  active: string | null
  next: string | null
  humanAction: string | null
}

const none = (value: string) => (value === 'none' ? null : value)

export function parseStatus(text: string): RiffStatus | null {
  const lines = String(text).trim().split('\n')
  const progress = lines[1]?.match(/^(\d+)\/(\d+) phases completed\. Active: (.+?)\. Next: (.+?)\.$/)
  const human = lines[2]?.match(/^Human action: (.+)$/)
  if (!progress || !human) return null
  const split = lines[0].indexOf(': ')
  return {
    name: split > 0 ? lines[0].slice(0, split) : lines[0],
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
