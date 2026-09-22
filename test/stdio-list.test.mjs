import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listToolsViaStdio, assertAllowlisted } from '../src/stdio-list.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('assertAllowlisted rejects wildcard and missing', () => {
  assert.throws(() => assertAllowlisted('a', []), /allowlist/);
  assert.throws(() => assertAllowlisted('a', ['*']), /Wildcard/);
  assert.throws(() => assertAllowlisted('a', ['b']), /not in/);
  assert.doesNotThrow(() => assertAllowlisted('a', ['a']));
});

test('listToolsViaStdio against fake local server', async () => {
  const tools = await listToolsViaStdio(
    {
      name: 'notes-live',
      transport: 'stdio',
      command: 'node',
      args: [join(root, 'fixtures/servers/fake-notes-mcp.mjs')],
    },
    { cwd: root, timeoutMs: 5000 },
  );
  assert.equal(tools.length, 2);
  assert.equal(tools[0].name, 'read_notes');
});

test('refuses http transport', async () => {
  await assert.rejects(
    () =>
      listToolsViaStdio({
        name: 'remote',
        transport: 'http',
        url: 'https://evil.example',
        command: 'node',
      }),
    /stdio only|remote/i,
  );
});
