import type { ReactNode } from "react";
import { findingDetails, groupByStatus } from "@/lib/assessment/evaluate";
import { DISCLAIMER } from "@/lib/assessment/pdf";
import { OVERSIGHT, ROLES, STATUS_META, STATUS_ORDER, TRI_OPTIONS, USE_CASES, label } from "@/lib/assessment/options";
import { FRAMEWORK_LABELS, type AssessmentInput, type AssessmentResult, type FindingStatus, type Tri } from "@/lib/assessment/types";

const STATUS_STYLE: Record<FindingStatus, { ink: string; tint: string; border: string; bar: string; marker: string }> = {
  gap: { ink: "text-gap", tint: "bg-gap-tint", border: "border-gap", bar: "bg-gap", marker: "var(--color-gap-tint)" },
  needs_evidence: { ink: "text-evidence", tint: "bg-evidence-tint", border: "border-evidence", bar: "bg-evidence", marker: "var(--color-evidence-tint)" },
  needs_legal: { ink: "text-legal", tint: "bg-legal-tint", border: "border-legal", bar: "bg-legal", marker: "var(--color-legal-tint)" },
  no_gap: { ink: "text-clear", tint: "bg-clear-tint", border: "border-clear", bar: "bg-clear", marker: "var(--color-clear-tint)" },
};

const STAMP_TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

function Stamp({ status, count, tilt }: { status: FindingStatus; count: number; tilt: string }) {
  const s = STATUS_STYLE[status];
  return (
    <div className={`flex flex-col items-center rounded-sm border-2 px-3 py-2 ${s.ink} ${s.border} ${tilt}`}>
      <span className="font-serif text-3xl font-semibold leading-none tabular-nums" data-testid={`count-${status}`}>
        {count}
      </span>
      <span className="mt-1 text-xs font-semibold">{STATUS_META[status].short}</span>
    </div>
  );
}

