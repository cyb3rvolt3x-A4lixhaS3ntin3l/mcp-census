#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { runCensus, loadToolsForServer } from '../src/census.mjs';
import { formatHuman } from '../src/report.mjs';
import { freezeBaseline } from '../src/grade.mjs';

function parseArgs(argv) {
  const out = {
    config: [],
    toolsDir: undefined,
    json: false,
    baselineOut: undefined,
    baseline: undefined,
    live: false,
    allowServers: [],
    timeoutMs: undefined,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config' && argv[i + 1]) out.config.push(argv[++i]);
    else if (a === '--tools-dir' && argv[i + 1]) out.toolsDir = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--write-baseline' && argv[i + 1]) out.baselineOut = argv[++i];
    else if (a === '--baseline' && argv[i + 1]) out.baseline = argv[++i];
    else if (a === '--live') out.live = true;
    else if (a === '--allow-server' && argv[i + 1]) out.allowServers.push(argv[++i]);
    else if (a === '--timeout-ms' && argv[i + 1]) out.timeoutMs = Number(argv[++i]);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function help() {
  return `mcp-census — inventory local MCP servers, grade tool definitions, report gate gaps

Usage:
  mcp-census [--config <path>]... [--tools-dir <dir>] [--json]
  mcp-census --live --allow-server <name> [--config <path>]...

Options:
  --config <path>         MCP client config (repeatable). Also scans well-known paths.
  --tools-dir <dir>       Offline <serverName>.json tool lists
  --live                  Opt-in: local stdio tools/list for allowlisted servers
  --allow-server <name>   Required with --live; repeatable; no wildcards
  --timeout-ms <n>        Stdio handshake timeout (default 8000)
  --json                  Machine-readable output
  --write-baseline <p>    Write frozen hashes for first graded server
  --baseline <path>       Note baseline file present (affects gate-gap report)
  -h, --help              Show help

Live mode only spawns local stdio commands from your config (no HTTP/SSE remote).
Thesis: GRADE ≠ GATE — a high inventory grade is not a runtime gate.
Production gate: https://github.com/cyb3rvolt3x-A4lixhaS3ntin3l/sentinelagent-guard
`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write(help());
  process.exit(0);
}

if (args.live && !args.allowServers.length) {
  console.error('mcp-census: --live requires at least one --allow-server <name>');
  process.exit(2);
}

const census = await runCensus({
  config: args.config,
  toolsDir: args.toolsDir,
  baselinePath: args.baseline,
  live: args.live,
  allowServers: args.allowServers,
  timeoutMs: args.timeoutMs,
});

if (args.baselineOut && census.graded[0]?.toolHashes) {
  const name = census.graded[0].server;
  let tools = args.toolsDir ? loadToolsForServer(name, args.toolsDir) : null;
  if (tools?.length) {
    writeFileSync(args.baselineOut, JSON.stringify(freezeBaseline(tools), null, 2));
  }
}

if (args.json) {
  process.stdout.write(JSON.stringify(census, null, 2) + '\n');
} else {
  process.stdout.write(formatHuman(census) + '\n');
}

const criticalGap = census.gateGap.gaps.some((g) => g.severity === 'critical');
process.exitCode = criticalGap ? 2 : 0;
