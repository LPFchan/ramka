'use client';

import * as React from 'react';
import { ChevronDown, HelpCircle, Info, MoreHorizontal, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type OverlayTestPanelProps = {
  slideIndex: number;
  slideCount: number;
};

/**
 * Shadcn / Base UI overlays rendered inside an open lightbox — use this panel
 * to exercise focus traps, portal stacking, and pointer events against ramka.
 */
export function OverlayTestPanel({ slideIndex, slideCount }: OverlayTestPanelProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [nestedOpen, setNestedOpen] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);
  const [lastAction, setLastAction] = React.useState('Idle');

  const noteAction = React.useCallback((action: string) => {
    setLastAction(action);
  }, []);

  const statusLabel =
    lastAction === 'Idle'
      ? `Slide ${slideIndex + 1}/${slideCount}`
      : `${lastAction} · slide ${slideIndex + 1}/${slideCount}`;

  return (
    <TooltipProvider delay={200}>
      <div
        className="pointer-events-auto absolute left-1/2 top-[calc(0.75rem+env(safe-area-inset-top,0))] z-40 flex max-w-[min(100%-1.5rem,42rem)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-white/20 bg-black/45 p-3 text-white shadow-lg backdrop-blur-xl backdrop-saturate-150"
        data-testid="overlay-test-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-white/80 uppercase">
            Base UI inside lightbox
          </p>
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
            {statusLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="secondary"
                  size="sm"
                  className="border-white/15 bg-white/15 text-white hover:bg-white/25"
                />
              }
            >
              <Info data-icon="inline-start" />
              Tooltip
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-left">
              Tooltip portaled above the lightbox. Swipe slides and confirm it dismisses.
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="secondary"
                  size="sm"
                  className="border-white/15 bg-white/15 text-white hover:bg-white/25"
                />
              }
            >
              <MoreHorizontal data-icon="inline-start" />
              Menu
              <ChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Slide actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => noteAction('Download')}>
                  Download original
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => noteAction('Share link')}>
                  Copy share link
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={showGrid}
                onCheckedChange={(checked) => {
                  setShowGrid(checked === true);
                  noteAction(checked ? 'Grid on' : 'Grid off');
                }}
              >
                Show alignment grid
              </DropdownMenuCheckboxItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger inset>More options</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => noteAction('Set cover')}>
                    Set as cover
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => noteAction('Hide slide')}>
                    Hide from album
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="secondary"
                  size="sm"
                  className="border-white/15 bg-white/15 text-white hover:bg-white/25"
                />
              }
            >
              <Settings2 data-icon="inline-start" />
              Dialog
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nested dialog (slide {slideIndex + 1})</DialogTitle>
                <DialogDescription>
                  Modal inside the lightbox modal. Tab should stay trapped here until
                  closed; Escape should dismiss this dialog first, then the lightbox.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="mt-0.5 shrink-0"
                          aria-label="About dialog tooltips"
                        />
                      }
                    >
                      <HelpCircle />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-left">
                      Tooltip inside a nested dialog. Escape should dismiss this tooltip
                      before the dialog, and the dialog before the lightbox.
                    </TooltipContent>
                  </Tooltip>
                  <p className="text-muted-foreground">
                    Hover the help icon to open a tooltip portaled above this dialog.
                  </p>
                </div>
                <p>
                  Open a second dialog to test stacked focus management and backdrop
                  layering.
                </p>
                <Dialog open={nestedOpen} onOpenChange={setNestedOpen}>
                  <DialogTrigger render={<Button variant="outline" size="sm" />}>
                    Open nested dialog
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Nested level 2</DialogTitle>
                      <DialogDescription>
                        Third modal layer — verify z-index and return focus.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter showCloseButton>
                      <Button
                        size="sm"
                        onClick={() => {
                          setNestedOpen(false);
                          noteAction('Nested dialog closed');
                        }}
                      >
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <DialogFooter showCloseButton>
                <Button
                  size="sm"
                  onClick={() => {
                    setDialogOpen(false);
                    noteAction('Dialog closed');
                  }}
                >
                  Save metadata
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {showGrid ? (
          <p className="text-[11px] leading-relaxed text-white/60">
            Checklist: open each overlay, arrow/swipe between slides, pinch-zoom, press
            Escape repeatedly, click backdrop, and tab through controls.
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
