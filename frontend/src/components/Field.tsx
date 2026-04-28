import { ReactNode } from "react";

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}

export default function Field({
  label,
  children,
  hint,
  required,
  className,
}: FieldProps) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
