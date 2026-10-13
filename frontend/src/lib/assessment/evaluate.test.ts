import { describe, expect, it } from "vitest";
import { defaultInput } from "./defaults";
import { evaluate, groupByStatus } from "./evaluate";
import type { AssessmentInput } from "./types";

const base = (over: Partial<AssessmentInput> = {}): AssessmentInput => ({ ...defaultInput(), ...over });
const find = (input: AssessmentInput, id: string) =>
  evaluate(input).results.filter((r) => r.requirement.id === id);
const withControls = (input: AssessmentInput, c: Partial<AssessmentInput["controls"]>): AssessmentInput => ({
  ...input,
  controls: { ...input.controls, ...c },
});

describe("evaluate", () => {
  it("only evaluates selected frameworks", () => {
    const { results } = evaluate(base({ frameworks: ["nist-ai-rmf"] }));
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.requirement.framework === "nist-ai-rmf")).toBe(true);
  });

  it("returns nothing when no framework is selected", () => {
    expect(evaluate(base({ frameworks: [] })).results).toEqual([]);
  });

  it("skips EU AI Act and GDPR items without an EU nexus", () => {
    const { results } = evaluate(base({ euNexus: "no", usesPersonalData: "yes" }));
    expect(results.some((r) => ["eu-ai-act", "gdpr"].includes(r.requirement.framework))).toBe(false);
  });

  it("flags a prohibited practice as a gap", () => {
    const [r] = find(base({ prohibitedPractice: true }), "eu-art-5");
    expect(r.finding.status).toBe("gap");
  });

  it("sends biometric Art. 5 review to legal interpretation", () => {
    const [r] = find(base({ useCase: "biometrics" }), "eu-art-5");
    expect(r.finding.status).toBe("needs_legal");
  });

  it("requires legal interpretation for Annex III classification", () => {
    expect(find(base({ useCase: "employment" }), "eu-art-6")[0].finding.status).toBe("needs_legal");
    expect(find(base({ useCase: "customer_support" }), "eu-art-6")[0].finding.status).toBe("no_gap");
  });

  it("applies high-risk provider duties only to Annex III providers", () => {
    expect(find(base({ useCase: "customer_support" }), "eu-art-9")).toHaveLength(0);
    expect(find(base({ useCase: "employment", role: "deployer" }), "eu-art-9")).toHaveLength(0);
    expect(find(base({ useCase: "employment", role: "provider" }), "eu-art-9")).toHaveLength(1);
  });

  it("maps control answers: no is a gap, yes is no gap, unsure needs evidence", () => {
    const input = base({ useCase: "employment" });
    expect(find(withControls(input, { riskManagement: "no" }), "eu-art-9")[0].finding.status).toBe("gap");
    expect(find(withControls(input, { riskManagement: "yes" }), "eu-art-9")[0].finding.status).toBe("no_gap");
    expect(find(withControls(input, { riskManagement: "unsure" }), "eu-art-9")[0].finding.status).toBe("needs_evidence");
  });

  it("maps human oversight levels for Art. 14", () => {
    const input = base({ useCase: "employment" });
    expect(find({ ...input, humanOversight: "none" }, "eu-art-14")[0].finding.status).toBe("gap");
    expect(find({ ...input, humanOversight: "review_sample" }, "eu-art-14")[0].finding.status).toBe("needs_evidence");
    expect(find({ ...input, humanOversight: "review_each" }, "eu-art-14")[0].finding.status).toBe("no_gap");
  });

  it("requires AI disclosure only when people interact with the system", () => {
    expect(find(base({ interactsWithPeople: "no" }), "eu-art-50-1")).toHaveLength(0);
    expect(find(base({ interactsWithPeople: "yes", disclosesAi: "no" }), "eu-art-50-1")[0].finding.status).toBe("gap");
    expect(find(base({ interactsWithPeople: "unsure" }), "eu-art-50-1")[0].finding.status).toBe("needs_evidence");
  });

  it("applies GDPR items only when personal data is processed", () => {
    expect(find(base({ usesPersonalData: "no" }), "gdpr-art-6")).toHaveLength(0);
    expect(find(base({ usesPersonalData: "yes" }), "gdpr-art-6")).toHaveLength(1);
  });

  it("flags Art. 22 as a gap with automated decisions and no human involvement", () => {
    const input = base({ usesPersonalData: "yes", automatedDecisions: "yes" });
    expect(find({ ...input, humanOversight: "none" }, "gdpr-art-22")[0].finding.status).toBe("gap");
    expect(find({ ...input, humanOversight: "review_each" }, "gdpr-art-22")[0].finding.status).toBe("needs_legal");
  });

  it("requires a DPIA only when a high-risk trigger is present", () => {
    expect(find(base({ usesPersonalData: "yes" }), "gdpr-art-35")).toHaveLength(0);
    const triggered = base({ usesPersonalData: "yes", usesSpecialCategoryData: "yes" });
    expect(find(withControls(triggered, { dpia: "no" }), "gdpr-art-35")[0].finding.status).toBe("gap");
  });

  describe("per-provider requirements", () => {
    const provider = (over = {}) => ({
      name: "Acme AI",
      processesPersonalData: "yes" as const,
      dpaInPlace: "no" as const,
      outsideEea: "yes" as const,
      transferMechanism: "no" as const,
      ...over,
    });

    it("produces one finding per provider, labelled by name", () => {
      const input = base({ providers: [provider(), provider({ name: "Beta ML", dpaInPlace: "yes" })] });
      const results = find(input, "gdpr-art-28");
      expect(results.map((r) => [r.providerName, r.finding.status])).toEqual([
        ["Acme AI", "gap"],
        ["Beta ML", "no_gap"],
      ]);
    });

    it("skips providers that do not process personal data or stay inside the EEA", () => {
      expect(find(base({ providers: [provider({ processesPersonalData: "no" })] }), "gdpr-art-28")).toHaveLength(0);
      expect(find(base({ providers: [provider({ outsideEea: "no" })] }), "gdpr-ch-v")).toHaveLength(0);
    });

    it("flags missing transfer mechanism and asks for evidence when location is unsure", () => {
      expect(find(base({ providers: [provider()] }), "gdpr-ch-v")[0].finding.status).toBe("gap");
      expect(find(base({ providers: [provider({ outsideEea: "unsure" })] }), "gdpr-ch-v")[0].finding.status).toBe("needs_evidence");
    });

    it("produces nothing when no providers are listed", () => {
      expect(find(base(), "gdpr-art-28")).toHaveLength(0);
    });
  });

  it("never reports no_gap for items that need evidence or legal interpretation", () => {
    const { results } = evaluate(base({ useCase: "employment", usesPersonalData: "yes", providers: [] }));
    for (const r of results) {
      if (r.requirement.evaluability === "evidence") expect(r.finding.status).toBe("needs_evidence");
      if (r.requirement.evaluability === "legal") expect(r.finding.status).toBe("needs_legal");
    }
  });

  it("groups results by status and stamps the generation time", () => {
    const now = new Date("2026-01-02T03:04:05.000Z");
    const assessment = evaluate(base({ prohibitedPractice: true }), now);
    expect(assessment.generatedAt).toBe(now.toISOString());
    const groups = groupByStatus(assessment);
    expect(Object.values(groups).flat()).toHaveLength(assessment.results.length);
    expect(groups.gap.some((r) => r.requirement.id === "eu-art-5")).toBe(true);
  });
});
