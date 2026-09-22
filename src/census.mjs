import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { discoverConfigs } from './discover.mjs';
import { gradeTools } from './grade.mjs';
import { gateGap } from './report.mjs';

/**
 * Load tools for a server:
 * 1) fixtures/tools/<server>.json if --tools-dir set
 * 2) empty list (inventory-only) otherwise
 * Live stdio tools/list handshake is a follow-up (documented).
 */
export function loadToolsForServer(serverName, toolsDir) {
  if (!toolsDir) return null;
  const path = join(toolsDir, `${serverName}.json`);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(raw) ? raw : raw.tools || [];
}

export function detectGateHint(configPaths = []) {
  // Lightweight heuristic: env or config mention of sentinelagent / guard-proxy
  if (process.env.SENTINEL_GUARD || process.env.MCP_GUARD) return true;
  for (const p of configPaths) {
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, 'utf8').toLowerCase();
      if (text.includes('sentinelagent') || text.includes('guard-proxy') || text.includes('@sentinelreign/guard')) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function runCensus(options = {}) {
  const {
    config = [],
    toolsDir,
    baselinePath,
    home,
    os,
  } = options;

  const sources = discoverConfigs({ configPaths: config, home, os });
  const allServers = sources.flatMap((s) =>
    s.servers.map((srv) => ({ ...srv, source: s.source, client: s.client })),
  );

  const graded = [];
  for (const srv of allServers) {
    const tools = loadToolsForServer(srv.name, toolsDir);
    if (!tools) {
      graded.push({
        server: srv.name,
        source: srv.source,
        toolCount: 0,
        grade: '—',
        score: null,
        decision: 'inventory-only',
        findings: [],
        note: toolsDir
          ? `No fixture at ${toolsDir}/${srv.name}.json`
          : 'Pass --tools-dir with per-server tools JSON, or use fixtures for offline grade',
      });
      continue;
    }
    const g = gradeTools(tools);
    graded.push({
      server: srv.name,
      source: srv.source,
      toolCount: tools.length,
      ...g,
    });
  }

  const hasBaselineFile = Boolean(baselinePath && existsSync(baselinePath));
  const configPathsUsed = [
    ...config,
    ...sources.map((s) => s.source),
  ];
  const hasGateHint = detectGateHint(configPathsUsed);

  return {
    generatedAt: new Date().toISOString(),
    sources,
    serverCount: allServers.length,
    graded,
    gateGap: gateGap({
      servers: allServers,
      graded: graded.filter((g) => g.score != null),
      hasBaselineFile,
      hasGateHint,
    }),
  };
}

export function listToolFixtures(toolsDir) {
  if (!toolsDir || !existsSync(toolsDir)) return [];
  return readdirSync(toolsDir).filter((f) => f.endsWith('.json'));
}
