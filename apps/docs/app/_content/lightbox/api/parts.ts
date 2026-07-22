import {
  generatedAttributes,
  generatedCssVariables,
  generatedProps,
} from './generated';
import {
  documentViewTransitionMeta,
  hooksApiMeta,
  imperativeApiMeta,
  lightboxApiMeta,
  type ApiPartMeta,
} from './meta';
import type { ApiPart, AttrRow, CssVarRow, PropRow } from './types';

function toApiPart(meta: ApiPartMeta): ApiPart {
  const props = generatedProps[meta.id] as PropRow[] | undefined;
  const attributes = generatedAttributes[meta.id] as AttrRow[] | undefined;
  const cssVariables = generatedCssVariables[meta.id] as CssVarRow[] | undefined;
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    ...(props && props.length > 0 ? { props: [...props] } : null),
    ...(attributes && attributes.length > 0 ? { attributes: [...attributes] } : null),
    ...(cssVariables && cssVariables.length > 0 ? { cssVariables: [...cssVariables] } : null),
  };
}

export const lightboxApiParts: ApiPart[] = lightboxApiMeta.map(toApiPart);

export const documentViewTransitionApi: ApiPart = toApiPart(documentViewTransitionMeta);

export const hooksApi: ApiPart[] = hooksApiMeta.map(toApiPart);

export const imperativeApi: ApiPart[] = imperativeApiMeta.map(toApiPart);
