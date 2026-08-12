'use client';

import * as React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ComponentPreview } from './component-preview';
import type { SourceFile } from './read-source-files';

export type PresetVariantOption = {
  id: string;
  /** Toggle label, e.g. "Tailwind" or "CSS". */
  label: string;
  /** Source files for this variant's source card. */
  files: SourceFile[];
  /** Live demo rendered with this variant's skin. */
  children: React.ReactNode;
};

/**
 * Styling-variant switcher for preset pages: one tab per skin flavor
 * (Tailwind / CSS), each with its own live demo and source card. Inactive
 * variants unmount, so only one lightbox instance exists at a time and the
 * two skins never coexist in the DOM.
 */
export function PresetVariantPreview({
  variants,
  frame = false,
}: {
  variants: PresetVariantOption[];
  frame?: boolean;
}) {
  return (
    <Tabs defaultValue={variants[0]?.id}>
      <TabsList>
        {variants.map((variant) => (
          <TabsTrigger key={variant.id} value={variant.id} className="px-3 text-xs">
            {variant.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {variants.map((variant) => (
        <TabsContent key={variant.id} value={variant.id}>
          <ComponentPreview files={variant.files} frame={frame}>
            {variant.children}
          </ComponentPreview>
        </TabsContent>
      ))}
    </Tabs>
  );
}
