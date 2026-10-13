import { REQUIREMENTS } from "./requirements";
import type { Assessment, AssessmentInput, AssessmentResult, FindingStatus, Requirement } from "./types";

function toResults(requirement: Requirement, input: AssessmentInput): AssessmentResult[] {
  const { assess, perProvider, ...meta } = requirement;
  if (!perProvider) {
    const finding = assess(input);
    return finding ? [{ requirement: meta, finding }] : [];
  }
  return input.providers.flatMap((provider) => {
    const finding = assess(input, provider);
    return finding ? [{ requirement: meta, providerName: provider.name, finding }] : [];
  });
}

/** Pure and timestamp-free, so it is safe to call while rendering. */
export function assess(input: AssessmentInput): AssessmentResult[] {
  const selected = new Set(input.frameworks);
  return REQUIREMENTS.filter((r) => selected.has(r.framework)).flatMap((r) => toResults(r, input));
}

export function evaluate(input: AssessmentInput, now: Date = new Date()): Assessment {
  return { input, generatedAt: now.toISOString(), results: assess(input) };
}

export function groupByStatus(results: AssessmentResult[]): Record<FindingStatus, AssessmentResult[]> {
  const groups: Record<FindingStatus, AssessmentResult[]> = { gap: [], needs_evidence: [], needs_legal: [], no_gap: [] };
  for (const result of results) groups[result.finding.status].push(result);
  return groups;
}

export function resultHeading({ requirement, providerName }: AssessmentResult): string {
  const suffix = providerName ? ` (${providerName})` : "";
  return `${requirement.reference}: ${requirement.title}${suffix}`;
}

export interface DetailLine {
  label?: string;
  text: string;
}

/** The finding-specific lines shown under a result, shared by the on-screen report and the PDF. */
export function findingDetails({ requirement, finding }: AssessmentResult): DetailLine[] {
  const lines: DetailLine[] = [];
  switch (finding.status) {
    case "gap":
    case "no_gap":
      lines.push({ text: finding.detail });
      break;
    case "needs_evidence":
      if (finding.detail) lines.push({ text: finding.detail });
      lines.push({ label: "Evidence required", text: finding.evidence.join("; ") });
      break;
    case "needs_legal":
      lines.push({ label: "Question for counsel", text: finding.question });
      break;
  }
  if (finding.status !== "no_gap") lines.push({ label: "Required controls", text: requirement.controls.join("; ") });
  return lines;
}
