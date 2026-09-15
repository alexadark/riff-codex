import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { localPath } from './safety.mjs';

export const DISCOVERY_MANIFEST = 'docs/specs/readiness.json';
export const DISCOVERY_AREAS = [
  'product', 'stories', 'journeys', 'wireframes', 'design', 'data',
  'architecture', 'verification', 'risks', 'roadmap', 'decisions', 'diagrams',
];
export const DISCOVERY_REQUIRED_FILES = ['PROJECT.md', 'ROADMAP.yaml', 'taste.md'];

const digestBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');

function regularNonEmpty(root, relative) {
  const file = localPath(root, relative);
  let stat;
  try {
    stat = lstatSync(file);
  } catch (error) {
    throw new Error(`discovery file is missing: ${relative}`);
  }
  if (!stat.isFile() || stat.size === 0) throw new Error(`discovery file must be a non-empty regular file: ${relative}`);
  // localPath rejects symlink components, including the final path component.
  if (stat.isSymbolicLink()) throw new Error(`discovery file cannot be a symlink: ${relative}`);
  return file;
}

function substantiveReason(value) {
  return typeof value === 'string' && value.trim().length >= 10;
}

export function readDiscoveryManifest(root) {
  const manifestFile = regularNonEmpty(root, DISCOVERY_MANIFEST);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    throw new Error(`discovery manifest is invalid JSON: ${error.message}`);
  }
  if (!manifest || manifest.version !== 1 || !manifest.areas || typeof manifest.areas !== 'object' || Array.isArray(manifest.areas)) {
    throw new Error('discovery manifest must use version 1 with an areas mapping');
  }
  const keys = Object.keys(manifest.areas);
  const missing = DISCOVERY_AREAS.filter((area) => !keys.includes(area));
  const extra = keys.filter((area) => !DISCOVERY_AREAS.includes(area));
  if (missing.length) throw new Error(`discovery manifest is missing areas: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`discovery manifest has unsupported areas: ${extra.join(', ')}`);

  const declared = [];
  for (const area of DISCOVERY_AREAS) {
    const entry = manifest.areas[area];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`discovery area ${area} must be a mapping`);
    const hasFiles = Object.prototype.hasOwnProperty.call(entry, 'files');
    const hasReason = Object.prototype.hasOwnProperty.call(entry, 'not_applicable');
    if (hasFiles === hasReason) throw new Error(`discovery area ${area} must declare files or a substantive not_applicable reason`);
    if (hasReason) {
      if (!substantiveReason(entry.not_applicable)) throw new Error(`discovery area ${area} needs a substantive not_applicable reason`);
      continue;
    }
    if (!Array.isArray(entry.files) || entry.files.length === 0 || entry.files.some((file) => typeof file !== 'string' || !file.trim())) {
      throw new Error(`discovery area ${area} files must be a non-empty array of relative paths`);
    }
    for (const relative of entry.files) {
      if (path.isAbsolute(relative) || path.win32.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error(`discovery file must stay within the project: ${relative}`);
      regularNonEmpty(root, relative);
      declared.push(relative.replaceAll(path.sep, '/'));
    }
  }
  const files = [...new Set([...DISCOVERY_REQUIRED_FILES, ...declared, DISCOVERY_MANIFEST])];
  files.forEach((relative) => regularNonEmpty(root, relative));
  return { manifest, files };
}

export function discoveryDigest(root, files) {
  const entries = files.map((relative) => {
    const file = regularNonEmpty(root, relative);
    return `${relative.replaceAll(path.sep, '/')}\0${digestBytes(readFileSync(file))}`;
  });
  return digestBytes(Buffer.from(entries.join('\n')));
}

export function discoverySnapshot(root) {
  const { manifest, files } = readDiscoveryManifest(root);
  return { version: manifest.version, manifest: DISCOVERY_MANIFEST, files, digest: discoveryDigest(root, files) };
}
