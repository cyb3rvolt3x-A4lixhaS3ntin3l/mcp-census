import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { discoverConfigs } from './discover.mjs';
import { gradeTools } from './grade.mjs';
import { gateGap } from './report.mjs';
import { listToolsViaStdio, assertAllowlisted } from './stdio-list.mjs';

/**
 * Load tools for a server from --tools-dir fixtures.
 */
export function loadToolsForServer(serverName, toolsDir) {
  if (!toolsDir) return null;
  const path = join(toolsDir, `${serverName}.json`);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(raw) ? raw : raw.tools || [];
}

export function detectGateHint(configPaths = []) {
  if (process.env.SENTINEL_GUARD || process.env.MCP_GUARD) return true;
  for (const p of configPaths) {
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, 'utf8').toLowerCase();
      if (
        text.includes('sentinelagent') ||
        text.includes('guard-proxy') ||
        text.includes('@sentinelreign/guard')
      ) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * @param {object} options
 * @param {string[]} [options.config]
 * @param {string} [options.toolsDir]
 * @param {string} [options.baselinePath]
 * @param {boolean} [options.live] - opt-in stdio tools/list
 * @param {string[]} [options.allowServers] - required when live
 * @param {string} [options.cwd]
 * @param {number} [options.timeoutMs]
 */
export async function runCensus(options = {}) {
  const {
    config = [],
    toolsDir,
    baselinePath,
    home,
    os,
    live = false,
    allowServers = [],
    cwd = process.cwd(),
    timeoutMs,
  } = options;

  const sources = discoverConfigs({ configPaths: config, home, os });
  const allServers = sources.flatMap((s) =>
    s.servers.map((srv) => ({ ...srv, source: s.source, client: s.client })),
  );

  const graded = [];
  for (const srv of allServers) {
    let tools = loadToolsForServer(srv.name, toolsDir);
    let toolsSource = tools ? 'fixture' : null;

    if (!tools && live) {
      if (!allowServers.includes(srv.name)) {
        // not allowlisted → inventory-only (do not attempt spawn)
      } else {
        try {
          assertAllowlisted(srv.name, allowServers);
          tools = await listToolsViaStdio(srv, { cwd, timeoutMs });
          toolsSource = 'stdio-live';
        } catch (err) {
          graded.push({
            server: srv.name,
            source: srv.source,
            toolCount: 0,
            grade: '—',
            score: null,
            decision: 'live-error',
            findings: [],
            toolsSource: 'stdio-live',
            note: err.message,
          });
          continue;
        }
      }
    }

    if (!tools) {
      graded.push({
        server: srv.name,
        source: srv.source,
        toolCount: 0,
        grade: '—',
        score: null,
        decision: 'inventory-only',
        findings: [],
        toolsSource: null,
        note: live
          ? `Skipped live (not allowlisted or no stdio). Pass --allow-server ${srv.name}`
          : toolsDir
            ? `No fixture at ${toolsDir}/${srv.name}.json`
            : 'Pass --tools-dir for fixtures, or --live --allow-server <name> for local stdio tools/list',
      });
      continue;
    }

    const g = gradeTools(tools);
    graded.push({
      server: srv.name,
      source: srv.source,
      toolCount: tools.length,
      toolsSource,
      ...g,
    });
  }

  const hasBaselineFile = Boolean(baselinePath && existsSync(baselinePath));
  const configPathsUsed = [...config, ...sources.map((s) => s.source)];
  const hasGateHint = detectGateHint(configPathsUsed);

  return {
    generatedAt: new Date().toISOString(),
    live,
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

/** Sync wrapper kept for older tests that only use fixtures. */
export function runCensusSync(options = {}) {
  if (options.live) {
    throw new Error('runCensusSync does not support --live; use await runCensus()');
  }
  // fixture-only path is sync-safe
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
        toolsSource: null,
      });
      continue;
    }
    graded.push({
      server: srv.name,
      source: srv.source,
      toolCount: tools.length,
      toolsSource: 'fixture',
      ...gradeTools(tools),
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    live: false,
    sources,
    serverCount: allServers.length,
    graded,
    gateGap: gateGap({
      servers: allServers,
      graded: graded.filter((g) => g.score != null),
      hasBaselineFile: Boolean(baselinePath && existsSync(baselinePath)),
      hasGateHint: detectGateHint([...config, ...sources.map((s) => s.source)]),
    }),
  };
}

export function listToolFixtures(toolsDir) {
  if (!toolsDir || !existsSync(toolsDir)) return [];
  return readdirSync(toolsDir).filter((f) => f.endsWith('.json'));
}
