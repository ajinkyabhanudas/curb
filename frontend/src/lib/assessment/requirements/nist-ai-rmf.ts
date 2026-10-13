import { fromControl } from "../helpers";
import type { Requirement } from "../types";

const F = "nist-ai-rmf" as const;

export const nistAiRmf: Requirement[] = [
  {
    id: "nist-govern-1-1",
    framework: F,
    reference: "GOVERN 1.1",
    title: "Legal and regulatory requirements understood",
    summary: "Legal and regulatory requirements involving AI are understood, managed and documented.",
    evaluability: "evidence",
    controls: ["Maintain a register of applicable AI laws and standards"],
    assess: () => ({ status: "needs_evidence", evidence: ["Register of applicable laws, regulations and standards"] }),
  },
  {
    id: "nist-govern-2-1",
    framework: F,
    reference: "GOVERN 2.1",
    title: "Roles and responsibilities documented",
    summary: "Roles, responsibilities and lines of communication for mapping, measuring and managing AI risk are documented.",
    evaluability: "evaluable",
    controls: ["Document who owns AI risk and how issues are escalated"],
    assess: (i) =>
      fromControl(i.controls.governanceRoles, {
        gap: "No documented AI risk roles and responsibilities.",
        noGap: "AI risk roles and responsibilities are documented.",
        evidence: ["RACI or role descriptions for AI risk"],
      }),
  },
  {
    id: "nist-govern-6-1",
    framework: F,
    reference: "GOVERN 6.1",
    title: "Third-party AI risk",
    summary: "Policies and procedures address AI risks associated with third-party entities.",
    evaluability: "evidence",
    controls: ["Assess and monitor each third-party AI provider"],
    assess: (i) =>
      i.providers.length > 0
        ? { status: "needs_evidence", evidence: ["Third-party risk policy", "Due-diligence records for each provider"] }
        : null,
  },
  {
    id: "nist-map-1-1",
    framework: F,
    reference: "MAP 1.1",
    title: "Intended purpose and context documented",
    summary: "Intended purposes, potentially beneficial uses, context-specific laws and prospective settings are understood and documented.",
    evaluability: "evidence",
    controls: ["Write an intended-use statement including users, settings and known limits"],
    assess: () => ({ status: "needs_evidence", evidence: ["Intended-use statement beyond the summary entered in this form"] }),
  },
  {
    id: "nist-measure-2-1",
    framework: F,
    reference: "MEASURE 2.1",
    title: "Test sets and metrics documented",
    summary: "Test sets, metrics and details about the tools used for testing, evaluation, validation and verification are documented.",
    evaluability: "evaluable",
    controls: ["Define evaluation metrics and test sets", "Record results per release"],
    assess: (i) =>
      fromControl(i.controls.testing, {
        gap: "No documented testing and evaluation.",
        noGap: "Testing and evaluation are documented.",
        evidence: ["Evaluation plan and results"],
      }),
  },
  {
    id: "nist-manage-4-1",
    framework: F,
    reference: "MANAGE 4.1",
    title: "Post-deployment monitoring",
    summary: "Post-deployment monitoring plans are implemented, including mechanisms for capturing user input, appeal and incident response.",
    evaluability: "evaluable",
    controls: ["Monitor production behaviour", "Provide a feedback and incident channel"],
    assess: (i) =>
      fromControl(i.controls.monitoring, {
        gap: "No post-deployment monitoring.",
        noGap: "Post-deployment monitoring is in place.",
        evidence: ["Monitoring plan and incident process"],
      }),
  },
];
