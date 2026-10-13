"use client";

import { useState } from "react";
import { findingDetails, groupByStatus, resultHeading } from "@/lib/assessment/evaluate";
import { DISCLAIMER, downloadPdf } from "@/lib/assessment/pdf";
import { FRAMEWORK_LABELS, type Assessment, type AssessmentResult, type FindingStatus } from "@/lib/assessment/types";

const SECTIONS: { status: FindingStatus; title: string; blurb: string; tone: string }[] = [
  { status: "gap", title: "Potential compliance gaps", blurb: "Your answers indicate these are not met.", tone: "border-red-500" },
  { status: "needs_evidence", title: "Needs additional evidence", blurb: "Cannot be judged from the answers. Evidence is required.", tone: "border-amber-500" },
  { status: "needs_legal", title: "Needs legal interpretation", blurb: "Turns on legal interpretation. Take legal advice.", tone: "border-violet-500" },
  { status: "no_gap", title: "No gap indicated", blurb: "Self-reported. Not verified.", tone: "border-emerald-500" },
];

function ResultCard({ result, tone }: { result: AssessmentResult; tone: string }) {
  const { requirement } = result;
  return (
    <li className={`flex flex-col gap-1 rounded-md border-l-4 bg-zinc-50 p-3 text-sm dark:bg-zinc-900 ${tone}`}>
      <p className="font-semibold">{resultHeading(result)}</p>
      <p className="text-xs text-zinc-500">{FRAMEWORK_LABELS[requirement.framework]}</p>
      <p>{requirement.summary}</p>
      {findingDetails(result).map(({ label, text }) => (
        <p key={label ?? "detail"}>
          {label ? (
            <>
              <span className="font-medium">{label}:</span> {text}
            </>
          ) : (
            text
          )}
        </p>
      ))}
    </li>
  );
}

export function Report({ assessment, onBack }: { assessment: Assessment; onBack: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const groups = groupByStatus(assessment);

  const download = async () => {
    setError(null);
    try {
      await downloadPdf(assessment);
    } catch {
      setError("Could not generate the PDF. Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Assessment for {assessment.input.appName}</h2>
        <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{DISCLAIMER}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SECTIONS.map((s) => (
          <div key={s.status} className={`rounded-md border-t-4 p-3 ${s.tone}`}>
            <dt className="text-xs text-zinc-500">{s.title}</dt>
            <dd className="text-2xl font-semibold" data-testid={`count-${s.status}`}>
              {groups[s.status].length}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={download} className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background">
          Download PDF
        </button>
        <button onClick={onBack} className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm dark:border-zinc-700">
          Edit answers
        </button>
        {error && (
          <span role="alert" className="text-sm text-red-600">
            {error}
          </span>
        )}
      </div>

      {SECTIONS.map((s) => (
        <section key={s.status} className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">
            {s.title} ({groups[s.status].length})
          </h3>
          <p className="text-sm text-zinc-500">{s.blurb}</p>
          {groups[s.status].length > 0 && (
            <ul className="flex flex-col gap-2">
              {groups[s.status].map((r, i) => (
                <ResultCard key={`${r.requirement.id}-${r.providerName ?? ""}-${i}`} result={r} tone={s.tone} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
