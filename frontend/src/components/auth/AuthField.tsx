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
        style={{ color: "var(--text-faint)" }}
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
        className="w-full border-b border-white/15 bg-transparent py-2 text-base outline-none transition-colors placeholder:text-white/25 focus:border-[var(--cta-primary)]"
        style={{ color: "var(--text-primary)" }}
      />
    </div>
  );
}
