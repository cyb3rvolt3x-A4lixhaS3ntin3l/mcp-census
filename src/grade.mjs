import {
  evaluate,
  grade,
  hashToolDefinition,
  buildBaseline,
} from '@sentinelreign/guard-core';

/** Grade a tools/list-shaped array. */
export function gradeTools(tools) {
  const verdict = evaluate({ kind: 'tools_list', tools }, {});
  const report = grade(verdict.findings);
  return {
    decision: verdict.decision,
    grade: report.grade,
    score: report.score,
    rubricVersion: report.rubricVersion,
    findings: verdict.findings,
    toolHashes: Object.fromEntries(
      tools.map((t) => [t.name, hashToolDefinition(t)]),
    ),
  };
}

/** Compare against a previously saved baseline (gate simulation). */
export function gateAgainstBaseline(tools, baseline) {
  const verdict = evaluate({ kind: 'tools_list', tools }, { baseline });
  const report = grade(verdict.findings);
  return {
    decision: verdict.decision,
    grade: report.grade,
    score: report.score,
    findings: verdict.findings,
  };
}

export function freezeBaseline(tools) {
  return buildBaseline(tools);
}
