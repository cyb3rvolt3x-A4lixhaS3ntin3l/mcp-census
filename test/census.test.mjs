import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCensus } from '../src/census.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('census grades clean notes A+ and flags poisoned weather + gate gap', () => {
  const census = runCensus({
    config: [join(root, 'fixtures/configs/cursor-mcp.json')],
    toolsDir: join(root, 'fixtures/tools'),
    home: '/nonexistent',
    os: 'linux',
  });
  assert.equal(census.serverCount, 2);
  const notes = census.graded.find((g) => g.server === 'notes');
  const weather = census.graded.find((g) => g.server === 'weather');
  assert.equal(notes.grade, 'A+');
  assert.equal(notes.score, 100);
  assert.ok(weather.score < 100);
  assert.ok(weather.findings.some((f) => f.check.includes('POISON') || f.severity === 'critical'));
  assert.ok(census.gateGap.gaps.some((g) => g.id === 'NO_RUNTIME_GATE'));
});
