import clsx from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-ink bg-ink px-3 py-2 text-sm font-semibold text-white shadow-subtle transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function GhostButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink shadow-subtle transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx("h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-moss", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx("h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-moss", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx("min-h-20 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss", props.className)} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-saffron/40 bg-[#fff7df] px-4 py-3 text-sm text-ink">{children}</div>;
}
