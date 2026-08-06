'use client';

import { notFound } from 'next/navigation';
import * as React from 'react';
import {
  CheckIcon,
  CopyIcon,
  CreditCardIcon,
  InfoIcon,
  LinkIcon,
  MailIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  ShareIcon,
  SparklesIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

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
 * shadcn/Base UI dialog + popover behind an opt-in `morph` prop. No changes
 * at usage sites beyond `<Dialog morph>` / `<Popover morph>` — the trigger
 * morphs into the panel on open and back on close via the View Transitions API.
 */
export default function MorphShadcnDialogDebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-400">
          Debug · development only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Morph shadcn dialog &amp; popover
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          <code className="text-sm">useDialogMorph</code> is a standalone ramka primitive — no
          Lightbox, no index tracking, no zoom. Wired once into{' '}
          <code className="text-sm">dialog.tsx</code> and <code className="text-sm">popover.tsx</code>{' '}
          (root state + trigger <code className="text-sm">sourceRef</code> + popup{' '}
          <code className="text-sm">targetRef</code>). Opt in with{' '}
          <code className="text-sm">{'<Dialog morph>'}</code> or{' '}
          <code className="text-sm">{'<Popover morph>'}</code>.
        </p>
      </header>

      <SlowMoToggle />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">What to verify</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
          <li>Trigger morphs into the panel on open, panel morphs back on close</li>
          <li>The trigger is hidden while open (no double vision behind the panel)</li>
          <li>
            Pill / chip radii interpolate smoothly (no jump from{' '}
            <code className="text-xs">calc(infinity*1px)</code>)
          </li>
          <li>Default zoom/fade animations are suppressed only while morphing</li>
          <li>Popovers morph without a backdrop — same hook, no overlay required</li>
        </ul>
      </section>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-8">
        <SectionTitle
          eyebrow="Dialog"
          title="Modal panels"
          hint="Centered dialogs with backdrop. Trigger → panel → trigger."
        />

        <Demo label="Button trigger" hint="<Dialog morph> — outline button → form dialog.">
          <EditProfileDialog morph />
        </Demo>

        <Demo
          label="Pill trigger (rounded-full)"
          hint="Radius interpolation: pill → rounded-xl panel."
        >
          <UpgradePillDialog />
        </Demo>

        <Demo label="Card trigger" hint="A whole settings row is the morph source.">
          <PaymentCardDialog />
        </Demo>

        <Demo label="Control — no morph" hint="Same dialog without the prop: default zoom/fade.">
          <EditProfileDialog morph={false} />
        </Demo>
      </section>

      {/* ── Popovers ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-8">
        <SectionTitle
          eyebrow="Popover"
          title="Anchored panels"
          hint="Lightweight, positioned near the trigger. Same morph hook — no backdrop."
        />

        <Demo label="Share sheet" hint="Toolbar button → share actions. Classic iOS pattern.">
          <SharePopover />
        </Demo>

        <Demo label="Profile chip" hint="Avatar status pill → quick look card.">
          <ProfileChipPopover />
        </Demo>

        <Demo label="Info tip" hint="Circle-i control → contextual help.">
          <InfoTipPopover />
        </Demo>

        <Demo label="Filter chip" hint="Segmented chip → filter options list.">
          <FilterChipPopover />
        </Demo>

        <Demo label="Overflow menu" hint="⋯ control → compact action menu.">
          <OverflowMenuPopover />
        </Demo>

        <Demo label="Control — no morph" hint="Share sheet without morph: default zoom/fade.">
          <SharePopover morph={false} />
        </Demo>
      </section>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="border-b border-border/60 pb-4">
      <p className="text-[11px] font-semibold tracking-widest text-neutral-400 uppercase">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        {title}
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>
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

/* ── Dialog demos ─────────────────────────────────────────────────────────── */

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

/* ── Popover demos ────────────────────────────────────────────────────────── */

function SharePopover({ morph = true }: { morph?: boolean }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <Popover morph={morph}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label="Share"
          />
        }
      >
        <ShareIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-56 gap-1 rounded-2xl p-1.5" sideOffset={8}>
        <PopoverHeader className="px-2.5 pt-1.5 pb-1">
          <PopoverTitle className="text-[13px]">Share</PopoverTitle>
          <PopoverDescription className="text-xs">Send this page</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col">
          <ShareRow icon={<MessageCircleIcon className="size-4" />} label="Messages" />
          <ShareRow icon={<MailIcon className="size-4" />} label="Mail" />
          <ShareRow
            icon={copied ? <CheckIcon className="size-4" /> : <LinkIcon className="size-4" />}
            label={copied ? 'Copied' : 'Copy Link'}
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          />
          <ShareRow icon={<CopyIcon className="size-4" />} label="Copy" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ShareRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground">
        {icon}
      </span>
      {label}
    </button>
  );
}

