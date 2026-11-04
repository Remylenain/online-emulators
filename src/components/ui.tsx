import type { ComponentProps, ReactNode } from "react";

/** Petites briques d'interface partagées, pour que les formulaires se ressemblent. */

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-panel border border-ink-800 bg-ink-900/70 p-6 shadow-lg shadow-black/30 ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-200">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-400">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-ink-50 " +
        "placeholder:text-ink-700 focus:border-accent-500 focus:ring-2 focus:ring-accent-600/30 " +
        `focus:outline-none ${className}`
      }
    />
  );
}

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "ghost" }) {
  const styles =
    variant === "primary"
      ? "bg-accent-600 text-ink-950 hover:bg-accent-500 disabled:bg-ink-800 disabled:text-ink-400"
      : "border border-ink-700 text-ink-200 hover:border-ink-400 hover:text-ink-50";

  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold " +
        `transition-colors disabled:cursor-not-allowed ${styles} ${className}`
      }
    />
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success";
  children: ReactNode;
}) {
  const tones = {
    error: "border-red-900/70 bg-red-950/40 text-red-200",
    info: "border-ink-700 bg-ink-800/50 text-ink-200",
    success: "border-accent-600/50 bg-accent-600/10 text-accent-400",
  } as const;

  return (
    <div role="status" className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
