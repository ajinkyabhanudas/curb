import { describe, expect, it } from "vitest";
import { defaultInput } from "./defaults";
import { evaluate } from "./evaluate";
import { buildPdf } from "./pdf";

describe("buildPdf", () => {
  it("renders a multi-page PDF containing references and the disclaimer", async () => {
    const assessment = evaluate({ ...defaultInput(), appName: "Hiring Bot", useCase: "employment", usesPersonalData: "yes" });
    const doc = await buildPdf(assessment);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("renders when no frameworks are selected", async () => {
    const doc = await buildPdf(evaluate({ ...defaultInput(), frameworks: [] }));
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
