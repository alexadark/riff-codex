import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { inside } from './safety.mjs';

// This detects an installed system policy, not user hook approval or a live session reload.
export function managedHookPolicy(root, frameworkRoot) {
  const directory = '/etc/codex/riff';
  const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
  try {
    const file = path.join(directory, 'installation.json');
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o022)) return null;
    const policy = JSON.parse(readFileSync(file, 'utf8'));
    if (policy.version !== 1 || policy.uid !== process.getuid() || policy.frameworkRoot !== frameworkRoot || !inside(policy.projectsRoot, root)) return null;
    if (digest('/etc/codex/requirements.toml') !== policy.requirementsHash || digest(path.join(directory, 'managed-dispatch.mjs')) !== policy.dispatcherHash) return null;
    return policy;
  } catch { return null; }
}
