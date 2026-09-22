import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMcpConfig, discoverConfigs } from '../src/discover.mjs';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('parse cursor mcpServers', () => {
  const raw = JSON.parse(
    readFileSync(join(root, 'fixtures/configs/cursor-mcp.json'), 'utf8'),
  );
  const parsed = parseMcpConfig(raw, 'fixtures/configs/cursor-mcp.json');
  assert.equal(parsed.servers.length, 2);
  assert.equal(parsed.servers[0].transport, 'stdio');
});

test('discover explicit config path', () => {
  const found = discoverConfigs({
    configPaths: [join(root, 'fixtures/configs/cursor-mcp.json')],
    home: '/nonexistent',
    os: 'linux',
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].servers.length, 2);
});
