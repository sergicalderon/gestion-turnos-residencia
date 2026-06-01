import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <section className="min-h-screen">
      <header className="flex flex-col gap-3 border-b border-line bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-moss">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center justify-start gap-1.5 md:justify-end">{actions}</div> : null}
      </header>
      <div className="px-4 py-4 md:px-5">{children}</div>
    </section>
  );
}
