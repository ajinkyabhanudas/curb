import { fromControl, hasEuNexus, isAnnexIII, isDeployer, isProvider } from "../helpers";
import type { AssessmentInput, Requirement } from "../types";

const F = "eu-ai-act" as const;

const highRiskProvider = (i: AssessmentInput) => hasEuNexus(i) && isAnnexIII(i) && isProvider(i);
const highRiskDeployer = (i: AssessmentInput) => hasEuNexus(i) && isAnnexIII(i) && isDeployer(i);
const gpaiProvider = (i: AssessmentInput) => hasEuNexus(i) && isProvider(i) && i.providesGpai !== "no";

export const euAiAct: Requirement[] = [
  {
    id: "eu-art-4",
    framework: F,
    reference: "Art. 4",
    title: "AI literacy",
    summary:
      "Providers and deployers must take measures to ensure a sufficient level of AI literacy among staff and others operating the system.",
    evaluability: "evaluable",
    controls: ["Run role-based AI training for everyone who operates or oversees the system", "Keep training records"],
    assess: (i) =>
      hasEuNexus(i)
        ? fromControl(i.controls.aiLiteracy, {
            gap: "No AI literacy measures in place.",
            noGap: "AI literacy measures are in place.",
            evidence: ["Training materials and attendance records"],
          })
        : null,
  },
  {
    id: "eu-art-5",
    framework: F,
    reference: "Art. 5",
    title: "Prohibited AI practices",
    summary:
      "Certain practices are banned outright, such as social scoring, emotion recognition in workplaces and education, and untargeted scraping of facial images.",
    evaluability: "evaluable",
    controls: ["Stop or redesign the prohibited feature before it is placed on the EU market or used in the EU"],
    assess: (i) => {
      if (!hasEuNexus(i)) return null;
      if (i.prohibitedPractice) {
        return { status: "gap", detail: "You indicated the system performs a practice listed in Art. 5." };
      }
      if (i.useCase === "biometrics" || i.useCase === "law_enforcement_migration_justice") {
        return {
          status: "needs_legal",
          question:
            "Does any feature of this biometric or law-enforcement-related system fall under an Art. 5(1) prohibition, or within its narrow exceptions?",
        };
      }
      return { status: "no_gap", detail: "No prohibited practice indicated (self-reported, not verified)." };
    },
  },
  {
    id: "eu-art-6",
    framework: F,
    reference: "Art. 6 and Annex III",
    title: "High-risk classification",
    summary:
      "A system is high-risk if it is a safety component of a regulated product (Annex I) or used in an Annex III area, unless the Art. 6(3) derogation applies.",
    evaluability: "evaluable",
    controls: ["Record a documented classification decision with reasoning"],
    assess: (i) => {
      if (!hasEuNexus(i)) return null;
      if (isAnnexIII(i)) {
        return {
          status: "needs_legal",
          question:
            "Does the use fall within an Annex III area, and does the Art. 6(3) derogation (no significant risk of harm) apply? Obtain legal advice before relying on the derogation.",
        };
      }
      return {
        status: "no_gap",
        detail:
          "The selected use case is not in an Annex III area. This tool did not assess whether the system is a safety component of a product under Annex I.",
      };
    },
  },
  {
    id: "eu-art-9",
    framework: F,
    reference: "Art. 9",
    title: "Risk management system",
    summary:
      "High-risk systems need a continuous, documented risk management system across the lifecycle.",
    evaluability: "evaluable",
    controls: ["Establish a documented, iterative risk management process", "Test against defined metrics before release"],
    assess: (i) =>
      highRiskProvider(i)
        ? fromControl(i.controls.riskManagement, {
            gap: "No risk management process for a use case that may be high-risk.",
            noGap: "A risk management process exists.",
            evidence: ["Risk management procedure and risk register"],
          })
        : null,
  },
  {
    id: "eu-art-10",
    framework: F,
    reference: "Art. 10",
    title: "Data and data governance",
    summary:
      "Training, validation and testing data must meet quality criteria and be examined for biases.",
    evaluability: "evidence",
    controls: ["Document data provenance and preparation", "Examine datasets for bias and gaps"],
    assess: (i) =>
      highRiskProvider(i)
        ? {
            status: "needs_evidence",
            evidence: ["Dataset provenance records", "Bias examination results", "Data quality criteria"],
          }
        : null,
  },
  {
    id: "eu-art-11",
    framework: F,
    reference: "Art. 11 and Annex IV",
    title: "Technical documentation",
    summary:
      "Technical documentation must be drawn up before the system is placed on the market and kept up to date.",
    evaluability: "evaluable",
    controls: ["Prepare technical documentation covering the Annex IV content"],
    assess: (i) =>
      highRiskProvider(i)
        ? fromControl(i.controls.technicalDocs, {
            gap: "No technical documentation prepared.",
            noGap: "Technical documentation exists.",
            evidence: ["Technical documentation file"],
          })
        : null,
  },
  {
    id: "eu-art-12",
    framework: F,
    reference: "Art. 12",
    title: "Record-keeping (logging)",
    summary: "High-risk systems must automatically record events over their lifetime.",
    evaluability: "evaluable",
    controls: ["Enable automatic event logging", "Define log retention"],
    assess: (i) =>
      highRiskProvider(i)
        ? fromControl(i.controls.logging, {
            gap: "No event logging in place.",
            noGap: "Event logging is in place.",
            evidence: ["Logging design and sample logs"],
          })
        : null,
  },
  {
    id: "eu-art-13",
    framework: F,
    reference: "Art. 13",
    title: "Transparency and instructions for use",
    summary: "Deployers must receive instructions for use describing capabilities, limits and oversight needs.",
    evaluability: "evidence",
    controls: ["Write instructions for use covering purpose, accuracy, limitations and oversight measures"],
    assess: (i) =>
      highRiskProvider(i)
        ? { status: "needs_evidence", evidence: ["Instructions for use supplied to deployers"] }
        : null,
  },
  {
    id: "eu-art-14",
    framework: F,
    reference: "Art. 14",
    title: "Human oversight",
    summary: "High-risk systems must be designed so natural persons can effectively oversee them.",
    evaluability: "evaluable",
    controls: ["Assign trained overseers with authority to override or stop the system"],
    assess: (i) => {
      if (!highRiskProvider(i)) return null;
      if (i.humanOversight === "none") {
        return { status: "gap", detail: "No human oversight of outputs." };
      }
      if (i.humanOversight === "review_sample") {
        return {
          status: "needs_evidence",
          evidence: ["Oversight design showing overseers can understand, override and stop the system", "Sampling rationale"],
          detail: "Only a sample of outputs is reviewed.",
        };
      }
      return { status: "no_gap", detail: "Every output is reviewed by a person (self-reported, not verified)." };
    },
  },
  {
    id: "eu-art-15",
    framework: F,
    reference: "Art. 15",
    title: "Accuracy, robustness and cybersecurity",
    summary: "High-risk systems must reach appropriate accuracy, be resilient to errors and attacks, and declare accuracy metrics.",
    evaluability: "evidence",
    controls: ["Define and test accuracy metrics", "Test robustness and security against adversarial inputs"],
    assess: (i) =>
      highRiskProvider(i)
        ? { status: "needs_evidence", evidence: ["Test reports with accuracy metrics", "Security and robustness testing results"] }
        : null,
  },
  {
    id: "eu-art-26",
    framework: F,
    reference: "Art. 26",
    title: "Deployer obligations for high-risk systems",
    summary:
      "Deployers must use the system per its instructions, assign competent human oversight, monitor operation and keep logs.",
    evaluability: "evaluable",
    controls: ["Monitor operation against the instructions for use", "Retain logs you control for at least six months"],
    assess: (i) =>
      highRiskDeployer(i)
        ? fromControl(i.controls.monitoring, {
            gap: "No operational monitoring of the system.",
            noGap: "Operational monitoring is in place.",
            evidence: ["Monitoring procedure and records"],
          })
        : null,
  },
  {
    id: "eu-art-27",
    framework: F,
    reference: "Art. 27",
    title: "Fundamental rights impact assessment",
    summary:
      "Certain deployers (public bodies, private entities providing public services, and deployers of some credit and insurance systems) must assess impact on fundamental rights before first use.",
    evaluability: "legal",
    controls: ["If required, complete and notify a fundamental rights impact assessment"],
    assess: (i) =>
      highRiskDeployer(i)
        ? {
            status: "needs_legal",
            question: "Are you a deployer that must carry out a fundamental rights impact assessment under Art. 27(1)?",
          }
        : null,
  },
  {
    id: "eu-art-50-1",
    framework: F,
    reference: "Art. 50(1)",
    title: "Disclosure of AI interaction",
    summary: "People interacting directly with an AI system must be told it is an AI system, unless obvious.",
    evaluability: "evaluable",
    controls: ["Show a clear AI disclosure at the start of the interaction"],
    assess: (i) => {
      if (!hasEuNexus(i) || i.interactsWithPeople === "no") return null;
      if (i.interactsWithPeople === "unsure") {
        return { status: "needs_evidence", evidence: ["Description of how users interact with the system"], detail: "Unclear whether people interact directly." };
      }
      return fromControl(i.disclosesAi, {
        gap: "Users are not told they are interacting with AI.",
        noGap: "Users are told they are interacting with AI.",
        evidence: ["Screenshot of the AI disclosure shown to users"],
      });
    },
  },
  {
    id: "eu-art-50-2",
    framework: F,
    reference: "Art. 50(2)",
    title: "Marking of synthetic content",
    summary: "Providers of systems generating synthetic audio, image, video or text must mark outputs in a machine-readable way.",
    evaluability: "evaluable",
    controls: ["Embed machine-readable markers (e.g. metadata or watermarking) in generated outputs"],
    assess: (i) => {
      if (!hasEuNexus(i) || !isProvider(i) || i.generatesSyntheticContent === "no") return null;
      if (i.generatesSyntheticContent === "unsure") {
        return { status: "needs_evidence", evidence: ["Description of output types generated"], detail: "Unclear whether synthetic content is generated." };
      }
      return fromControl(i.marksOutputs, {
        gap: "Generated content is not marked as AI-generated.",
        noGap: "Generated content is marked as AI-generated.",
        evidence: ["Technical description of the marking method"],
      });
    },
  },
  {
    id: "eu-art-51",
    framework: F,
    reference: "Art. 51",
    title: "General-purpose AI model with systemic risk",
    summary: "A general-purpose AI model is presumed to have systemic risk above a training-compute threshold, or if designated by the Commission.",
    evaluability: "legal",
    controls: ["Determine and document whether the systemic-risk threshold is met"],
    assess: (i) =>
      gpaiProvider(i)
        ? { status: "needs_legal", question: "Is the model a general-purpose AI model with systemic risk under Art. 51 (including the compute presumption)?" }
        : null,
  },
  {
    id: "eu-art-53",
    framework: F,
    reference: "Art. 53",
    title: "General-purpose AI provider obligations",
    summary:
      "Providers of general-purpose AI models must keep technical documentation, give information to downstream providers, adopt a copyright policy and publish a training content summary.",
    evaluability: "evidence",
    controls: ["Prepare model documentation", "Adopt an EU copyright compliance policy", "Publish the training content summary"],
    assess: (i) =>
      gpaiProvider(i)
        ? { status: "needs_evidence", evidence: ["Model technical documentation", "Copyright policy", "Published training content summary"] }
        : null,
  },
];
