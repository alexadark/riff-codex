export function selectReadyPhase(phases) {
  const completed = new Set(phases.filter((phase) => ['completed', 'skipped'].includes(phase.status)).map((phase) => phase.id));
  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return phases.filter((phase) => phase.status === 'ready' && (phase.depends_on ?? []).every((id) => completed.has(id)))
    .sort((left, right) => (rank[left.priority] ?? 4) - (rank[right.priority] ?? 4))[0] ?? null;
}
