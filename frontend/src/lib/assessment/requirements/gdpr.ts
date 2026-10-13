import { fromControl, hasEuNexus, isAnnexIII, processesPersonalData } from "../helpers";
import type { AssessmentInput, Requirement } from "../types";

const F = "gdpr" as const;

const inScope = (i: AssessmentInput) => hasEuNexus(i) && processesPersonalData(i);

export const gdpr: Requirement[] = [
  {
    id: "gdpr-art-6",
    framework: F,
    reference: "Art. 5(1)(a), Art. 6",
    title: "Lawful basis for processing",
    summary: "Each processing purpose needs a lawful basis under Art. 6, identified before processing starts.",
    evaluability: "evaluable",
    controls: ["Identify and record a lawful basis per processing purpose"],
    assess: (i) =>
      inScope(i)
        ? fromControl(i.controls.lawfulBasis, {
            gap: "No lawful basis identified.",
            noGap: "A lawful basis is identified.",
            evidence: ["Record of processing activities showing the lawful basis"],
          })
        : null,
  },
  {
    id: "gdpr-art-6-4",
    framework: F,
    reference: "Art. 5(1)(b), Art. 6(4)",
    title: "Training on user data (purpose compatibility)",
    summary: "Personal data collected for one purpose may only be reused for another if compatible or covered by a separate basis.",
    evaluability: "legal",
    controls: ["Document the purpose and basis for model training", "Offer an opt-out where appropriate"],
    assess: (i) =>
      inScope(i) && i.trainsOnUserData !== "no"
        ? { status: "needs_legal", question: "Is training or improving models on user personal data compatible with the original purpose, and what lawful basis supports it?" }
        : null,
  },
  {
    id: "gdpr-art-9",
    framework: F,
    reference: "Art. 9",
    title: "Special category data",
    summary: "Processing special category data is prohibited unless an Art. 9(2) condition applies, in addition to an Art. 6 basis.",
    evaluability: "legal",
    controls: ["Identify the Art. 9(2) condition", "Minimise special category data"],
    assess: (i) =>
      inScope(i) && i.usesSpecialCategoryData !== "no"
        ? { status: "needs_legal", question: "Which Art. 9(2) condition applies, and does Member State law add conditions?" }
        : null,
  },
  {
    id: "gdpr-art-13",
    framework: F,
    reference: "Art. 13, Art. 14",
    title: "Transparency to data subjects",
    summary: "People must be told who processes their data, why, on what basis and for how long, including about automated decision-making.",
    evaluability: "evaluable",
    controls: ["Publish a privacy notice covering the AI processing"],
    assess: (i) =>
      inScope(i)
        ? fromControl(i.controls.privacyNotice, {
            gap: "No privacy notice covering this processing.",
            noGap: "A privacy notice covers this processing.",
            evidence: ["Current privacy notice"],
          })
        : null,
  },
  {
    id: "gdpr-art-22",
    framework: F,
    reference: "Art. 22",
    title: "Automated individual decision-making",
    summary: "People have the right not to be subject to solely automated decisions with legal or similarly significant effects, subject to exceptions and safeguards.",
    evaluability: "evaluable",
    controls: ["Add meaningful human review", "Provide a way to contest decisions"],
    assess: (i) => {
      if (!inScope(i) || i.automatedDecisions === "no") return null;
      if (i.humanOversight === "none") {
        return { status: "gap", detail: "Decisions with significant effects are made with no human involvement." };
      }
      return {
        status: "needs_legal",
        question: "Is the human involvement meaningful enough to take the decision outside Art. 22, or does an Art. 22(2) exception and its safeguards apply?",
      };
    },
  },
  {
    id: "gdpr-art-28",
    framework: F,
    reference: "Art. 28",
    title: "Processor contract with AI provider",
    summary: "Where a third party processes personal data on your behalf, a contract with the Art. 28(3) terms is required.",
    evaluability: "evaluable",
    perProvider: true,
    controls: ["Sign a data processing agreement with this provider"],
    assess: (i, p) => {
      if (!hasEuNexus(i) || !p || p.processesPersonalData === "no") return null;
      return fromControl(p.dpaInPlace, {
        gap: `No data processing agreement with ${p.name}.`,
        noGap: `A data processing agreement is in place with ${p.name}.`,
        evidence: [`Signed DPA with ${p.name}`],
      });
    },
  },
  {
    id: "gdpr-ch-v",
    framework: F,
    reference: "Art. 44 to 46",
    title: "International transfers to AI provider",
    summary: "Transfers of personal data outside the EEA need an adequacy decision or appropriate safeguards.",
    evaluability: "evaluable",
    perProvider: true,
    controls: ["Confirm adequacy or put standard contractual clauses in place", "Assess transfer risks"],
    assess: (i, p) => {
      if (!hasEuNexus(i) || !p || p.processesPersonalData === "no" || p.outsideEea === "no") return null;
      if (p.outsideEea === "unsure") {
        return { status: "needs_evidence", evidence: [`Processing locations of ${p.name}`], detail: "Unclear whether data leaves the EEA." };
      }
      return fromControl(p.transferMechanism, {
        gap: `Personal data goes to ${p.name} outside the EEA with no transfer mechanism.`,
        noGap: `A transfer mechanism is in place for ${p.name}.`,
        evidence: [`Transfer mechanism (adequacy decision or SCCs) for ${p.name}`],
      });
    },
  },
  {
    id: "gdpr-art-35",
    framework: F,
    reference: "Art. 35",
    title: "Data protection impact assessment",
    summary: "A DPIA is required where processing is likely to result in high risk, such as systematic automated decisions or large-scale special category data.",
    evaluability: "evaluable",
    controls: ["Complete a DPIA before processing begins", "Consult the supervisory authority if residual risk stays high"],
    assess: (i) => {
      if (!inScope(i)) return null;
      const triggers = i.automatedDecisions === "yes" || i.usesSpecialCategoryData === "yes" || isAnnexIII(i);
      if (!triggers) return null;
      return fromControl(i.controls.dpia, {
        gap: "Processing indicates likely high risk but no DPIA exists.",
        noGap: "A DPIA exists.",
        evidence: ["Completed DPIA"],
      });
    },
  },
  {
    id: "gdpr-art-32",
    framework: F,
    reference: "Art. 25, Art. 32",
    title: "Security and data protection by design",
    summary: "Appropriate technical and organisational measures must protect personal data in proportion to risk.",
    evaluability: "evidence",
    controls: ["Apply access control, encryption and data minimisation to AI inputs and outputs"],
    assess: (i) =>
      inScope(i)
        ? { status: "needs_evidence", evidence: ["Security measures documentation", "Penetration test or equivalent assurance"] }
        : null,
  },
];
