"use client";

import { useEffect, useState } from "react";
import { evaluate } from "@/lib/assessment/evaluate";
import type { Assessment, AssessmentInput } from "@/lib/assessment/types";
import { AssessmentForm } from "./AssessmentForm";
import { Report } from "./Report";

export function AssessmentApp() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [draft, setDraft] = useState<AssessmentInput>();

  // Switching between form and report would otherwise keep the previous scroll offset.
  const showingReport = assessment !== null;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [showingReport]);

  if (assessment) return <Report assessment={assessment} onBack={() => setAssessment(null)} />;
  return (
    <AssessmentForm
      initial={draft}
      onSubmit={(input) => {
        setDraft(input);
        setAssessment(evaluate(input));
      }}
    />
  );
}
