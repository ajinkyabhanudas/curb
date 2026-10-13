import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { downloadPdf } = vi.hoisted(() => ({ downloadPdf: vi.fn() }));
vi.mock("@/lib/assessment/pdf", async (orig) => ({ ...(await orig<typeof import("@/lib/assessment/pdf")>()), downloadPdf }));

import { AssessmentApp } from "./AssessmentApp";

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Application name"), "Hiring Bot");
  await user.type(screen.getByLabelText(/^Purpose/), "Screens CVs for recruiters");
}

describe("AssessmentApp", () => {
  beforeEach(() => downloadPdf.mockReset());

  it("blocks submission until name, purpose and a framework are provided", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);
    const submit = screen.getByRole("button", { name: "Generate assessment" });
    expect(submit).toBeDisabled();
    await fillBasics(user);
    expect(submit).toBeEnabled();
    for (const box of screen.getAllByRole("checkbox", { name: /EU AI Act|GDPR|NIST|ISO/ })) await user.click(box);
    expect(submit).toBeDisabled();
  });

  it("shows a prohibited practice as a gap in the report", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);
    await fillBasics(user);
    await user.click(screen.getByRole("checkbox", { name: /social scoring/ }));
    await user.click(screen.getByRole("button", { name: "Generate assessment" }));
    expect(screen.getByText("Assessment for Hiring Bot")).toBeInTheDocument();
    const gaps = screen.getByRole("heading", { name: /Potential compliance gaps/ }).closest("section")!;
    expect(within(gaps).getByText(/Art\. 5: Prohibited AI practices/)).toBeInTheDocument();
    expect(screen.getByText(/not legal advice/)).toBeInTheDocument();
  });

  it("separates evidence and legal-interpretation items from gaps", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);
    await fillBasics(user);
    await user.selectOptions(screen.getByLabelText("Use case"), "employment");
    await user.click(screen.getByRole("button", { name: "Generate assessment" }));
    const legal = screen.getByRole("heading", { name: /Needs legal interpretation/ }).closest("section")!;
    expect(within(legal).getByText(/Art\. 6 and Annex III/)).toBeInTheDocument();
    const evidence = screen.getByRole("heading", { name: /Needs additional evidence/ }).closest("section")!;
    expect(within(evidence).getByText(/Art\. 10: Data and data governance/)).toBeInTheDocument();
  });

  it("adds a provider and reports a per-provider GDPR finding", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Add provider" }));
    await user.type(screen.getByLabelText("Provider name"), "Acme AI");
    await user.selectOptions(screen.getByLabelText("Do they process personal data for you?"), "yes");
    await user.selectOptions(screen.getByLabelText("Is a data processing agreement in place?"), "no");
    await user.click(screen.getByRole("button", { name: "Generate assessment" }));
    expect(screen.getByText(/Art\. 28: Processor contract with AI provider \(Acme AI\)/)).toBeInTheDocument();
  });

  it("scrolls to the top when switching between form and report", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);
    await fillBasics(user);
    vi.mocked(window.scrollTo).mockClear();
    await user.click(screen.getByRole("button", { name: "Generate assessment" }));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    vi.mocked(window.scrollTo).mockClear();
    await user.click(screen.getByRole("button", { name: "Edit answers" }));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("keeps answers when returning to edit", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Generate assessment" }));
    await user.click(screen.getByRole("button", { name: "Edit answers" }));
    expect(screen.getByLabelText("Application name")).toHaveValue("Hiring Bot");
  });

  it("downloads the PDF and surfaces failures", async () => {
    const user = userEvent.setup();
    render(<AssessmentApp />);
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Generate assessment" }));
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(downloadPdf).toHaveBeenCalledOnce();
    downloadPdf.mockRejectedValueOnce(new Error("boom"));
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate the PDF");
  });
});
