"use client";

import { useState } from "react";
import { defaultInput, emptyProvider } from "@/lib/assessment/defaults";
import {
  FRAMEWORK_LABELS,
  type AssessmentInput,
  type ControlKey,
  type FrameworkId,
  type HumanOversight,
  type Role,
  type ThirdPartyProvider,
  type UseCase,
} from "@/lib/assessment/types";
import { Field, Section, Select, TextArea, TextInput, TriSelect } from "./fields";

const USE_CASES: { value: UseCase; label: string }[] = [
  { value: "employment", label: "Hiring, worker management or promotion" },
  { value: "education", label: "Education: admissions, assessment, proctoring" },
  { value: "credit_insurance", label: "Credit scoring or life/health insurance pricing" },
  { value: "healthcare", label: "Healthcare, emergency triage or access to essential services" },
  { value: "law_enforcement_migration_justice", label: "Law enforcement, migration, justice or elections" },
  { value: "biometrics", label: "Biometric identification or categorisation" },
  { value: "critical_infrastructure", label: "Critical infrastructure (energy, traffic, water)" },
  { value: "customer_support", label: "Customer support chatbot or assistant" },
  { value: "content_generation", label: "Content generation (text, image, audio, video)" },
  { value: "internal_productivity", label: "Internal productivity tooling" },
  { value: "other", label: "Other" },
];

const ROLES: { value: Role; label: string }[] = [
  { value: "provider", label: "Provider: I build or sell the system" },
  { value: "deployer", label: "Deployer: I use a system built by someone else" },
  { value: "both", label: "Both" },
];

const OVERSIGHT: { value: HumanOversight; label: string }[] = [
  { value: "none", label: "No human reviews outputs" },
  { value: "review_sample", label: "A person reviews a sample of outputs" },
  { value: "review_each", label: "A person reviews every output before it takes effect" },
];

const CONTROL_QUESTIONS: { key: ControlKey; label: string }[] = [
  { key: "lawfulBasis", label: "Is a lawful basis for processing personal data recorded?" },
  { key: "privacyNotice", label: "Does your privacy notice cover this AI processing?" },
  { key: "dpia", label: "Has a data protection impact assessment been completed?" },
  { key: "riskManagement", label: "Is there a documented AI risk management or risk assessment process?" },
  { key: "impactAssessment", label: "Has an impact assessment of this AI system on individuals been done?" },
  { key: "technicalDocs", label: "Is technical documentation of the system maintained?" },
  { key: "logging", label: "Does the system automatically log events?" },
  { key: "testing", label: "Are evaluation metrics and test results documented?" },
  { key: "monitoring", label: "Is the system monitored after deployment?" },
  { key: "aiLiteracy", label: "Have staff operating the system had AI training?" },
  { key: "governanceRoles", label: "Are AI risk roles and responsibilities documented?" },
  { key: "aiPolicy", label: "Has an AI policy been approved by management?" },
];

