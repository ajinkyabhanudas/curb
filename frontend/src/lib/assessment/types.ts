export type Tri = "yes" | "no" | "unsure";

export type FrameworkId = "eu-ai-act" | "gdpr" | "nist-ai-rmf" | "iso-42001";

export type UseCase =
  | "employment"
  | "education"
  | "credit_insurance"
  | "healthcare"
  | "law_enforcement_migration_justice"
  | "biometrics"
  | "critical_infrastructure"
  | "customer_support"
  | "content_generation"
  | "internal_productivity"
  | "other";

export type Role = "provider" | "deployer" | "both";

export type HumanOversight = "none" | "review_sample" | "review_each";

export const CONTROL_KEYS = [
  "lawfulBasis",
  "privacyNotice",
  "dpia",
  "riskManagement",
  "technicalDocs",
  "logging",
  "aiLiteracy",
  "governanceRoles",
  "testing",
  "monitoring",
  "aiPolicy",
  "impactAssessment",
] as const;

export type ControlKey = (typeof CONTROL_KEYS)[number];

export interface ThirdPartyProvider {
  name: string;
  processesPersonalData: Tri;
  dpaInPlace: Tri;
  outsideEea: Tri;
  transferMechanism: Tri;
}

export interface AssessmentInput {
  appName: string;
  purpose: string;
  useCase: UseCase;
  role: Role;
  euNexus: Tri;
  usesPersonalData: Tri;
  usesSpecialCategoryData: Tri;
  trainsOnUserData: Tri;
  automatedDecisions: Tri;
  humanOversight: HumanOversight;
  interactsWithPeople: Tri;
  disclosesAi: Tri;
  generatesSyntheticContent: Tri;
  marksOutputs: Tri;
  prohibitedPractice: boolean;
  providesGpai: Tri;
  controls: Record<ControlKey, Tri>;
  providers: ThirdPartyProvider[];
  frameworks: FrameworkId[];
}

/**
 * What the tool can say about a requirement:
 * - gap: the answers indicate the requirement is not met
 * - no_gap: the answers indicate no gap (self-reported, not verified)
 * - needs_evidence: cannot be judged from answers; named evidence is required
 * - needs_legal: turns on legal interpretation; a named question is posed
 */
export type Finding =
  | { status: "gap"; detail: string }
  | { status: "no_gap"; detail: string }
  | { status: "needs_evidence"; evidence: string[]; detail?: string }
  | { status: "needs_legal"; question: string };

export type FindingStatus = Finding["status"];

/**
 * - evaluable: the form answers can settle it (may still fall back to
 *   needs_evidence when an answer is "unsure")
 * - evidence: always requires documents or testing outside this form
 * - legal: always requires legal interpretation
 */
export type Evaluability = "evaluable" | "evidence" | "legal";

export interface Requirement {
  id: string;
  framework: FrameworkId;
  reference: string;
  title: string;
  summary: string;
  evaluability: Evaluability;
  /** Controls to implement if this requirement is flagged. */
  controls: string[];
  /** Return null when the requirement does not apply to this input. */
  assess: (input: AssessmentInput, provider?: ThirdPartyProvider) => Finding | null;
  /** Assess once per third-party provider instead of once per application. */
  perProvider?: boolean;
}

export interface AssessmentResult {
  requirement: Omit<Requirement, "assess" | "perProvider">;
  providerName?: string;
  finding: Finding;
}

export interface Assessment {
  input: AssessmentInput;
  generatedAt: string;
  results: AssessmentResult[];
}

export const FRAMEWORK_LABELS: Record<FrameworkId, string> = {
  "eu-ai-act": "EU AI Act (Regulation (EU) 2024/1689)",
  gdpr: "GDPR (Regulation (EU) 2016/679)",
  "nist-ai-rmf": "NIST AI RMF 1.0 (voluntary)",
  "iso-42001": "ISO/IEC 42001:2023 (voluntary, certifiable)",
};
