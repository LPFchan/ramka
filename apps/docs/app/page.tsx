import Link from 'next/link';
import { exampleGroups } from './_components/examples';

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Documentation</p>
      <h1 className="mt-2 text-5xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        ramka
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
        Unstyled, accessible lightbox primitives — in the style of Radix UI and Base UI. Compose any lightbox UI on top
        of the same headless components, with a built-in swipeable <code>Lightbox.Slides</code> carousel, view-transition
        morph, zoom, and pull-to-dismiss.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Installation</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          <code>pnpm add ramka</code>
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Quick start</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {`import { Lightbox } from 'ramka';

<Lightbox.Root viewTransition>
  {items.map((item, i) => (
    <Lightbox.Trigger key={item.id} index={i}>
      <img src={item.thumb} alt={item.alt} />
    </Lightbox.Trigger>
  ))}

  <Lightbox.Backdrop />
  <Lightbox.Content>
    <Lightbox.Slides>
      {items.map((item, i) => (
        <Lightbox.Slide key={item.id}>
          <Lightbox.Item index={i}>
            <img src={item.src} alt={item.alt} />
          </Lightbox.Item>
        </Lightbox.Slide>
      ))}
    </Lightbox.Slides>
  </Lightbox.Content>
</Lightbox.Root>`}
        </pre>
      </section>

      {exampleGroups.map((group) => (
        <section key={group.group} className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">{group.group} examples</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.links.map((ex) => (
              <li key={ex.slug}>
                <Link
                  href={`${group.basePath}/${ex.slug}`}
                  className="block h-full rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  <div className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{ex.title}</div>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{ex.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
