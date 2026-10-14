import type { jsPDF } from "jspdf";
import { findingDetails, groupByStatus, resultHeading } from "./evaluate";
import { FRAMEWORK_LABELS, type Assessment, type AssessmentResult, type FindingStatus } from "./types";

const SECTIONS: { status: FindingStatus; title: string; blurb: string }[] = [
  { status: "gap", title: "Potential compliance gaps", blurb: "Your answers indicate these requirements are not met." },
  { status: "needs_evidence", title: "Needs additional evidence", blurb: "Cannot be judged from the answers given. The listed evidence is required." },
  { status: "needs_legal", title: "Needs legal interpretation", blurb: "Turns on legal interpretation. Take legal advice." },
  { status: "no_gap", title: "No gap indicated", blurb: "Self-reported answers indicate no gap. Not verified." },
];

export const DISCLAIMER =
  "This is an automated first-pass assessment based on self-reported answers. It is not legal advice and does not establish compliance. Requirement summaries are paraphrased; consult the cited source text. Items marked 'needs additional evidence' or 'needs legal interpretation' are outside what this prototype can evaluate.";

const MARGIN = 15;
const LINE = 5;

class Writer {
  y = MARGIN;
  constructor(private doc: jsPDF) {}

  private get width() {
    return this.doc.internal.pageSize.getWidth() - MARGIN * 2;
  }

  text(text: string, opts: { size?: number; bold?: boolean; indent?: number } = {}) {
    const { size = 10, bold = false, indent = 0 } = opts;
    this.doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size);
    const lines: string[] = this.doc.splitTextToSize(text, this.width - indent);
    for (const line of lines) {
      if (this.y > this.doc.internal.pageSize.getHeight() - MARGIN) {
        this.doc.addPage();
        this.y = MARGIN;
      }
      this.doc.text(line, MARGIN + indent, this.y);
      this.y += size * 0.45 + 1;
    }
  }

  gap(amount = LINE) {
    this.y += amount;
  }
}

function writeResult(w: Writer, result: AssessmentResult) {
  const { requirement } = result;
  w.text(resultHeading(result), { bold: true });
  w.text(FRAMEWORK_LABELS[requirement.framework], { size: 8, indent: 3 });
  w.text(requirement.summary, { indent: 3 });
  for (const { label, text } of findingDetails(result)) {
    w.text(label ? `${label}: ${text}` : text, { indent: 3 });
  }
  w.gap();
}

export async function buildPdf(assessment: Assessment): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const w = new Writer(doc);
  const { input } = assessment;
  const groups = groupByStatus(assessment.results);

  w.text("AI Compliance Assessment", { size: 18, bold: true });
  w.gap(2);
  w.text(`Application: ${input.appName || "Unnamed"}`);
  w.text(`Generated: ${assessment.generatedAt}`);
  w.text(`Frameworks: ${input.frameworks.map((f) => FRAMEWORK_LABELS[f]).join(", ") || "none selected"}`);
  w.text(`Purpose: ${input.purpose || "Not provided"}`);
  w.gap();
  w.text(DISCLAIMER, { size: 9 });
  w.gap();
  w.text("Summary", { size: 13, bold: true });
  for (const s of SECTIONS) w.text(`${s.title}: ${groups[s.status].length}`);
  w.gap();

  for (const s of SECTIONS) {
    w.text(s.title, { size: 13, bold: true });
    w.text(s.blurb, { size: 9 });
    w.gap(2);
    if (groups[s.status].length === 0) w.text("None.", { indent: 3 });
    groups[s.status].forEach((r) => writeResult(w, r));
    w.gap();
  }
  return doc;
}

export async function downloadPdf(assessment: Assessment) {
  const doc = await buildPdf(assessment);
  const slug = assessment.input.appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  doc.save(`ai-compliance-assessment-${slug || "assessment"}.pdf`);
}
