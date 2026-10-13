import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { downloadPdf } = vi.hoisted(() => ({ downloadPdf: vi.fn() }));
vi.mock("@/lib/assessment/pdf", async (orig) => ({ ...(await orig<typeof import("@/lib/assessment/pdf")>()), downloadPdf }));

import { Workspace } from "./Workspace";

type User = ReturnType<typeof userEvent.setup>;

const doc = () => screen.getByRole("region", { name: "Assessment document" });
const next = (user: User) => user.click(screen.getByRole("button", { name: "Next" }));
const goTo = (user: User, step: string) => user.click(screen.getByRole("button", { name: new RegExp(`${step}$`) }));
const count = (status: string) => within(doc()).getByTestId(`count-${status}`);
const choose = (user: User, group: string, option: string) =>
  user.click(within(screen.getByRole("group", { name: group })).getByRole("radio", { name: option }));

describe("Workspace", () => {
  beforeEach(() => {
    downloadPdf.mockReset();
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
  });

  it("shows an empty document skeleton before anything is answered", () => {
    render(<Workspace />);
    expect(within(doc()).getByText("Name your application")).toBeInTheDocument();
    expect(within(doc()).getAllByText("unanswered").length).toBeGreaterThan(5);
    expect(within(doc()).getByText("None listed.")).toBeInTheDocument();
  });

  it("writes the application name, purpose and facts into the document as you type", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.type(screen.getByLabelText("Application name"), "Hiring Screener");
    await user.type(screen.getByLabelText(/^Purpose/), "Ranks CVs for recruiters");
    await user.selectOptions(screen.getByLabelText("Use case"), "employment");
    expect(within(doc()).getByRole("heading", { level: 1, name: "Hiring Screener" })).toBeInTheDocument();
    expect(within(doc()).getByText("Ranks CVs for recruiters")).toBeInTheDocument();
    expect(within(doc()).getByText("Hiring, worker management or promotion")).toBeInTheDocument();
  });

  it("updates findings live and counts gaps in the stamps", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    expect(count("gap")).toHaveTextContent("0");
    await goTo(user, "Application");
    await user.click(screen.getByRole("checkbox", { name: /Prohibited practice/ }));
    expect(count("gap")).toHaveTextContent("1");
    expect(within(doc()).getByText("Prohibited AI practices")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Prohibited practice/ }));
    expect(count("gap")).toHaveTextContent("0");
  });

  it("moves a finding between groups when a control answer changes", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await goTo(user, "Controls");
    const before = Number(count("needs_evidence").textContent);
    await choose(user, "An impact assessment on individuals is done", "Yes");
    expect(Number(count("needs_evidence").textContent)).toBe(before - 1);
    await choose(user, "An impact assessment on individuals is done", "No");
    expect(count("gap")).toHaveTextContent("1");
  });

  it("builds the providers table and a per-provider finding", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await goTo(user, "Providers");
    await user.click(screen.getByRole("button", { name: "Add provider" }));
    await user.type(screen.getByLabelText("Provider name"), "Acme LLM");
    await choose(user, "Do they process personal data for you?", "Yes");
    await choose(user, "Is a data processing agreement in place?", "No");
    const table = within(doc()).getByRole("table");
    expect(within(table).getByText("Acme LLM")).toBeInTheDocument();
    expect(within(doc()).getByText(/Processor contract with AI provider/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove provider" }));
    expect(within(doc()).getByText("None listed.")).toBeInTheDocument();
  });

  it("scrolls the document to the section the current step fills in", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await goTo(user, "Providers");
    const calls = vi.mocked(Element.prototype.scrollIntoView).mock.contexts as HTMLElement[];
    expect(calls.at(-1)?.id).toBe("doc-providers");
    await goTo(user, "Controls");
    expect((vi.mocked(Element.prototype.scrollIntoView).mock.contexts as HTMLElement[]).at(-1)?.id).toBe("doc-findings");
  });

  it("walks the steps with Back and Next and marks the current one", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    expect(screen.getByRole("button", { name: /Application$/ })).toHaveAttribute("aria-current", "step");
    await next(user);
    expect(screen.getByRole("heading", { level: 1, name: "What data and decisions are involved?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Application name")).toBeInTheDocument();
  });

  it("reveals follow-up questions only when they apply", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await goTo(user, "Transparency");
    expect(screen.queryByText("Are they told it is AI?")).not.toBeInTheDocument();
    await choose(user, "Do people interact with it directly?", "Yes");
    expect(screen.getByText("Are they told it is AI?")).toBeInTheDocument();
  });

  it("explains an empty framework selection and blocks the PDF until it can be built", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await goTo(user, "Frameworks");
    const download = screen.getByRole("button", { name: "Download PDF" });
    expect(download).toBeDisabled();
    for (const box of screen.getAllByRole("checkbox")) await user.click(box);
    expect(within(doc()).getByText(/Pick at least one framework/)).toBeInTheDocument();
  });

  it("downloads the PDF and surfaces a failure", async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.type(screen.getByLabelText("Application name"), "Hiring Screener");
    await goTo(user, "Frameworks");
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(downloadPdf).toHaveBeenCalledOnce();
    expect(downloadPdf.mock.calls[0][0].input.appName).toBe("Hiring Screener");
    downloadPdf.mockRejectedValueOnce(new Error("boom"));
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate the PDF");
  });
});
