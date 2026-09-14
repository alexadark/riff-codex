import { createHash } from 'node:crypto';
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

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function observationList(state) {
  return groupFindings(state.securityFindings ?? []).reverse().map((finding) => {
    const id = digest([finding.kind, finding.summary, finding.affected, finding.phase]);
    const revision = digest([finding.occurrences, finding.lastSeen, finding.severity]);
    const review = state.observationReviews?.[id] ?? null;
    return { ...finding, id, revision, review,
      status: review?.revision === revision ? review.status : 'pending',
      reopened: Boolean(review && review.revision !== revision),
    };
  });
}

export function reviewObservation(state, { id, revision, status, note }) {
  if (!['pending', 'resolved', 'false_positive'].includes(status)) throw new Error('Invalid observation status');
  if (typeof note !== 'string' || note.trim().length < 3 || note.length > 2000) throw new Error('A reason between 3 and 2000 characters is required');
  const finding = observationList(state).find((entry) => entry.id === id);
  if (!finding) throw new Error('Observation not found');
  if (finding.revision !== revision) throw new Error('Observation changed; reload before reviewing it');
  const review = { id, revision, status, note: note.trim(), at: new Date().toISOString() };
  state.observationReviews ??= {};
  state.observationReviews[id] = review;
  state.observationHistory ??= [];
  state.observationHistory.push(review);
  return review;
}
