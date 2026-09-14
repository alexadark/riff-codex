import { createServer } from 'node:net';

// A silent or non-HTTP listener still owns its port. Never stop it by a saved PID.
export async function portAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ port, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

export function groupFindings(findings = []) {
  const groups = new Map();
  const ranks = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  for (const finding of findings) {
    const key = JSON.stringify([finding.kind, finding.summary, finding.affected, finding.phase]);
    const previous = groups.get(key);
    const severity = previous && ranks.indexOf(previous.severity) > ranks.indexOf(finding.severity) ? previous.severity : finding.severity;
    groups.delete(key);
    groups.set(key, { ...finding, severity, occurrences: (previous?.occurrences ?? 0) + 1,
      firstSeen: previous?.firstSeen ?? finding.reviewedAt, lastSeen: finding.reviewedAt });
  }
  return [...groups.values()].map((finding) => ({ ...finding,
    category: ['orphan_file', 'todo_without_reference'].includes(finding.kind) && ['INFO', 'LOW'].includes(finding.severity) ? 'code' : 'security',
  }));
}
