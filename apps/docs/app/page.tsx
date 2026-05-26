import Link from 'next/link';
import { exampleGroups } from './_components/examples';

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Documentation</p>
      <h1 className="mt-2 text-5xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        react-image-gallery
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
        Unstyled, accessible primitives for image galleries, carousels, and lightboxes — in the style of Radix UI and
        Base UI. Compose any UI on top of the same headless components.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Installation</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          <code>pnpm add react-image-gallery</code>
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Quick start</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {`import { ScrollGallery, Lightbox } from 'react-image-gallery';

<ScrollGallery.Root>
  <ScrollGallery.Viewport style={{ display: 'flex', overflowX: 'auto' }}>
    {items.map((item) => (
      <ScrollGallery.Item key={item.id} style={{ flexShrink: 0 }}>
        {/* your content */}
      </ScrollGallery.Item>
    ))}
  </ScrollGallery.Viewport>
  <ScrollGallery.Previous>Prev</ScrollGallery.Previous>
  <ScrollGallery.Next>Next</ScrollGallery.Next>
</ScrollGallery.Root>`}
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
