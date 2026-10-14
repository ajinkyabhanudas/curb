import { emptyProvider } from "@/lib/assessment/defaults";
import { CONTROL_QUESTIONS, OVERSIGHT, ROLES, USE_CASES } from "@/lib/assessment/options";
import {
  FRAMEWORK_LABELS,
  type AssessmentInput,
  type ControlKey,
  type FrameworkId,
  type ThirdPartyProvider,
  type Tri,
} from "@/lib/assessment/types";
import { CheckField, ChoiceList, SelectField, TextAreaField, TextField, TriQuestion } from "./fields";

export const STEPS = [
  { id: "application", label: "Application", title: "What are you building?", help: "A name and a plain description are enough to start.", anchor: "system" },
  { id: "data", label: "Data", title: "What data and decisions are involved?", help: "These answers decide which privacy and high-risk rules apply.", anchor: "system" },
  { id: "transparency", label: "Transparency", title: "Who meets the AI?", help: "Disclosure and labelling duties depend on how people encounter it.", anchor: "system" },
  { id: "providers", label: "Providers", title: "Which AI providers do you rely on?", help: "Add each third party whose model or API you use.", anchor: "providers" },
  { id: "controls", label: "Controls", title: "What do you already have in place?", help: "Be candid. \"Not sure\" is treated as unproven, never as a pass.", anchor: "findings" },
  { id: "frameworks", label: "Frameworks", title: "What should it be checked against?", help: "Findings appear in the document as you choose.", anchor: "findings" },
] as const;

export interface FormApi {
  input: AssessmentInput;
  set: <K extends keyof AssessmentInput>(key: K, value: AssessmentInput[K]) => void;
  setControl: (key: ControlKey, value: Tri) => void;
}

const FRAMEWORK_HINTS: Record<FrameworkId, string> = {
  "eu-ai-act": "Binding in the EU. Risk tiers, transparency and general-purpose model duties.",
  gdpr: "Binding in the EU. Personal data, automated decisions and AI providers as processors.",
  "nist-ai-rmf": "Voluntary US framework. Governance, mapping, measuring and managing AI risk.",
  "iso-42001": "Voluntary, certifiable. Cited by clause title only, since the text is paywalled.",
};

