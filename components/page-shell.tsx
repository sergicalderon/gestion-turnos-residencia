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
      <header className="flex flex-col gap-4 border-b border-line bg-white px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-moss">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="px-4 py-5 md:px-6">{children}</div>
    </section>
  );
}
