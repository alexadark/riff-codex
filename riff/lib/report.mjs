import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { localPath, phaseId } from './safety.mjs';

const escape = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function verificationEvidence(root, file, candidate) {
  const source = localPath(root, file);
  const manifest = JSON.parse(readFileSync(source, 'utf8'));
  if (manifest.version !== 1 || manifest.candidate !== candidate || !Array.isArray(manifest.steps) || !manifest.steps.length) throw new Error('verification evidence needs version 1, current candidate and nonempty steps');
  const images = new Map();
  for (const step of manifest.steps) {
    if (!step.name || !['pass', 'fail', 'unverified'].includes(step.status) || !step.observed) throw new Error('each verification step needs name, status and observed evidence');
    if (step.screenshot) {
      const screenshot = localPath(root, step.screenshot);
      const extension = path.extname(screenshot).toLowerCase();
      const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extension];
      if (!mime) throw new Error('screenshots must be PNG, JPEG or WebP');
      const bytes = readFileSync(screenshot);
      const valid = extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : extension === '.webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' : bytes[0] === 255 && bytes[1] === 216;
      if (!valid) throw new Error(`invalid screenshot bytes: ${step.screenshot}`);
      images.set(step.screenshot, { bytes, mime, extension, hash: hash(bytes) });
    }
  }
  return { manifest, images, hash: hash(JSON.stringify(manifest)) };
}

export function writeReport(root, { title, candidate, phase = 'verification', steps = [], validation, evidence }) {
  phaseId(phase);
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${phase}-${randomUUID().slice(0, 8)}`;
  const directory = localPath(root, `.uxtest/runs/${runId}`);
  mkdirSync(directory, { recursive: true });
  const allSteps = [...(validation ? [{ name: 'Automated checks', status: validation.status, observed: validation.summary, output: validation.output, expected: 'Command exits successfully for this candidate' }] : []), ...(evidence?.manifest.steps ?? steps)];
  const screenshots = [];
  const cards = allSteps.map((step, index) => {
    const image = evidence?.images.get(step.screenshot);
    let picture = '';
    if (image) {
      const name = `step-${index + 1}${image.extension}`;
      writeFileSync(path.join(directory, name), image.bytes);
      screenshots.push(name);
      picture = `<figure><img src="data:${image.mime};base64,${image.bytes.toString('base64')}" alt="${escape(step.name)}"><figcaption>${escape(step.url ?? '')} ${escape(step.viewport ?? '')}</figcaption></figure>`;
    }
    return `<article><header><span class="status ${escape(step.status)}">${escape(step.status.toUpperCase())}</span><h2>${index + 1}. ${escape(step.name)}</h2></header>${step.expected ? `<p><strong>Expected:</strong> ${escape(step.expected)}</p>` : ''}<p>${escape(step.observed)}</p>${picture}${step.output ? `<details><summary>Command output</summary><pre>${escape(step.output)}</pre></details>` : ''}${!image && step.kind === 'browser' ? '<p class="note">No screenshot attached.</p>' : ''}</article>`;
  }).join('');
  const counts = Object.fromEntries(['pass', 'fail', 'unverified'].map((status) => [status, allSteps.filter((step) => step.status === status).length]));
  const verdict = counts.fail ? 'FAIL' : counts.unverified || !allSteps.length ? 'UNVERIFIED' : 'PASS';
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escape(title)} · RIFF verification</title><style>
:root{color-scheme:light;--paper:#f5f2e9;--ink:#202421;--muted:#525950;--line:#c5c7bc}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 system-ui,sans-serif}main{max-width:1040px;margin:auto;padding:clamp(20px,5vw,64px)}.eyebrow{font:700 13px/1.5 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}h1{font:500 clamp(32px,5vw,60px)/1.08 Georgia,serif;max-width:18ch;margin:20px 0}h2{font-size:21px;line-height:1.3;margin:0}p{max-width:76ch;overflow-wrap:anywhere}.meta{color:var(--muted);font-size:14px;overflow-wrap:anywhere}.counts{display:flex;flex-wrap:wrap;gap:12px 28px;margin:32px 0;font-variant-numeric:tabular-nums}article{margin:32px 0;padding-block:28px;border-top:1px solid var(--line)}article header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.status{font:700 12px/1.5 ui-monospace,monospace;padding:4px 8px;border:1px solid currentColor}.pass{color:#275338}.fail{color:#952b28}.unverified{color:#755000}figure{margin:24px 0}img{display:block;max-width:100%;height:auto;border:1px solid var(--line)}figcaption,.note{color:var(--muted);font-size:14px}summary{cursor:pointer;min-height:44px;padding:10px 0;text-decoration:underline}summary:focus-visible{outline:3px solid #3159a6;outline-offset:3px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,monospace;background:#e9e8df;padding:20px}footer{border-top:1px solid var(--line);padding-top:24px;color:var(--muted);font-size:14px}@media print{main{padding:0}article{break-inside:avoid}}
</style><main><p class="eyebrow">RIFF / Verification evidence</p><h1>${escape(title)}</h1><p class="meta">Candidate ${escape(candidate)}<br>${escape(runId)}</p><div class="counts"><strong>${counts.pass} passed</strong><strong>${counts.fail} failed</strong><strong>${counts.unverified} unverified</strong></div>${cards || '<p>No checks recorded. Verification is incomplete.</p>'}<footer>Recorded checks for this candidate only. Missing evidence is not a passing result. No deployment or publication is implied.</footer></main></html>`;
  writeFileSync(path.join(directory, 'report.html'), html);
  writeFileSync(path.join(directory, 'UX-REPORT.md'), `# ${title}\n\nCandidate: ${candidate}\nVerdict: ${verdict}\n\n${allSteps.map((step) => `- ${step.status.toUpperCase()}: ${step.name}: ${step.observed}`).join('\n')}\n`);
  writeFileSync(path.join(directory, 'run.json'), JSON.stringify({ version: 1, run_id: runId, candidate, phase, verdict, title, flows: [{ id: phase, verdict: verdict === 'UNVERIFIED' ? 'blocked' : verdict.toLowerCase(), artifacts: { screenshots, report: 'report.html', commentary: 'UX-REPORT.md' }, human_checks: allSteps.filter((step) => step.status === 'unverified').map((step) => step.name) }], steps: allSteps }, null, 2));
  return { path: path.relative(root, path.join(directory, 'report.html')), runId, verdict, hash: hash(html), evidenceHash: evidence?.hash ?? null };
}
