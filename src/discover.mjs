import { readFileSync, existsSync } from 'node:fs';
import { defaultConfigCandidates } from './paths.mjs';

/**
 * Normalize heterogeneous client configs into:
 * { source, client, servers: [{ name, transport, command?, args?, url?, env? }] }
 */
export function parseMcpConfig(raw, sourcePath) {
  const servers = [];
  let client = 'unknown';

  const mcpServers = raw.mcpServers || raw.mcp?.servers || null;
  if (mcpServers && typeof mcpServers === 'object') {
    client = sourcePath.includes('Claude') || sourcePath.includes('claude')
      ? 'claude-desktop'
      : sourcePath.includes('cursor') || sourcePath.includes('.cursor')
        ? 'cursor'
        : 'mcpServers';
    for (const [name, cfg] of Object.entries(mcpServers)) {
      if (!cfg || typeof cfg !== 'object') continue;
      servers.push(normalizeServer(name, cfg));
    }
  }

  // Continue: experimental.modelContextProtocolServers or mcpServers array
  const continueServers =
    raw.experimental?.modelContextProtocolServers ||
    raw.mcpServers ||
    null;
  if (Array.isArray(continueServers)) {
    client = 'continue';
    for (const cfg of continueServers) {
      if (!cfg || typeof cfg !== 'object') continue;
      const name = cfg.name || cfg.id || 'unnamed';
      servers.push(normalizeServer(name, cfg));
    }
  }

  return { source: sourcePath, client, servers };
}

function normalizeServer(name, cfg) {
  const command = cfg.command || cfg.cmd;
  const args = cfg.args || [];
  const url = cfg.url || cfg.serverUrl;
  const transport = url ? 'http' : command ? 'stdio' : cfg.transport || 'unknown';
  return {
    name,
    transport,
    command: command || undefined,
    args: Array.isArray(args) ? args : [],
    url: url || undefined,
    env: cfg.env && typeof cfg.env === 'object' ? cfg.env : undefined,
    raw: cfg,
  };
}

export function discoverConfigs({ configPaths = [], home, os } = {}) {
  const candidates = [
    ...configPaths,
    ...defaultConfigCandidates(home, os),
  ];
  const seen = new Set();
  const results = [];
  for (const p of candidates) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    if (!existsSync(p)) continue;
    try {
      const raw = JSON.parse(readFileSync(p, 'utf8'));
      const parsed = parseMcpConfig(raw, p);
      if (parsed.servers.length) results.push(parsed);
    } catch {
      // skip unreadable / invalid JSON
    }
  }
  return results;
}
