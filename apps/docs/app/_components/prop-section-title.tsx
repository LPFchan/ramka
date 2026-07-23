import { DocsLink } from './docs-link';

/** Section heading like “Trigger crossfade” with the part name linking to the API. */
export function PropSectionTitle({
  partHref,
  part,
  prop,
  sectionId,
}: {
  partHref: string;
  part: string;
  prop: string;
  sectionId: string;
}) {
  return (
    <>
      <DocsLink href={partHref}>{part}</DocsLink>{' '}
      <a href={`#${sectionId}`} className="hover:underline">
        {prop}
      </a>
    </>
  );
}
