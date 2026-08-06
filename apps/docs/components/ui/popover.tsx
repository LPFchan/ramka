"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { useDialogMorph, type DialogMorph } from "ramka"

import { cn } from "@/lib/utils"

/**
 * Optional ramka view-transition morph, baked in behind the `morph` prop:
 * `<Popover morph>` makes the trigger morph into the panel (and back on
 * close). Same hook as Dialog — the context below carries its refs to
 * PopoverTrigger (morph source) and the Popup (morph target). With `morph`
 * off (default) the hook is an inert passthrough and nothing changes.
 */
const PopoverMorphContext = React.createContext<DialogMorph | null>(null)

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined | null>
): React.RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value)
      else if (ref) (ref as React.MutableRefObject<T | null>).current = value
    }
  }
}

function Popover({
  morph = false,
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: PopoverPrimitive.Root.Props & { morph?: boolean }) {
  const popoverMorph = useDialogMorph({
    enabled: morph,
    open,
    defaultOpen,
    onOpenChange,
  })
  return (
    <PopoverMorphContext.Provider value={morph ? popoverMorph : null}>
      <PopoverPrimitive.Root
        data-slot="popover"
        open={popoverMorph.open}
        onOpenChange={popoverMorph.onOpenChange}
        {...props}
      />
    </PopoverMorphContext.Provider>
  )
}

function PopoverTrigger({ ref, ...props }: PopoverPrimitive.Trigger.Props) {
  const morph = React.useContext(PopoverMorphContext)
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      ref={morph ? mergeRefs(ref, morph.sourceRef) : ref}
      {...props}
    />
  )
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ref,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const morph = React.useContext(PopoverMorphContext)
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          ref={morph ? mergeRefs(ref, morph.targetRef) : ref}
          className={cn(
            "z-50 flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
