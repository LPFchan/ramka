/**
 * Parody of Apple's environment banner ("Apple 2030. Carbon neutral by
 * 2030."). The green accent and earnest eyebrow are the reference; the copy
 * is played completely straight, which is where the joke lives.
 */
export function EnvironmentBanner() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-24 md:pb-32">
      <div className="rounded-3xl bg-neutral-100 px-6 py-16 text-center md:py-20 dark:bg-neutral-900">
        <p className="text-sm font-medium text-green-600 dark:text-green-500">
          ramka and the environment
        </p>
        <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl dark:text-neutral-50">
          Scroll&#8209;hijacking neutral by&nbsp;2030.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-neutral-500 dark:text-neutral-400">
          ramka has been scroll&#8209;hijacking free since the first commit.
          The 2030 target is for everyone else.
        </p>
      </div>
    </section>
  );
}