function ProfileChipPopover() {
  return (
    <Popover morph>
      <PopoverTrigger className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background py-1 pr-3 pl-1 text-left outline-none transition-colors select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <Avatar size="sm">
          <AvatarImage src="https://github.com/shadcn.png" alt="Maya Chen" />
          <AvatarFallback>MC</AvatarFallback>
        </Avatar>
        <span className="flex flex-col leading-none">
          <span className="text-[13px] font-medium">Maya Chen</span>
          <span className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">Active</span>
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-64 gap-3 rounded-2xl p-3" sideOffset={8}>
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarImage src="https://github.com/shadcn.png" alt="Maya Chen" />
            <AvatarFallback>MC</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Maya Chen</p>
            <p className="truncate text-xs text-muted-foreground">@maya · Product Design</p>
            <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              Active now
            </p>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Designing systems that feel inevitable. Currently shipping Ramka morphs.
        </p>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 rounded-full">
            Message
          </Button>
          <Button size="sm" variant="outline" className="flex-1 rounded-full">
            Profile
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InfoTipPopover() {
  return (
    <div className="flex max-w-sm items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
      <span>iCloud Private Relay</span>
      <Popover morph>
        <PopoverTrigger
          className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full bg-neutral-200 text-neutral-600 outline-none transition-colors hover:bg-neutral-300 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
          aria-label="About Private Relay"
        >
          <InfoIcon className="size-3" />
        </PopoverTrigger>
        <PopoverContent className="w-64 gap-1.5 rounded-2xl p-3.5" side="top" sideOffset={8}>
          <PopoverHeader>
            <PopoverTitle className="text-[13px]">Private Relay</PopoverTitle>
            <PopoverDescription className="text-[13px] leading-relaxed">
              Hides your IP address and protects your unencrypted traffic so websites and
              network providers can&apos;t see who you are or what you&apos;re browsing.
            </PopoverDescription>
          </PopoverHeader>
          <button
            type="button"
            className="mt-1 w-fit cursor-pointer text-[13px] font-medium text-blue-600 outline-none hover:underline dark:text-blue-400"
          >
            Learn More…
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterChipPopover() {
  const [sort, setSort] = React.useState('Recently Added');
  const options = ['Recently Added', 'Name', 'Date Modified', 'Size'] as const;

  return (
    <Popover morph>
      <PopoverTrigger className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[13px] font-medium outline-none transition-colors select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        {sort}
        <span className="text-muted-foreground" aria-hidden>
          ▾
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-48 gap-0.5 rounded-2xl p-1.5" align="start" sideOffset={8}>
        <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Sort By
        </p>
        {options.map((option) => {
          const selected = option === sort;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
            >
              {option}
              {selected ? <CheckIcon className="size-3.5 text-blue-600 dark:text-blue-400" /> : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function OverflowMenuPopover() {
  return (
    <div className="flex w-full max-w-sm items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">Summer playlist</p>
        <p className="truncate text-xs text-muted-foreground">24 songs · Updated yesterday</p>
      </div>
      <Popover morph>
        <PopoverTrigger
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="More actions"
        >
          <MoreHorizontalIcon className="size-4" />
        </PopoverTrigger>
        <PopoverContent className="w-44 gap-0.5 rounded-2xl p-1.5" align="end" sideOffset={8}>
          {['Add to Library', 'Share Playlist', 'Edit', 'Delete'].map((action) => (
            <button
              key={action}
              type="button"
              className={`flex w-full cursor-pointer rounded-xl px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-muted focus-visible:bg-muted ${
                action === 'Delete' ? 'text-red-600 dark:text-red-400' : ''
              }`}
            >
              {action}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
