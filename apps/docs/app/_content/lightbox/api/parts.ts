import { generatedProps } from './generated';
import {
  documentViewTransitionMeta,
  hooksApiMeta,
  imperativeApiMeta,
  lightboxApiMeta,
  type ApiPartMeta,
} from './meta';
import type { ApiPart, PropRow } from './types';

function toApiPart(meta: ApiPartMeta): ApiPart {
  const props = generatedProps[meta.id] as PropRow[] | undefined;
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    ...(props && props.length > 0 ? { props: [...props] } : null),
    ...(meta.attributes ? { attributes: meta.attributes } : null),
    ...(meta.cssVariables ? { cssVariables: meta.cssVariables } : null),
  };
}

export const lightboxApiParts: ApiPart[] = lightboxApiMeta.map(toApiPart);

export const documentViewTransitionApi: ApiPart = toApiPart(documentViewTransitionMeta);

export const hooksApi: ApiPart[] = hooksApiMeta.map(toApiPart);

export const imperativeApi: ApiPart[] = imperativeApiMeta.map(toApiPart);
