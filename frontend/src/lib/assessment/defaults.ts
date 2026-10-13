import { CONTROL_KEYS, type AssessmentInput, type ControlKey, type ThirdPartyProvider, type Tri } from "./types";

export const emptyProvider = (): ThirdPartyProvider => ({
  name: "",
  processesPersonalData: "unsure",
  dpaInPlace: "unsure",
  outsideEea: "unsure",
  transferMechanism: "unsure",
});

export const defaultInput = (): AssessmentInput => ({
  appName: "",
  purpose: "",
  useCase: "other",
  role: "both",
  euNexus: "yes",
  usesPersonalData: "unsure",
  usesSpecialCategoryData: "no",
  trainsOnUserData: "no",
  automatedDecisions: "no",
  humanOversight: "review_sample",
  interactsWithPeople: "no",
  disclosesAi: "unsure",
  generatesSyntheticContent: "no",
  marksOutputs: "unsure",
  prohibitedPractice: false,
  providesGpai: "no",
  controls: Object.fromEntries(CONTROL_KEYS.map((k) => [k, "unsure"])) as Record<ControlKey, Tri>,
  providers: [],
  frameworks: ["eu-ai-act", "gdpr", "nist-ai-rmf", "iso-42001"],
});
