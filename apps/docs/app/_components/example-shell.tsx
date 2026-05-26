import * as React from 'react';

interface ExampleShellProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}

export function ExampleShell({ title, description, children }: ExampleShellProps) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{title}</h1>
        {description ? (
          <div className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {description}
          </div>
        ) : null}
      </header>
      <div>{children}</div>
    </div>
  );
}
