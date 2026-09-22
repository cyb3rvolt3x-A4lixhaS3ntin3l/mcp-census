/**
 * Gate-gap heuristic: inventory/grade without a pinned baseline or known
 * runtime gate is a visibility-only posture (GRADE ≠ GATE).
 */
export function gateGap({ servers, graded, hasBaselineFile, hasGateHint }) {
  const gaps = [];
  if (!hasBaselineFile) {
    gaps.push({
      id: 'NO_BASELINE',
      severity: 'high',
      detail:
        'No tool-definition baseline on disk. A grade alone will not catch post-approve rugs.',
    });
  }
  if (!hasGateHint) {
    gaps.push({
      id: 'NO_RUNTIME_GATE',
      severity: 'critical',
      detail:
        'No runtime gate detected in this census. Inventory grade ≠ enforcement. See sentinelagent-guard.',
    });
  }
  const lowGrades = graded.filter((g) => g.score < 85);
  if (lowGrades.length) {
    gaps.push({
      id: 'LOW_GRADE_SERVERS',
      severity: 'medium',
      detail: `${lowGrades.length} server(s) scored below A (85): ${lowGrades
        .map((g) => `${g.server} ${g.grade}/${g.score}`)
        .join(', ')}`,
    });
  }
  if (!servers.length) {
    gaps.push({
      id: 'NO_SERVERS',
      severity: 'info',
      detail: 'No MCP servers discovered. Pass --config or install a client config.',
    });
  }
  return {
    thesis: 'GRADE ≠ GATE',
    summary:
      gaps.some((g) => g.id === 'NO_RUNTIME_GATE')
        ? 'You have inventory visibility (or none) without a runtime gate.'
        : 'Gate hint present — still verify enforcement on every tools/list.',
    gaps,
  };
}

export function formatHuman(census) {
  const lines = [];
  lines.push('mcp-census — MCP fleet inventory');
  lines.push(`thesis : ${census.gateGap.thesis}`);
  lines.push('');
  for (const src of census.sources) {
    lines.push(`source : ${src.source} (${src.client})`);
    for (const s of src.servers) {
      lines.push(`  server : ${s.name}  transport=${s.transport}`);
      if (s.command) lines.push(`           cmd=${s.command} ${(s.args || []).join(' ')}`);
      if (s.url) lines.push(`           url=${s.url}`);
    }
    lines.push('');
  }
  if (census.graded.length) {
    lines.push('grades');
    for (const g of census.graded) {
      lines.push(
        `  ${g.server.padEnd(24)} ${g.grade} (${g.score})  decision=${g.decision}  tools=${g.toolCount}`,
      );
      for (const f of g.findings.slice(0, 5)) {
        lines.push(`    - ${f.check} [${f.severity}] ${f.title}`);
      }
    }
    lines.push('');
  }
  lines.push('gate gap');
  lines.push(`  ${census.gateGap.summary}`);
  for (const gap of census.gateGap.gaps) {
    lines.push(`  - [${gap.severity}] ${gap.id}: ${gap.detail}`);
  }
  lines.push('');
  lines.push('production gate: https://github.com/cyb3rvolt3x-A4lixhaS3ntin3l/sentinelagent-guard');
  lines.push('demo: https://github.com/cyb3rvolt3x-A4lixhaS3ntin3l/mcp-grade-neq-gate');
  return lines.join('\n');
}
