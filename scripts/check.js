#!/usr/bin/env node
/*
 * Correctness checks for state-sheet. Run: node scripts/check.js
 * For each example: the buggy component must have every seeded bug flagged,
 * and the fixed component must come back clean. Each sheet must render in under 30 s.
 * Writes the sheets to examples/<name>/out and examples/<name>/out-fixed.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const exDir = path.join(root, 'examples');
let fails = 0;
let passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  FAIL ' + msg); } };

for (const ex of fs.readdirSync(exDir).sort()) {
  const dir = path.join(exDir, ex);
  console.log(ex);
  const run = (file, out) => {
    const r = spawnSync('node', [path.join(__dirname, 'sheet.js'), '--html', path.join(dir, file), '--cases', path.join(dir, 'cases.json'), '--out', path.join(dir, out)], { encoding: 'utf8' });
    if (r.status !== 0) { ok(false, `${ex}/${file} crashed: ${r.stderr}`); return null; }
    return JSON.parse(fs.readFileSync(path.join(dir, out, 'report.json'), 'utf8'));
  };
  const buggy = run('component.html', 'out');
  const fixed = run('component.fixed.html', 'out-fixed');
  if (!buggy || !fixed) continue;
  const seeded = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8')).seeded;
  for (const s of seeded) {
    ok(buggy.flags.some((f) => f.case === s.case && f.kind === s.kind), `${ex}: seeded ${s.kind} bug in "${s.case}" was not flagged`);
  }
  ok(fixed.flags.length === 0, `${ex}: fixed version should be clean but has ${fixed.flags.length} flags: ${fixed.flags.map((f) => f.case + ' ' + f.msg).join('; ')}`);
  ok(buggy.seconds < 30, `${ex}: took ${buggy.seconds}s (limit 30s)`);
  console.log(`  ${seeded.length} seeded bugs, ${buggy.flagged} cells flagged, fixed version ${fixed.flagged} flagged, ${buggy.seconds}s`);
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
