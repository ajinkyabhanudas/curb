"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultInput } from "@/lib/assessment/defaults";
import { assess, evaluate, groupByStatus } from "@/lib/assessment/evaluate";
import { downloadPdf } from "@/lib/assessment/pdf";
import type { AssessmentInput, ControlKey, Tri } from "@/lib/assessment/types";
import { CountStrip, DocumentView } from "./DocumentView";
import { STEPS, StepForm, type FormApi } from "./StepForm";

type View = "answers" | "document";

export function Workspace() {
  const [input, setInput] = useState<AssessmentInput>(defaultInput);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [stepIndex, setStepIndex] = useState(0);
  const [view, setView] = useState<View>("answers");
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[stepIndex];
  const results = useMemo(() => assess(input), [input]);
  const gapCount = groupByStatus(results).gap.length;
  const canDownload = input.appName.trim() !== "" && input.frameworks.length > 0;

  const markTouched = (key: string) => setTouched((prev) => new Set(prev).add(key));
  const api: FormApi = {
    input,
    set: (key, value) => {
      setInput((prev) => ({ ...prev, [key]: value }));
      markTouched(key);
    },
    setControl: (key: ControlKey, value: Tri) => {
      setInput((prev) => ({ ...prev, controls: { ...prev.controls, [key]: value } }));
      markTouched(`controls.${key}`);
    },
  };

  // Keep the document pointed at the section the current step is filling in.
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior = reduced ? "auto" : "smooth";
    if (step.anchor === "system") {
      // The system description shares a page with the title block, so show the whole top.
      document.getElementById("doc-pane")?.scrollTo?.({ top: 0, behavior });
    } else {
      document.getElementById(`doc-${step.anchor}`)?.scrollIntoView({ behavior, block: "start" });
    }
  }, [step.anchor]);

  const download = async () => {
    setError(null);
    try {
      await downloadPdf(evaluate(input));
    } catch {
      setError("Could not generate the PDF. Try again.");
    }
  };

  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-rule bg-panel px-5">
        <span className="font-serif text-xl font-semibold tracking-tight">Curb</span>
        <div className="flex gap-1 lg:hidden" role="tablist" aria-label="View">
          {(["answers", "document"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? "bg-cobalt text-white" : "text-muted"}`}
            >
              {v === "answers" ? "Answers" : `Document (${gapCount} gaps)`}
            </button>
          ))}
        </div>
        <p className="hidden text-sm text-muted lg:block">Prototype. Runs in your browser and sends nothing anywhere.</p>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(24rem,34rem)_1fr]">
        <section
          aria-label="Answers"
          className={`min-h-0 flex-col border-r border-rule bg-panel ${view === "answers" ? "flex" : "hidden"} lg:flex`}
        >
          <nav aria-label="Steps" className="shrink-0 overflow-x-auto border-b border-rule px-5">
            <ol className="flex gap-4">
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => setStepIndex(i)}
                    aria-current={i === stepIndex ? "step" : undefined}
                    className={`whitespace-nowrap border-b-2 py-3 text-sm ${
                      i === stepIndex ? "border-cobalt font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7">
            <h1 className="font-serif text-[1.65rem] font-semibold leading-tight">{step.title}</h1>
            <p className="mt-1.5 max-w-prose text-[15px] text-muted">{step.help}</p>
            <div className="mt-7 flex flex-col gap-6">
              <StepForm stepId={step.id} api={api} />
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-rule px-5 py-3">
            <button
              onClick={() => setStepIndex((i) => i - 1)}
              disabled={stepIndex === 0}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted disabled:invisible"
            >
              Back
            </button>
            {error && (
              <span role="alert" className="text-sm text-gap">
                {error}
              </span>
            )}
            {isLast ? (
              <button
                onClick={download}
                disabled={!canDownload}
                title={canDownload ? undefined : "Add an application name and pick a framework first"}
                className="rounded-md bg-cobalt px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Download PDF
              </button>
            ) : (
              <button
                onClick={() => setStepIndex((i) => i + 1)}
                className="rounded-md bg-cobalt px-5 py-2 text-sm font-medium text-white"
              >
                Next
              </button>
            )}
          </footer>
        </section>

        <section
          id="doc-pane"
          aria-label="Assessment document"
          className={`min-h-0 overflow-y-auto bg-desk ${view === "document" ? "block" : "hidden"} lg:block`}
        >
          <CountStrip results={results} />
          <div className="px-3 pb-10 pt-2 sm:px-8">
            <DocumentView input={input} results={results} touched={touched} activeAnchor={step.anchor} />
          </div>
        </section>
      </div>
    </div>
  );
}
