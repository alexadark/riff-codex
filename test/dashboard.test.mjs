import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import test from 'node:test';
import { groupFindings, portAvailable } from '../riff/lib/dashboard.mjs';

test('silent listeners keep their port and are not mistaken for stopped dashboards', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try { assert.equal(await portAvailable(port), false); }
  finally { await new Promise((resolve) => server.close(resolve)); }
  assert.equal(await portAvailable(port), true);
});

test('repeated findings merge before display limits without hiding severity or distinct phases', () => {
  const issue = { kind: 'secret', summary: 'Credential in config', affected: 'Service', phase: 'one', severity: 'HIGH', reviewedAt: '2026-09-13' };
  const input = [issue, { ...issue, severity: 'LOW', reviewedAt: '2026-09-14' }, { ...issue, phase: 'two' }];
  const grouped = groupFindings(input);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].severity, 'HIGH');
  assert.equal(grouped[0].occurrences, 2);
  assert.equal(grouped[0].firstSeen, '2026-09-13');
  assert.equal(grouped[0].lastSeen, '2026-09-14');
  assert.equal(input[0].occurrences, undefined);
});

test('code heuristics are observations while security and severe findings remain security findings', () => {
  const grouped = groupFindings([
    { kind: 'orphan_file', severity: 'LOW', summary: 'Diagnostic script' },
    { kind: 'route_auth', severity: 'MEDIUM', summary: 'Authentication decision' },
    { kind: 'orphan_file', severity: 'HIGH', summary: 'Escalated finding' },
  ]);
  assert.deepEqual(grouped.map((finding) => finding.category), ['code', 'security', 'security']);
});
