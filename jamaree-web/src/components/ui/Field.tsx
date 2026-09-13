import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

const BOX =
  "w-full rounded-btn border border-line bg-card px-3 py-2 text-sm text-ink " +
  "placeholder:text-muted/70 focus:border-accent focus:outline-none disabled:bg-paper";

interface FieldProps {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}

/** ป้ายชื่อ + ช่องกรอก — ผูก label กับ input ให้อัตโนมัติ */
export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${BOX} ${className}`} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${BOX} ${className}`}>
      {children}
    </select>
  );
}

export function TextArea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${BOX} ${className}`} />;
}
