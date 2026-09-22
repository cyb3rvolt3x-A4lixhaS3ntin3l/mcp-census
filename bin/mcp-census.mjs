#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { runCensus } from '../src/census.mjs';
import { formatHuman } from '../src/report.mjs';
import { freezeBaseline } from '../src/grade.mjs';
import { loadToolsForServer } from '../src/census.mjs';

function parseArgs(argv) {
  const out = {
    config: [],
    toolsDir: undefined,
    json: false,
    baselineOut: undefined,
    baseline: undefined,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config' && argv[i + 1]) out.config.push(argv[++i]);
    else if (a === '--tools-dir' && argv[i + 1]) out.toolsDir = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--write-baseline' && argv[i + 1]) out.baselineOut = argv[++i];
    else if (a === '--baseline' && argv[i + 1]) out.baseline = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function help() {
  return `mcp-census — inventory local MCP servers, grade tool definitions, report gate gaps

Usage:
  mcp-census [--config <path>]... [--tools-dir <dir>] [--json]
  mcp-census --config fixtures/configs/cursor-mcp.json --tools-dir fixtures/tools

Options:
  --config <path>       MCP client config (repeatable). Also scans well-known paths.
  --tools-dir <dir>     Directory of <serverName>.json tool lists for offline grading
  --json                Machine-readable output
  --write-baseline <p>  Write frozen hashes for first graded server (MVP helper)
  --baseline <path>     Note baseline file present (affects gate-gap report)
  -h, --help            Show help

Thesis: GRADE ≠ GATE — a high inventory grade is not a runtime gate.
Production gate: https://github.com/cyb3rvolt3x-A4lixhaS3ntin3l/sentinelagent-guard
`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write(help());
  process.exit(0);
}

const census = runCensus({
  config: args.config,
  toolsDir: args.toolsDir,
  baselinePath: args.baseline,
});

if (args.baselineOut && args.toolsDir && census.graded[0]?.toolHashes) {
  const name = census.graded[0].server;
  const tools = loadToolsForServer(name, args.toolsDir);
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
