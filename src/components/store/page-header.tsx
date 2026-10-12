import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/shared/breadcrumbs";

export function PageHeader({ eyebrow, title, description, breadcrumbs, children }: { eyebrow?: string; title: string; description?: string; breadcrumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="bg-hero border-b">
      <div className="container-page space-y-4 py-10 sm:py-14">
        <Breadcrumbs items={breadcrumbs} />
        <div className="max-w-3xl space-y-3">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-brand-ink sm:text-5xl">{title}</h1>
          {description ? <p className="text-lg text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
