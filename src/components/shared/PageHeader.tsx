import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({ title, description, breadcrumbs, actions, backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 sm:mb-8 pb-4 border-b border-border/60">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel ?? 'Go back'}
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center space-x-1 text-xs text-muted-foreground mb-2 overflow-x-auto whitespace-nowrap pb-1">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                  {item.href ? (
                    <Link href={item.href} className="hover:text-foreground transition-colors shrink-0">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium shrink-0">{item.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-foreground break-words">{title}</h1>
          {description && (
            typeof description === 'string'
              ? <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">{description}</p>
              : <div className="mt-1 max-w-2xl text-xs sm:text-sm">{description}</div>
          )}
        </div>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto justify-start sm:justify-end">{actions}</div>}
    </div>
  );
}