export function StepForm({ stepId, api }: { stepId: (typeof STEPS)[number]["id"]; api: FormApi }) {
  const { input, set, setControl } = api;

  const setProvider = (index: number, patch: Partial<ThirdPartyProvider>) =>
    set("providers", input.providers.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  switch (stepId) {
    case "application":
      return (
        <>
          <TextField label="Application name" value={input.appName} onChange={(e) => set("appName", e.target.value)} />
          <TextAreaField
            label="Purpose"
            hint="What does it do, and for whom?"
            value={input.purpose}
            onChange={(e) => set("purpose", e.target.value)}
          />
          <SelectField label="Use case" value={input.useCase} onChange={(v) => set("useCase", v)} options={USE_CASES} />
          <ChoiceList label="Your role" value={input.role} onChange={(v) => set("role", v)} options={ROLES} />
          <TriQuestion
            label="Is it sold or used in the EU, or does it affect people there?"
            value={input.euNexus}
            onChange={(v) => set("euNexus", v)}
          />
          <CheckField
            label="Prohibited practice"
            hint="Social scoring, emotion recognition at work or school, or untargeted scraping of faces."
            checked={input.prohibitedPractice}
            onChange={(v) => set("prohibitedPractice", v)}
          />
        </>
      );
    case "data":
      return (
        <>
          <TriQuestion label="Does it process personal data?" value={input.usesPersonalData} onChange={(v) => set("usesPersonalData", v)} />
          <TriQuestion
            label="Does it process special category data?"
            hint="Health, biometrics, ethnicity, beliefs and similar."
            value={input.usesSpecialCategoryData}
            onChange={(v) => set("usesSpecialCategoryData", v)}
          />
          <TriQuestion label="Do you train or improve models on user data?" value={input.trainsOnUserData} onChange={(v) => set("trainsOnUserData", v)} />
          <TriQuestion
            label="Does it make or drive decisions with significant effects on people?"
            hint="Legal effects, or similarly significant ones such as hiring or credit."
            value={input.automatedDecisions}
            onChange={(v) => set("automatedDecisions", v)}
          />
          <ChoiceList label="Human oversight" value={input.humanOversight} onChange={(v) => set("humanOversight", v)} options={OVERSIGHT} />
        </>
      );
    case "transparency":
      return (
        <>
          <TriQuestion
            label="Do people interact with it directly?"
            hint="A chatbot or assistant, for example."
            value={input.interactsWithPeople}
            onChange={(v) => set("interactsWithPeople", v)}
          />
          {input.interactsWithPeople === "yes" && (
            <TriQuestion label="Are they told it is AI?" value={input.disclosesAi} onChange={(v) => set("disclosesAi", v)} />
          )}
          <TriQuestion
            label="Does it generate synthetic text, images, audio or video?"
            value={input.generatesSyntheticContent}
            onChange={(v) => set("generatesSyntheticContent", v)}
          />
          {input.generatesSyntheticContent === "yes" && (
            <TriQuestion
              label="Are outputs marked as AI-generated in a machine-readable way?"
              value={input.marksOutputs}
              onChange={(v) => set("marksOutputs", v)}
            />
          )}
          <TriQuestion label="Do you provide a general-purpose AI model to others?" value={input.providesGpai} onChange={(v) => set("providesGpai", v)} />
        </>
      );
    case "providers":
      return (
        <>
          {input.providers.length === 0 && (
            <p className="rounded-md border border-dashed border-rule px-4 py-6 text-sm text-muted">
              No providers yet. Skip this step if you run every model yourself.
            </p>
          )}
          {input.providers.map((p, index) => (
            <div key={index} className="flex flex-col gap-4 rounded-md border border-rule bg-white p-4">
              <TextField label="Provider name" value={p.name} onChange={(e) => setProvider(index, { name: e.target.value })} />
              <TriQuestion
                label="Do they process personal data for you?"
                value={p.processesPersonalData}
                onChange={(v) => setProvider(index, { processesPersonalData: v })}
              />
              <TriQuestion label="Is a data processing agreement in place?" value={p.dpaInPlace} onChange={(v) => setProvider(index, { dpaInPlace: v })} />
              <TriQuestion label="Is data processed outside the EEA?" value={p.outsideEea} onChange={(v) => setProvider(index, { outsideEea: v })} />
              <TriQuestion
                label="Is there a transfer mechanism?"
                hint="An adequacy decision or standard contractual clauses."
                value={p.transferMechanism}
                onChange={(v) => setProvider(index, { transferMechanism: v })}
              />
              <button
                type="button"
                className="self-start text-sm font-medium text-gap underline underline-offset-2"
                onClick={() => set("providers", input.providers.filter((_, i) => i !== index))}
              >
                Remove provider
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-start rounded-md border border-cobalt px-4 py-2 text-sm font-medium text-cobalt hover:bg-cobalt-soft"
            onClick={() => set("providers", [...input.providers, emptyProvider()])}
          >
            Add provider
          </button>
        </>
      );
    case "controls":
      return (
        <>
          {CONTROL_QUESTIONS.map(({ key, label }) => (
            <TriQuestion key={key} label={label} value={input.controls[key]} onChange={(v) => setControl(key, v)} />
          ))}
        </>
      );
    case "frameworks":
      return (
        <>
          {(Object.keys(FRAMEWORK_LABELS) as FrameworkId[]).map((id) => (
            <CheckField
              key={id}
              label={FRAMEWORK_LABELS[id]}
              hint={FRAMEWORK_HINTS[id]}
              checked={input.frameworks.includes(id)}
              onChange={(on) => set("frameworks", on ? [...input.frameworks, id] : input.frameworks.filter((f) => f !== id))}
            />
          ))}
        </>
      );
  }
}
