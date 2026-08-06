'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import { CreditCardIcon, SparklesIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const inputClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** Stretches the morph 5× via `--ramka-dialog-morph-duration` on `:root`,
 * the hook's public theming var — handy for studying the transition. */
function SlowMoToggle() {
  const [slowMo, setSlowMo] = React.useState(false);

  React.useEffect(() => {
    const docEl = document.documentElement;
    if (slowMo) docEl.style.setProperty('--ramka-dialog-morph-duration', '1600ms');
    else docEl.style.removeProperty('--ramka-dialog-morph-duration');
    return () => {
      docEl.style.removeProperty('--ramka-dialog-morph-duration');
    };
  }, [slowMo]);

  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs font-medium text-amber-700 select-none dark:text-amber-400">
      <input
        type="checkbox"
        checked={slowMo}
        onChange={(event) => setSlowMo(event.target.checked)}
      />
      Slow motion (1600ms)
    </label>
  );
}

/**
 * Dev-only: `useDialogMorph` (exported from ramka) baked into the local
 * shadcn/Base UI dialog behind an opt-in `morph` prop. No changes at usage
 * sites beyond `<Dialog morph>` — the trigger morphs into the panel on open
 * and back on close via the View Transitions API.
 */
export default function MorphShadcnDialogDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Morph shadcn dialog
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          <code className="text-sm">useDialogMorph</code> is a standalone ramka primitive — no
          Lightbox, no index tracking, no zoom. It is wired once inside{' '}
          <code className="text-sm">components/ui/dialog.tsx</code> (root state + trigger{' '}
          <code className="text-sm">sourceRef</code> + popup <code className="text-sm">targetRef</code>
          ), and every usage site opts in with <code className="text-sm">{'<Dialog morph>'}</code>.
        </p>
      </header>

      <SlowMoToggle />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">What to verify</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          <li>Trigger morphs into the panel on open, panel morphs back on close (Escape, backdrop, buttons)</li>
          <li>The trigger is hidden while its dialog is open (no double vision behind the panel)</li>
          <li>
            The pill trigger&apos;s <code className="text-xs">rounded-full</code> radius interpolates
            smoothly (no jump from <code className="text-xs">calc(infinity*1px)</code>)
          </li>
          <li>The dialog&apos;s own zoom/fade animations are suppressed only while morphing — the non-morph control keeps them</li>
          <li>Reduced motion / unsupported browsers fall back to the plain dialog animations</li>
        </ul>
      </section>

      <section className="flex flex-col gap-8">
        <Demo label="Button trigger" hint="<Dialog morph> — a standard outline button morphs into a form dialog.">
          <EditProfileDialog morph />
        </Demo>

        <Demo
          label="Pill trigger (rounded-full)"
          hint="Radius interpolation: the pill's infinite radius resolves to px and animates to the panel's rounded-xl."
        >
          <UpgradePillDialog />
        </Demo>

        <Demo label="Card trigger" hint="A whole settings row is the trigger — larger source boxes morph too.">
          <PaymentCardDialog />
        </Demo>

        <Demo label="Control — no morph" hint="Same dialog without the prop: shadcn's default zoom/fade animations.">
          <EditProfileDialog morph={false} />
        </Demo>
      </section>
    </div>
  );
}

function Demo({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium tracking-wide text-neutral-500 uppercase">{label}</p>
      <p className="mb-3 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">{hint}</p>
      {children}
    </div>
  );
}

/* ── 1 + 4. Button trigger (morph and control) ──────────────────────────── */

function EditProfileDialog({ morph }: { morph: boolean }) {
  return (
    <Dialog morph={morph}>
      <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`name-${morph}`}>Name</Label>
            <input id={`name-${morph}`} className={inputClass} defaultValue="Maya Chen" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`username-${morph}`}>Username</Label>
            <input id={`username-${morph}`} className={inputClass} defaultValue="@maya" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Save changes</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── 2. Pill trigger — rounded-full radius interpolation ────────────────── */

function UpgradePillDialog() {
  return (
    <Dialog morph>
      <DialogTrigger className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 py-2 pr-4 pl-3 text-sm font-medium text-white shadow-md transition-shadow outline-none select-none hover:shadow-lg focus-visible:ring-3 focus-visible:ring-indigo-400/60">
        <SparklesIcon className="size-4" aria-hidden />
        Upgrade to Pro
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>
            Unlimited projects, priority support, and early access to new features.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2 text-sm">
          {['Unlimited projects', 'Priority support', 'Early access to new features'].map(
            (feature) => (
              <li key={feature} className="flex items-center gap-2">
                <SparklesIcon className="size-3.5 text-indigo-500" aria-hidden />
                {feature}
              </li>
            ),
          )}
        </ul>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Not now</DialogClose>
          <DialogClose render={<Button />}>Upgrade — $12/mo</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── 3. Card trigger ────────────────────────────────────────────────────── */

function PaymentCardDialog() {
  return (
    <Dialog morph>
      <DialogTrigger className="flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <CreditCardIcon className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Payment method</span>
          <span className="block truncate text-xs text-muted-foreground">
            Mastercard ending in 4242
          </span>
        </span>
        <span className="text-xs text-muted-foreground">Manage</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment method</DialogTitle>
          <DialogDescription>Used for purchases and subscriptions.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-name">Name on card</Label>
            <input id="card-name" className={inputClass} defaultValue="Maya Chen" />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="card-expiry">Expiry</Label>
              <input id="card-expiry" className={inputClass} defaultValue="12 / 28" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="card-cvc">CVC</Label>
              <input id="card-cvc" className={inputClass} placeholder="•••" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