export function AssessmentForm({
  initial,
  onSubmit,
}: {
  initial?: AssessmentInput;
  onSubmit: (input: AssessmentInput) => void;
}) {
  const [input, setInput] = useState<AssessmentInput>(() => initial ?? defaultInput());
  const set = <K extends keyof AssessmentInput>(key: K, value: AssessmentInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const setProvider = (index: number, patch: Partial<ThirdPartyProvider>) =>
    set("providers", input.providers.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const removeProvider = (index: number) =>
    set("providers", input.providers.filter((_, i) => i !== index));

  const toggleFramework = (id: FrameworkId) =>
    set("frameworks", input.frameworks.includes(id) ? input.frameworks.filter((f) => f !== id) : [...input.frameworks, id]);

  const canSubmit = input.appName.trim() !== "" && input.purpose.trim() !== "" && input.frameworks.length > 0;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(input);
      }}
    >
      <Section title="1. Your application">
        <Field label="Application name">
          <TextInput value={input.appName} onChange={(e) => set("appName", e.target.value)} required />
        </Field>
        <Field label="Purpose" hint="What does it do, and for whom?">
          <TextArea value={input.purpose} onChange={(e) => set("purpose", e.target.value)} required />
        </Field>
        <Select label="Use case" value={input.useCase} onChange={(v) => set("useCase", v)} options={USE_CASES} />
        <Select label="Your role" value={input.role} onChange={(v) => set("role", v)} options={ROLES} />
        <TriSelect
          label="Is the system placed on the EU market, or are its outputs or the people affected in the EU?"
          value={input.euNexus}
          onChange={(v) => set("euNexus", v)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={input.prohibitedPractice}
            onChange={(e) => set("prohibitedPractice", e.target.checked)}
          />
          The system does social scoring, emotion recognition at work or school, or untargeted scraping of facial images
        </label>
      </Section>

      <Section title="2. Data and decisions">
        <TriSelect label="Does it process personal data?" value={input.usesPersonalData} onChange={(v) => set("usesPersonalData", v)} />
        <TriSelect
          label="Does it process special category data (health, biometrics, ethnicity, beliefs)?"
          value={input.usesSpecialCategoryData}
          onChange={(v) => set("usesSpecialCategoryData", v)}
        />
        <TriSelect
          label="Do you train or improve models on user data?"
          value={input.trainsOnUserData}
          onChange={(v) => set("trainsOnUserData", v)}
        />
        <TriSelect
          label="Does it make or drive decisions with legal or similarly significant effects on people?"
          value={input.automatedDecisions}
          onChange={(v) => set("automatedDecisions", v)}
        />
        <Select label="Human oversight" value={input.humanOversight} onChange={(v) => set("humanOversight", v)} options={OVERSIGHT} />
      </Section>

      <Section title="3. Transparency and model type">
        <TriSelect
          label="Do people interact with the system directly (for example a chatbot)?"
          value={input.interactsWithPeople}
          onChange={(v) => set("interactsWithPeople", v)}
        />
        {input.interactsWithPeople === "yes" && (
          <TriSelect label="Are users told they are interacting with AI?" value={input.disclosesAi} onChange={(v) => set("disclosesAi", v)} />
        )}
        <TriSelect
          label="Does it generate synthetic text, images, audio or video?"
          value={input.generatesSyntheticContent}
          onChange={(v) => set("generatesSyntheticContent", v)}
        />
        {input.generatesSyntheticContent === "yes" && (
          <TriSelect
            label="Are generated outputs marked as AI-generated in a machine-readable way?"
            value={input.marksOutputs}
            onChange={(v) => set("marksOutputs", v)}
          />
        )}
        <TriSelect
          label="Do you provide a general-purpose AI model to others?"
          value={input.providesGpai}
          onChange={(v) => set("providesGpai", v)}
        />
      </Section>

      <Section title="4. Third-party AI providers">
        {input.providers.map((p, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <Field label="Provider name">
              <TextInput value={p.name} onChange={(e) => setProvider(index, { name: e.target.value })} required />
            </Field>
            <TriSelect
              label="Do they process personal data for you?"
              value={p.processesPersonalData}
              onChange={(v) => setProvider(index, { processesPersonalData: v })}
            />
            <TriSelect label="Is a data processing agreement in place?" value={p.dpaInPlace} onChange={(v) => setProvider(index, { dpaInPlace: v })} />
            <TriSelect label="Is data processed outside the EEA?" value={p.outsideEea} onChange={(v) => setProvider(index, { outsideEea: v })} />
            <TriSelect
              label="Is there a transfer mechanism (adequacy decision or SCCs)?"
              value={p.transferMechanism}
              onChange={(v) => setProvider(index, { transferMechanism: v })}
            />
            <button
              type="button"
              className="self-start text-sm text-red-600 underline"
              onClick={() => removeProvider(index)}
            >
              Remove provider
            </button>
          </div>
        ))}
        <button
          type="button"
          className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          onClick={() => set("providers", [...input.providers, emptyProvider()])}
        >
          Add provider
        </button>
      </Section>

      <Section title="5. Controls you already have">
        {CONTROL_QUESTIONS.map(({ key, label }) => (
          <TriSelect
            key={key}
            label={label}
            value={input.controls[key]}
            onChange={(v) => set("controls", { ...input.controls, [key]: v })}
          />
        ))}
      </Section>

      <Section title="6. Frameworks to assess against">
        {(Object.keys(FRAMEWORK_LABELS) as FrameworkId[]).map((id) => (
          <label key={id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={input.frameworks.includes(id)} onChange={() => toggleFramework(id)} />
            {FRAMEWORK_LABELS[id]}
          </label>
        ))}
      </Section>

      <button
        type="submit"
        disabled={!canSubmit}
        className="self-start rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-40"
      >
        Generate assessment
      </button>
    </form>
  );
}
