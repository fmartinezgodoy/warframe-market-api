import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const excluded = new Set(['.git', 'node_modules', 'dist', 'coverage', '.local', 'personal']);
function walk(dir = '.') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (excluded.has(entry.name)) return [];
    if (entry.isSymbolicLink()) throw new Error(`Symlink requires review: ${file}`);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const patterns = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY/],
  ['GitHub token', /(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/],
  ['bot token', /\b[0-9]{8,}:[A-Za-z0-9_-]{30,}/],
  ['AWS key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['credential URL', /(?:redis|rediss|postgres|https?):\/\/[^\s/]+:[^\s/@]+@/],
  ['private IPv4', /\b(?:10\.\d+|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+\b/],
  ['private operational reference', /(?:\/(?:home|Users)\/[A-Za-z0-9_.-]+|(?:[a-z0-9-]+\.)+(?:internal|lan)\b)/],
  ['hardcoded credential', /(?:password|secret|token|api[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_/-]{12,}['"]/i],
];
const findings = [];
function inspect(name, text) {
  for (const [label, regex] of patterns) if (regex.test(text)) findings.push(`${name}: ${label}`);
}
let count = 0;
for (const file of walk()) {
  if (/^(?:\.env(?:\.|$))/.test(path.basename(file)) && path.basename(file) !== '.env.example') findings.push(`${file}: real environment file`);
  if (/\.(?:db|sqlite|rdb|dump|pem|key|tar|gz|zip)$/.test(file)) findings.push(`${file}: forbidden data/archive`);
  inspect(file, fs.readFileSync(file, 'utf8')); count++;
}
if (fs.existsSync('.git')) {
  const objects = execFileSync('git', ['rev-list', '--objects', '--all'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const object of objects) {
    const sha = object.split(' ')[0];
    const type = execFileSync('git', ['cat-file', '-t', sha], { encoding: 'utf8' }).trim();
    if (type === 'blob' || type === 'commit') inspect(`history ${sha}`, execFileSync('git', ['cat-file', '-p', sha], { encoding: 'utf8' }));
  }
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
  for (const file of tracked) if (excluded.has(file.split('/')[0])) findings.push(`Tracked excluded path: ${file}`);
}
if (findings.length) { console.error([...new Set(findings)].join('\n')); process.exit(1); }
console.log(`Publication audit passed: ${count} working files and all reachable Git objects`);
