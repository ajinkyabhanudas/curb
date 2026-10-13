import type { ReactNode } from "react";
import type { Tri } from "@/lib/assessment/types";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputClass} rows={3} />;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  hint,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

export function TriSelect({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: Tri;
  onChange: (v: Tri) => void;
}) {
  return <Select label={label} hint={hint} value={value} onChange={onChange} options={TRI_OPTIONS} />;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <legend className="px-2 text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}
