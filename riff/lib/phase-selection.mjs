const RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };

function readyPhases(phases) {
  const completed = new Set(phases.filter((phase) => ['completed', 'skipped'].includes(phase.status)).map((phase) => phase.id));
  return phases.filter((phase) => phase.status === 'ready' && (phase.depends_on ?? []).every((id) => completed.has(id)))
    .sort((left, right) => (RANK[left.priority] ?? 4) - (RANK[right.priority] ?? 4));
}

export function selectReadyPhase(phases) {
  return readyPhases(phases)[0] ?? null;
}

const ownedPath = (entry) => {
  const value = String(entry).replace(/\\/g, '/').replace(/^(\.\/+)+/, '').replace(/\/+$/, '');
  return value === '.' ? '' : value;
};

// Two owned path lists overlap when one entry equals or contains another; '.' owns the whole repository.
export function ownsOverlap(left = [], right = []) {
  return left.map(ownedPath).some((a) => right.map(ownedPath).some((b) => !a || !b || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)));
}

// A phase can run beside others only when every phase involved declares what it owns and nothing overlaps.
export function canRunBeside(phase, others) {
  return Boolean(phase.owns?.length) && others.every((other) => other.id === phase.id || (other.owns?.length && !ownsOverlap(other.owns, phase.owns)));
}

// Active phases first, then ready phases in priority order that fit beside everything already chosen.
export function selectParallelBatch(phases) {
  const batch = phases.filter((phase) => phase.status === 'active');
  for (const phase of readyPhases(phases)) {
    if (!batch.length || canRunBeside(phase, batch)) batch.push(phase);
  }
  return batch.length > 1 && batch.every((phase) => phase.owns?.length) ? batch : batch.slice(0, 1);
}
