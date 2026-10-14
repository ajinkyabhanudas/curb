import type { ControlKey, FindingStatus, HumanOversight, Role, Tri, UseCase } from "./types";

export const USE_CASES: { value: UseCase; label: string }[] = [
  { value: "employment", label: "Hiring, worker management or promotion" },
  { value: "education", label: "Education: admissions, assessment, proctoring" },
  { value: "credit_insurance", label: "Credit scoring or life/health insurance pricing" },
  { value: "healthcare", label: "Healthcare, emergency triage or essential services" },
  { value: "law_enforcement_migration_justice", label: "Law enforcement, migration, justice or elections" },
  { value: "biometrics", label: "Biometric identification or categorisation" },
  { value: "critical_infrastructure", label: "Critical infrastructure (energy, traffic, water)" },
  { value: "customer_support", label: "Customer support chatbot or assistant" },
  { value: "content_generation", label: "Content generation (text, image, audio, video)" },
  { value: "internal_productivity", label: "Internal productivity tooling" },
  { value: "other", label: "Other" },
];

export const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "provider", label: "Provider", hint: "I build or sell the system" },
  { value: "deployer", label: "Deployer", hint: "I use a system built by someone else" },
  { value: "both", label: "Both", hint: "I build it and run it myself" },
];

export const OVERSIGHT: { value: HumanOversight; label: string }[] = [
  { value: "none", label: "No one reviews outputs" },
  { value: "review_sample", label: "A person reviews a sample" },
  { value: "review_each", label: "A person reviews every output first" },
];

export const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

export const CONTROL_QUESTIONS: { key: ControlKey; label: string }[] = [
  { key: "lawfulBasis", label: "A lawful basis for processing personal data is recorded" },
  { key: "privacyNotice", label: "Your privacy notice covers this AI processing" },
  { key: "dpia", label: "A data protection impact assessment is done" },
  { key: "riskManagement", label: "There is a documented AI risk management process" },
  { key: "impactAssessment", label: "An impact assessment on individuals is done" },
  { key: "technicalDocs", label: "Technical documentation is maintained" },
  { key: "logging", label: "The system logs events automatically" },
  { key: "testing", label: "Evaluation metrics and test results are documented" },
  { key: "monitoring", label: "The system is monitored after deployment" },
  { key: "aiLiteracy", label: "Staff operating the system have had AI training" },
  { key: "governanceRoles", label: "AI risk roles and responsibilities are documented" },
  { key: "aiPolicy", label: "Management has approved an AI policy" },
];

export const label = <T extends string>(options: { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? value;

export const STATUS_ORDER: FindingStatus[] = ["gap", "needs_evidence", "needs_legal", "no_gap"];

export const STATUS_META: Record<FindingStatus, { short: string; title: string; blurb: string }> = {
  gap: { short: "Gaps", title: "Potential gaps", blurb: "Your answers indicate these are not met." },
  needs_evidence: { short: "Evidence", title: "Needs evidence", blurb: "Can't be judged from the answers. Evidence is required." },
  needs_legal: { short: "Legal", title: "Needs legal interpretation", blurb: "Turns on interpretation of the law. Take advice." },
  no_gap: { short: "Clear", title: "No gap indicated", blurb: "Self-reported and not verified." },
};
