import type { AssessmentInput, Finding, Tri, UseCase } from "./types";

/** Use-case areas that map to EU AI Act Annex III high-risk areas (indicative). */
const ANNEX_III_USE_CASES: ReadonlySet<UseCase> = new Set([
  "employment",
  "education",
  "credit_insurance",
  "healthcare",
  "law_enforcement_migration_justice",
  "biometrics",
  "critical_infrastructure",
]);

export const isAnnexIII = (i: AssessmentInput) => ANNEX_III_USE_CASES.has(i.useCase);
export const hasEuNexus = (i: AssessmentInput) => i.euNexus !== "no";
export const isProvider = (i: AssessmentInput) => i.role !== "deployer";
export const isDeployer = (i: AssessmentInput) => i.role !== "provider";
export const processesPersonalData = (i: AssessmentInput) => i.usesPersonalData !== "no";

const SELF_REPORTED = " (self-reported, not verified)";

/** Map a yes/no/unsure control answer to a finding; "unsure" falls back to evidence. */
export function fromControl(answer: Tri, messages: { gap: string; noGap: string; evidence: string[] }): Finding {
  if (answer === "yes") return { status: "no_gap", detail: messages.noGap + SELF_REPORTED };
  if (answer === "no") return { status: "gap", detail: messages.gap };
  return { status: "needs_evidence", evidence: messages.evidence, detail: "Answered 'unsure'." };
}