export function CountStrip({ results }: { results: AssessmentResult[] }) {
  const groups = groupByStatus(results);
  return (
    <div className="sticky top-0 z-10 bg-desk py-2">
      <ul className="mx-auto flex max-w-[46rem] flex-wrap justify-center gap-x-5 gap-y-1 px-3 text-sm sm:px-0" aria-label="Live totals">
        {STATUS_ORDER.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-full ${STATUS_STYLE[status].bar}`} />
            <span className="font-semibold tabular-nums">{groups[status].length}</span>
            <span className="text-muted">{STATUS_META[status].short.toLowerCase()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ id, active, title, children }: { id: string; active: boolean; title: string; children: ReactNode }) {
  return (
    <section id={`doc-${id}`} className="relative mt-10 scroll-mt-14">
      <span
        aria-hidden
        className={`absolute -left-5 bottom-0 top-1 w-[3px] rounded-full bg-cobalt transition-opacity duration-300 sm:-left-8 ${active ? "opacity-100" : "opacity-0"}`}
      />
      <h2 className="mb-3 font-serif text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Blank({ children }: { children: ReactNode }) {
  return <span className="text-faint">{children}</span>;
}

function Fact({ name, value }: { name: string; value?: string }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <dt className="min-w-0 text-muted">{name}</dt>
      <span aria-hidden className="min-w-3 flex-1 border-b border-dotted border-rule" />
      <dd className="min-w-0 text-right">{value ?? <Blank>unanswered</Blank>}</dd>
    </div>
  );
}

function FindingRow({ result }: { result: AssessmentResult }) {
  const s = STATUS_STYLE[result.finding.status];
  const { requirement: r } = result;
  return (
    <li className="finding-row border-b border-rule/70" style={{ "--marker": s.marker } as React.CSSProperties}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-baseline gap-3 py-2 text-[15px]">
          <span aria-hidden className={`mt-1.5 size-2 shrink-0 self-start rounded-full ${s.bar}`} />
          <span className="w-28 shrink-0 text-sm tabular-nums text-muted sm:w-36">{r.reference}</span>
          <span className="flex-1">
            {r.title}
            {result.providerName && <span className="text-muted"> ({result.providerName})</span>}
          </span>
          <span aria-hidden className="text-faint transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="flex flex-col gap-1.5 pb-3 pl-5 text-sm leading-relaxed sm:pl-[10.25rem]">
          <p className="text-muted">{r.summary}</p>
          {findingDetails(result).map((line, i) => (
            <p key={i}>
              {line.label && <span className="font-semibold">{line.label}: </span>}
              {line.text}
            </p>
          ))}
        </div>
      </details>
    </li>
  );
}

export function DocumentView({
  input,
  results,
  touched,
  activeAnchor,
}: {
  input: AssessmentInput;
  results: AssessmentResult[];
  touched: ReadonlySet<string>;
  activeAnchor: string;
}) {
  const groups = groupByStatus(results);
  const tri = (v: Tri) => label(TRI_OPTIONS, v);
  const answered = <T,>(key: string, show: () => T): T | undefined => (touched.has(key) ? show() : undefined);

  return (
    <article className="mx-auto w-full max-w-[46rem] bg-paper px-6 py-8 font-serif shadow-[0_1px_2px_rgba(23,32,46,0.12),0_12px_32px_-12px_rgba(23,32,46,0.25)] sm:px-14 sm:py-12">
      <header>
        <p className="text-sm text-muted">AI compliance assessment</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight">
          {input.appName.trim() || <Blank>Name your application</Blank>}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {input.frameworks.length > 0 ? input.frameworks.map((f) => FRAMEWORK_LABELS[f]).join(", ") : "No framework selected"}
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          {STATUS_ORDER.map((status, i) => (
            <Stamp key={status} status={status} count={groups[status].length} tilt={STAMP_TILT[i]} />
          ))}
        </div>
      </header>

      <Section id="system" active={activeAnchor === "system"} title="About this system">
        {input.purpose.trim() ? (
          <p className="leading-relaxed">{input.purpose}</p>
        ) : (
          <div aria-hidden className="flex flex-col gap-2">
            <span className="h-3 w-full rounded-sm bg-rule/50" />
            <span className="h-3 w-4/5 rounded-sm bg-rule/50" />
          </div>
        )}
        <dl className="mt-5 text-[15px]">
          <Fact name="Use case" value={answered("useCase", () => label(USE_CASES, input.useCase))} />
          <Fact name="Your role" value={answered("role", () => label(ROLES, input.role))} />
          <Fact name="Sold or used in the EU" value={answered("euNexus", () => tri(input.euNexus))} />
          <Fact name="Prohibited practice" value={answered("prohibitedPractice", () => (input.prohibitedPractice ? "Yes" : "No"))} />
          <Fact name="Personal data" value={answered("usesPersonalData", () => tri(input.usesPersonalData))} />
          <Fact name="Special category data" value={answered("usesSpecialCategoryData", () => tri(input.usesSpecialCategoryData))} />
          <Fact name="Trains on user data" value={answered("trainsOnUserData", () => tri(input.trainsOnUserData))} />
          <Fact name="Significant automated decisions" value={answered("automatedDecisions", () => tri(input.automatedDecisions))} />
          <Fact name="Human oversight" value={answered("humanOversight", () => label(OVERSIGHT, input.humanOversight))} />
          <Fact name="Interacts with people" value={answered("interactsWithPeople", () => tri(input.interactsWithPeople))} />
          {input.interactsWithPeople === "yes" && <Fact name="Tells them it is AI" value={answered("disclosesAi", () => tri(input.disclosesAi))} />}
          <Fact name="Generates synthetic content" value={answered("generatesSyntheticContent", () => tri(input.generatesSyntheticContent))} />
          {input.generatesSyntheticContent === "yes" && (
            <Fact name="Marks outputs as AI-generated" value={answered("marksOutputs", () => tri(input.marksOutputs))} />
          )}
          <Fact name="Provides a general-purpose model" value={answered("providesGpai", () => tri(input.providesGpai))} />
        </dl>
      </Section>

      <Section id="providers" active={activeAnchor === "providers"} title="Third-party AI providers">
        {input.providers.length === 0 ? (
          <p className="text-sm text-faint">None listed.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-rule">
                <th className="py-1.5 pr-3 font-medium">Provider</th>
                <th className="py-1.5 pr-3 font-medium">Personal data</th>
                <th className="py-1.5 pr-3 font-medium">DPA</th>
                <th className="py-1.5 pr-3 font-medium">Outside EEA</th>
                <th className="py-1.5 font-medium">Transfer basis</th>
              </tr>
            </thead>
            <tbody>
              {input.providers.map((p, i) => (
                <tr key={i} className="border-b border-rule/70">
                  <td className="py-1.5 pr-3">{p.name.trim() || <Blank>unnamed</Blank>}</td>
                  <td className="py-1.5 pr-3">{tri(p.processesPersonalData)}</td>
                  <td className="py-1.5 pr-3">{tri(p.dpaInPlace)}</td>
                  <td className="py-1.5 pr-3">{tri(p.outsideEea)}</td>
                  <td className="py-1.5">{tri(p.transferMechanism)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section id="findings" active={activeAnchor === "findings"} title="Findings">
        {input.frameworks.length === 0 ? (
          <p className="text-sm text-muted">Pick at least one framework in the last step to see findings.</p>
        ) : (
          STATUS_ORDER.map((status) => {
            const rows = groups[status];
            if (rows.length === 0) return null;
            const list = (
              <ul>
                {rows.map((r) => (
                  <FindingRow key={`${r.requirement.id}|${r.providerName ?? ""}|${status}`} result={r} />
                ))}
              </ul>
            );
            const heading = (
              <span className="flex items-baseline gap-2">
                <span className={`font-semibold ${STATUS_STYLE[status].ink}`}>
                  {STATUS_META[status].title} ({rows.length})
                </span>
                <span className="text-sm text-muted">{STATUS_META[status].blurb}</span>
              </span>
            );
            return status === "no_gap" ? (
              <details key={status} className="mt-6">
                <summary className="cursor-pointer py-1">{heading}</summary>
                {list}
              </details>
            ) : (
              <div key={status} className="mt-6">
                <h3 className="py-1">{heading}</h3>
                {list}
              </div>
            );
          })
        )}
      </Section>

      <footer className="mt-12 border-t border-rule pt-4 text-xs leading-relaxed text-muted">{DISCLAIMER}</footer>
    </article>
  );
}
