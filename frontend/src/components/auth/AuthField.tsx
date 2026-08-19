"use client";

interface Props {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
}

/* Minimal dark auth input — underlined, warm-orange focus. */
export default function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
}: Props) {
  return (
    <div className="auth-reveal space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-wider"
        style={{ color: "var(--faint)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[48px] w-full border-b-2 bg-transparent py-2 text-base outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--blood)]"
        style={{ borderColor: "var(--edge)", color: "var(--chalk)" }}
      />
    </div>
  );
}
