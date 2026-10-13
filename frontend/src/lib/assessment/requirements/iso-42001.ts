import { fromControl } from "../helpers";
import type { Requirement } from "../types";

const F = "iso-42001" as const;

// The standard text is paywalled, so references are clause numbers and titles only.
// Conformity is established by audit, so nothing here can be confirmed from self-reported answers.
export const iso42001: Requirement[] = [
  {
    id: "iso-5-2",
    framework: F,
    reference: "Clause 5.2",
    title: "AI policy",
    summary: "Top management establishes an AI policy appropriate to the organisation's purpose.",
    evaluability: "evaluable",
    controls: ["Approve and communicate an AI policy"],
    assess: (i) =>
      fromControl(i.controls.aiPolicy, {
        gap: "No AI policy.",
        noGap: "An AI policy exists.",
        evidence: ["Approved AI policy"],
      }),
  },
  {
    id: "iso-6-1-2",
    framework: F,
    reference: "Clause 6.1.2",
    title: "AI risk assessment",
    summary: "The organisation defines and applies an AI risk assessment process.",
    evaluability: "evaluable",
    controls: ["Define a repeatable AI risk assessment process"],
    assess: (i) =>
      fromControl(i.controls.riskManagement, {
        gap: "No AI risk assessment process.",
        noGap: "An AI risk assessment process exists.",
        evidence: ["AI risk assessment procedure"],
      }),
  },
  {
    id: "iso-6-1-4",
    framework: F,
    reference: "Clause 6.1.4",
    title: "AI system impact assessment",
    summary: "The organisation assesses the potential consequences of AI systems for individuals and society.",
    evaluability: "evaluable",
    controls: ["Complete an impact assessment for the system"],
    assess: (i) =>
      fromControl(i.controls.impactAssessment, {
        gap: "No AI system impact assessment.",
        noGap: "An impact assessment exists.",
        evidence: ["Completed impact assessment"],
      }),
  },
  {
    id: "iso-a-10",
    framework: F,
    reference: "Annex A, A.10",
    title: "Third-party and customer relationships",
    summary: "Responsibilities are allocated between the organisation, its suppliers and its customers.",
    evaluability: "evidence",
    controls: ["Allocate responsibilities contractually with suppliers and customers"],
    assess: (i) =>
      i.providers.length > 0
        ? { status: "needs_evidence", evidence: ["Supplier agreements allocating AI responsibilities"] }
        : null,
  },
  {
    id: "iso-cert",
    framework: F,
    reference: "Clauses 4 to 10",
    title: "Management system conformity",
    summary: "Certification requires an audited AI management system. A self-assessment cannot establish conformity.",
    evaluability: "legal",
    controls: ["Engage an accredited certification body if certification is a goal"],
    assess: () => ({
      status: "needs_legal",
      question: "Is ISO/IEC 42001 certification a contractual or market requirement for you? If so, an external audit is needed.",
    }),
  },
];
