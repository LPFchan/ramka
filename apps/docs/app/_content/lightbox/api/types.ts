export type PropRow = {
  name: string;
  type: string;
  default?: string;
  description: string;
  required?: boolean;
};

export type AttrRow = {
  name: string;
  description: string;
};

export type CssVarRow = {
  name: string;
  type?: string;
  description: string;
};

export type ApiPart = {
  id: string;
  name: string;
  description: string;
  props?: PropRow[];
  attributes?: AttrRow[];
  cssVariables?: CssVarRow[];
};
