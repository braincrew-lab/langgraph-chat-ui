import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  trailing,
  children,
}: AdminPageHeaderProps) {
  return (
    <section className="border-border/70 bg-card/75 rounded-xl border px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          {eyebrow && (
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
        {trailing && (
          <div className="text-muted-foreground text-sm">{trailing}</div>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}
