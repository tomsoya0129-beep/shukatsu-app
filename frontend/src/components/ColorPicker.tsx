import { COMPANY_COLORS } from "../lib/constants";
import { cls } from "../lib/utils";

interface Props {
  value: string;
  onChange: (c: string) => void;
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {COMPANY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange(c);
          }}
          className={cls(
            "w-9 h-9 rounded-full border-2 transition",
            value === c
              ? "border-slate-900 ring-2 ring-slate-900 ring-offset-2"
              : "border-white shadow hover:border-slate-300"
          )}
          style={{ background: c }}
          aria-label={c}
          aria-pressed={value === c}
        />
      ))}
    </div>
  );
}
