import { lstatSync, mkdirSync, openSync, writeFileSync, closeSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

export function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

export function localPath(root, value) {
  const target = path.resolve(root, value);
  if (!inside(root, target)) throw new Error(`path escapes project: ${value}`);
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error(`symlink is not a writable evidence boundary: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}

export function phaseId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) throw new Error(`invalid phase id: ${id}`);
  return id;
}

export function withLock(root, action) {
  const directory = localPath(root, '.riff-codex-state');
  mkdirSync(directory, { recursive: true });
  return withFileLock(localPath(root, '.riff-codex-state/write.lock'), action);
}

export function withFileLock(lock, action) {
  mkdirSync(path.dirname(lock), { recursive: true });
  let fd;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { fd = openSync(lock, 'wx', 0o600); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const stat = lstatSync(lock);
      const record = JSON.parse(readFileSync(lock, 'utf8'));
      if (!stat.isFile() || !Number.isInteger(record.pid) || record.pid <= 0) throw new Error('invalid RIFF lock; inspect it before recovery');
      try { process.kill(record.pid, 0); throw new Error(`RIFF is busy in process ${record.pid}; retry after it finishes`); }
      catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
      const current = lstatSync(lock);
      if (current.ino !== stat.ino || current.dev !== stat.dev) throw new Error('RIFF lock changed during recovery');
      unlinkSync(lock);
    }
  }
  if (fd === undefined) throw new Error('could not acquire RIFF lock');
  writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  const owned = lstatSync(lock);
  closeSync(fd);
  const release = () => {
    try { const stat = lstatSync(lock); if (stat.ino === owned.ino && stat.dev === owned.dev) unlinkSync(lock); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  };
  process.once('exit', release);
  try { return action(); }
  finally { process.removeListener('exit', release); release(); }
}
