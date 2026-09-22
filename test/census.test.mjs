import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCensus, runCensusSync } from '../src/census.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('census grades clean notes A+ and flags poisoned weather + gate gap', () => {
  const census = runCensusSync({
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
  assert.ok(weather.findings.some((f) => /POISON/i.test(f.check) || f.severity === 'critical'));
  assert.ok(census.gateGap.gaps.some((g) => g.id === 'NO_RUNTIME_GATE' || g.id.includes('GATE')));
});

test('live stdio tools/list for allowlisted local server', async () => {
  const census = await runCensus({
    config: [join(root, 'fixtures/configs/live-notes.json')],
    live: true,
    allowServers: ['notes-live'],
    cwd: root,
    home: '/nonexistent',
    os: 'linux',
    timeoutMs: 5000,
  });
  const notes = census.graded.find((g) => g.server === 'notes-live');
  assert.ok(notes, 'notes-live graded');
  assert.equal(notes.toolsSource, 'stdio-live');
  assert.equal(notes.grade, 'A+');
  assert.equal(notes.score, 100);
  assert.equal(notes.toolCount, 2);
});

test('live without allowlist entry skips with note', async () => {
  const census = await runCensus({
    config: [join(root, 'fixtures/configs/live-notes.json')],
    live: true,
    allowServers: ['other-server'],
    cwd: root,
    home: '/nonexistent',
    os: 'linux',
  });
  const notes = census.graded.find((g) => g.server === 'notes-live');
  assert.equal(notes.decision, 'inventory-only');
});
