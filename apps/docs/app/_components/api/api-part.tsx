import { AttributesTable } from './attributes-table';
import { CssVariablesTable } from './css-variables-table';
import { PropsTable } from './props-table';
import type { ApiPart } from '../../_content/lightbox/api/types';
import { DocsSection } from '../docs-shell';

export function ApiPartSection({ part }: { part: ApiPart }) {
  return (
    <DocsSection id={part.id} title={part.name} level={3}>
      <p>{part.description}</p>
      {part.props ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Props
          </h4>
          <PropsTable props={part.props} partId={part.id} />
        </div>
      ) : null}
      {part.attributes && part.attributes.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Data attributes
          </h4>
          <AttributesTable attributes={part.attributes} />
        </div>
      ) : null}
      {part.cssVariables && part.cssVariables.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            CSS variables
          </h4>
          <CssVariablesTable variables={part.cssVariables} />
        </div>
      ) : null}
    </DocsSection>
  );
}
