import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { TRI_OPTIONS } from "@/lib/assessment/options";
import type { Tri } from "@/lib/assessment/types";

const control =
  "w-full rounded-md border border-rule bg-white px-3 py-2 text-[15px] text-ink placeholder:text-faint";

export function Question({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-[15px] font-medium leading-snug">{label}</legend>
      {hint && <p className="-mt-1 text-sm text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

export function Segmented<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  const name = useId();
  return (
    <Question label={label} hint={hint}>
      <div className="inline-flex w-fit overflow-hidden rounded-md border border-rule bg-white">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer border-r border-rule last:border-r-0">
            <input
              type="radio"
              className="peer sr-only"
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span className="block px-4 py-2 text-sm text-muted peer-checked:bg-cobalt peer-checked:font-medium peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-cobalt">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </Question>
  );
}

export const TriQuestion = ({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: Tri;
  onChange: (value: Tri) => void;
}) => <Segmented label={label} hint={hint} value={value} onChange={onChange} options={TRI_OPTIONS} />;

export function ChoiceList<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  const name = useId();
  return (
    <Question label={label}>
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              className="peer sr-only"
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span className="flex flex-col rounded-md border border-rule bg-white px-3 py-2 peer-checked:border-cobalt peer-checked:bg-cobalt-soft peer-focus-visible:outline-2 peer-focus-visible:outline-cobalt">
              <span className="text-[15px] font-medium">{o.label}</span>
              {o.hint && <span className="text-sm text-muted">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </Question>
  );
}

export function TextField({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[15px] font-medium">{label}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
      <input {...props} className={control} />
    </label>
  );
}

export function TextAreaField({ label, hint, ...props }: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[15px] font-medium">{label}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
      <textarea {...props} rows={4} className={control} />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[15px] font-medium">{label}</span>
      <select className={control} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-white px-3 py-2.5">
      <input type="checkbox" className="mt-1 size-4 accent-cobalt" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col">
        <span className="text-[15px] font-medium">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}
