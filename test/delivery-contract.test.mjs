import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverySnapshot } from '../riff/lib/delivery-contract.mjs';

const roots = [];
const areas = ['product', 'stories', 'journeys', 'wireframes', 'design', 'data', 'architecture', 'verification', 'risks', 'roadmap', 'decisions', 'diagrams'];

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'riff-discovery-test-'));
  roots.push(root);
  for (const file of ['PROJECT.md', 'ROADMAP.yaml', 'taste.md']) writeFileSync(path.join(root, file), `${file}\n`);
  mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  const manifest = { version: 1, areas: Object.fromEntries(areas.map((area) => [area, { not_applicable: `No separate ${area} artifact is needed here.` }])) };
  writeFileSync(path.join(root, 'docs/specs/readiness.json'), `${JSON.stringify(manifest)}\n`);
  return root;
}

test.after(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

test('discovery validates the version 1 dossier, safe files, required artifacts and digest changes', () => {
  const root = fixture();
  const first = discoverySnapshot(root);
  assert.deepEqual(first.files, ['PROJECT.md', 'ROADMAP.yaml', 'taste.md', 'docs/specs/readiness.json']);
  writeFileSync(path.join(root, 'taste.md'), 'changed taste\n');
  assert.notEqual(discoverySnapshot(root).digest, first.digest);
  const manifest = { version: 1, areas: Object.fromEntries(areas.map((area, index) => [area, index === 0 ? { files: ['../outside.md'] } : { not_applicable: `No separate ${area} artifact is needed here.` }])) };
  writeFileSync(path.join(root, 'docs/specs/readiness.json'), JSON.stringify(manifest));
  assert.throws(() => discoverySnapshot(root), /stay within the project/);
  const external = path.join(root, 'external.md');
  writeFileSync(external, 'outside\n');
  manifest.areas.product.files = ['linked.md'];
  symlinkSync(external, path.join(root, 'linked.md'));
  writeFileSync(path.join(root, 'docs/specs/readiness.json'), JSON.stringify(manifest));
  assert.throws(() => discoverySnapshot(root), /symlink/);
  manifest.areas.product.files = ['PROJECT.md'];
  writeFileSync(path.join(root, 'docs/specs/readiness.json'), JSON.stringify(manifest));
  writeFileSync(path.join(root, 'taste.md'), '');
  assert.throws(() => discoverySnapshot(root), /non-empty regular file/);
});
