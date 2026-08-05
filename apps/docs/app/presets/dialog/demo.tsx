'use client';

import * as React from 'react';

import { Lightbox, morphDialog } from './lightbox';

/**
 * App-level demos only — not part of the copy-paste package.
 * Import the styled Lightbox from `./lightbox`, then compose triggers like this.
 *
 * 1. Share dialog — a Share button morphs into a link + members dialog
 * 2. Mini player — a now-playing pill morphs into a full player (shared artwork)
 * 3. Calendar event — a week-view event chip morphs into event details, and
 *    "Join call" morphs the details into a video-call dialog (`morphDialog`)
 * 4. Payment card — a miniature credit card morphs into a payment editor
 * 5. Confirmation alert — a destructive action morphs into a macOS-style alert
 *
 * Triggers use `crossfade="both"`: trigger and dialog never share pixels, so
 * the morph dissolves between the two snapshots.
 */
export function DialogPresetDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <ShareDialogDemo />
      <MiniPlayerDemo />
      <CalendarEventDemo />
      <PaymentCardDemo />
      <ConfirmAlertDemo />
    </div>
  );
}

/* ── Icons (inline, demo-only) ──────────────────────────────────────────── */

function IconDocument() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8.2 5.6v12.8c0 .95 1.05 1.53 1.85 1.02l10.05-6.4a1.2 1.2 0 0 0 0-2.04L10.05 4.58C9.25 4.07 8.2 4.65 8.2 5.6Z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6.5" y="5" width="4" height="14" rx="1.3" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.3" />
    </svg>
  );
}

function IconSkipBack() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5.5a1 1 0 0 1 2 0v13a1 1 0 1 1-2 0v-13Zm13 .93v11.14c0 .98-1.1 1.56-1.9.99l-7.8-5.57a1.22 1.22 0 0 1 0-1.98l7.8-5.57c.8-.57 1.9.01 1.9.99Z" />
    </svg>
  );
}

function IconSkipForward() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18 5.5a1 1 0 0 0-2 0v13a1 1 0 1 0 2 0v-13ZM5 6.43v11.14c0 .98 1.1 1.56 1.9.99l7.8-5.57a1.22 1.22 0 0 0 0-1.98L6.9 5.44c-.8-.57-1.9.01-1.9.99Z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <rect x="9" y="3" width="6" height="11.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        d="m16 10 5-3v10l-5-3M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Shared demo card chrome ────────────────────────────────────────────── */

const cardClass =
  'flex items-center justify-between gap-3 rounded-2xl border border-neutral-300 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.06)] dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_4px_16px_rgb(0_0_0/0.35)]';

const triggerButtonClass =
  'shrink-0 rounded-[7px] bg-white px-3.5 py-1.5 text-[13px] font-medium text-neutral-900 shadow-[0_0_0_0.5px_rgb(0_0_0/0.16),0_1px_2px_rgb(0_0_0/0.08)] dark:bg-neutral-700 dark:text-neutral-50 dark:shadow-[inset_0_0.5px_0_rgb(255_255_255/0.16),0_0_0_0.5px_rgb(0_0_0/0.5)]';

/* ── 1. Share dialog ────────────────────────────────────────────────────── */

const members = [
  { name: 'Maya Chen', role: 'Owner', tint: 'bg-indigo-500' },
  { name: 'Jonas Weber', role: 'Can edit', tint: 'bg-emerald-500' },
  { name: 'Priya Natarajan', role: 'Can view', tint: 'bg-amber-500' },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('');
}

function ShareDialogDemo() {
  return (
    <Lightbox.Root>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Share dialog
      </p>
      <div className={cardClass}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-sky-400 to-blue-500 text-white shadow-sm [&>svg]:size-5">
            <IconDocument />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              Q3 Roadmap
            </span>
            <span className="block text-xs text-neutral-500">Edited 2 hours ago</span>
          </span>
        </span>
        <Lightbox.Trigger index={0} crossfade="both" className={triggerButtonClass}>
          Share…
        </Lightbox.Trigger>
      </div>
      <Lightbox.Dialog ariaLabel="Share Q3 Roadmap">
        <ShareDialogContent />
      </Lightbox.Dialog>
    </Lightbox.Root>
  );
}

function ShareDialogContent() {
  const [copied, setCopied] = React.useState(false);
  const resetRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(resetRef.current), []);

  const copyLink = () => {
    navigator.clipboard?.writeText('https://droplet.app/d/q3-roadmap').catch(() => {});
    setCopied(true);
    window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="p-5">
      <Lightbox.DialogTitle>Share “Q3 Roadmap”</Lightbox.DialogTitle>
      <Lightbox.DialogDescription className="mt-1">
        Anyone with the link can view. Members can edit.
      </Lightbox.DialogDescription>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-black/[0.04] py-1.5 pr-1.5 pl-3 shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08)] dark:bg-white/[0.06] dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.1)]">
        <span className="min-w-0 truncate font-mono text-xs text-neutral-500 dark:text-neutral-400">
          droplet.app/d/q3-roadmap
        </span>
        <Lightbox.Button className="ml-auto" onClick={copyLink}>
          {copied ? 'Copied' : 'Copy'}
        </Lightbox.Button>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.name} className="flex items-center gap-2.5">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${member.tint}`}
              aria-hidden
            >
              {initials(member.name)}
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium">{member.name}</span>
            <span className="ml-auto shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
              {member.role}
            </span>
          </li>
        ))}
      </ul>

      <Lightbox.DialogActions className="mt-5">
        <Lightbox.Close variant="primary">Done</Lightbox.Close>
      </Lightbox.DialogActions>
    </div>
  );
}

/* ── 2. Mini player ─────────────────────────────────────────────────────── */

const ALBUM_ART = 'https://picsum.photos/seed/album-glasshouse/600/600';

/** Three tiny bars bouncing while playing (frozen when paused). */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-rose-500"
          style={{
            height: 5 + i * 4,
            animation: `lbdemo-eq 0.9s ease-in-out ${i * 0.18}s infinite`,
            animationPlayState: playing ? 'running' : 'paused',
          }}
        />
      ))}
    </span>
  );
}

function MiniPlayerDemo() {
  const [playing, setPlaying] = React.useState(true);

  return (
    <Lightbox.Root>
      <style>{`@keyframes lbdemo-eq { 0%, 100% { height: 5px; } 50% { height: 16px; } }`}</style>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Mini player
      </p>
      <Lightbox.Trigger
        index={0}
        crossfade="both"
        className="flex w-full items-center gap-3 rounded-2xl border border-neutral-300 bg-white p-3 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.06)] dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_4px_16px_rgb(0_0_0/0.35)]"
      >
        {({ imageRef }) => (
          <>
            <img
              ref={imageRef}
              src={ALBUM_ART}
              width={600}
              height={600}
              alt=""
              className="size-11 shrink-0 rounded-lg object-cover shadow-sm"
            />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold text-neutral-900 dark:text-neutral-50">
                Luminous
              </span>
              <span className="block truncate text-xs text-neutral-500">
                Ada Reyes — Glasshouse
              </span>
            </span>
            <Equalizer playing={playing} />
          </>
        )}
      </Lightbox.Trigger>
      <Lightbox.Dialog size="sm" ariaLabel="Now playing: Luminous by Ada Reyes">
        <PlayerDialogContent playing={playing} onPlayingChange={setPlaying} />
      </Lightbox.Dialog>
    </Lightbox.Root>
  );
}

function PlayerDialogContent({
  playing,
  onPlayingChange,
}: {
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
}) {
  return (
    <div className="p-4">
      <img
        src={ALBUM_ART}
        width={600}
        height={600}
        alt="Glasshouse album artwork"
        loading="eager"
        className="aspect-square w-full rounded-xl object-cover shadow-[0_8px_24px_rgb(0_0_0/0.25)]"
      />

      <div className="mt-4 text-center">
        <Lightbox.DialogTitle>Luminous</Lightbox.DialogTitle>
        <Lightbox.DialogDescription className="mt-0.5">
          Ada Reyes — Glasshouse
        </Lightbox.DialogDescription>
      </div>

      <div className="mt-4">
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
          <div className="h-full w-[38%] rounded-full bg-black/40 dark:bg-white/60" />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
          <span>1:24</span>
          <span>-2:11</span>
        </div>
      </div>

      <div className="mt-1 mb-1 flex items-center justify-center gap-7 text-neutral-800 dark:text-neutral-100">
        <button
          type="button"
          aria-label="Previous track"
          className="cursor-pointer transition-transform active:scale-90 [&>svg]:size-5"
        >
          <IconSkipBack />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => onPlayingChange(!playing)}
          className="cursor-pointer transition-transform active:scale-90 [&>svg]:size-9"
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          aria-label="Next track"
          className="cursor-pointer transition-transform active:scale-90 [&>svg]:size-5"
        >
          <IconSkipForward />
        </button>
      </div>
    </div>
  );
}

/* ── 3. Calendar event ──────────────────────────────────────────────────── */

const avatarTints = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500'];

type CalendarEvent = {
  title: string;
  time: string;
  timeShort: string;
  calendar: string;
  dot: string;
  bar: string;
  chip: string;
  chipTitle: string;
  chipTime: string;
  location?: string;
  video?: boolean;
  attendees: string[];
  primaryAction?: string;
};

const calendarEvents: CalendarEvent[] = [
  {
    title: 'Standup',
    time: 'Today · 9:15 – 9:30',
    timeShort: '9:15 – 9:30',
    calendar: 'Work',
    dot: 'bg-neutral-400',
    bar: 'bg-neutral-400',
    chip: 'bg-neutral-500/10 hover:bg-neutral-500/15 dark:bg-neutral-400/10 dark:hover:bg-neutral-400/15',
    chipTitle: 'text-neutral-700 dark:text-neutral-300',
    chipTime: 'text-neutral-500',
    video: true,
    attendees: ['Maya Chen', 'Jonas Weber', 'Priya Natarajan'],
    primaryAction: 'Join call',
  },
  {
    title: 'Design review',
    time: 'Today · 10:00 – 10:45',
    timeShort: '10:00 – 10:45 · Room 2',
    calendar: 'Work',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    chip: 'bg-sky-500/15 hover:bg-sky-500/20 dark:bg-sky-400/15 dark:hover:bg-sky-400/20',
    chipTitle: 'text-sky-900 dark:text-sky-200',
    chipTime: 'text-sky-800/70 dark:text-sky-300/70',
    location: 'Meeting Room 2 · 4th floor',
    video: true,
    attendees: ['Maya Chen', 'Jonas Weber', 'Priya Natarajan'],
    primaryAction: 'Join call',
  },
  {
    title: 'Lunch with Priya',
    time: 'Today · 12:30 – 13:30',
    timeShort: '12:30 – 13:30',
    calendar: 'Personal',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15',
    chipTitle: 'text-emerald-900 dark:text-emerald-200',
    chipTime: 'text-emerald-800/70 dark:text-emerald-300/70',
    location: 'Fig & Olive, SoMa',
    attendees: ['Priya Natarajan'],
    primaryAction: 'Directions',
  },
];

function CalendarEventDemo() {
  /*
   * Controlled active index so "Join call" can swap panels while the dialog
   * stays open: panels 0..2 are event details (one per chip trigger), the
   * extra last panel is the video call. `morphDialog` wraps the swap in a
   * view transition, so the details panel morphs into the call window.
   */
  const [value, setValue] = React.useState(0);
  const [callEventIndex, setCallEventIndex] = React.useState(0);
  const callPanelIndex = calendarEvents.length;

  // The call panel is a child of the details panel: End, Escape, backdrop and
  // outside clicks all morph back to the details dialog instead of closing.
  const leaveCall = () => morphDialog(() => setValue(callEventIndex));

  return (
    <Lightbox.Root value={value} onValueChange={setValue}>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Calendar event
      </p>
      <div className="rounded-2xl border border-neutral-300 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_rgb(0_0_0/0.06)] dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_4px_16px_rgb(0_0_0/0.35)]">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Today</span>
          <span className="text-xs text-neutral-500">Wed, Aug 5</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {calendarEvents.map((event, i) => (
            <Lightbox.Trigger
              key={event.title}
              index={i}
              crossfade="both"
              className={`relative w-full overflow-hidden rounded-lg py-1.5 pr-3 pl-4 text-left transition-colors ${event.chip}`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${event.bar}`} aria-hidden />
              <span className={`block text-[13px] font-semibold ${event.chipTitle}`}>
                {event.title}
              </span>
              <span className={`block text-xs ${event.chipTime}`}>{event.timeShort}</span>
            </Lightbox.Trigger>
          ))}
        </div>
      </div>
      <Lightbox.Dialog
        size="sm"
        ariaLabel="Event details"
        count={calendarEvents.length + 1}
        onDismiss={value === callPanelIndex ? leaveCall : undefined}
      >
        {(index) =>
          index === callPanelIndex ? (
            <VideoCallPanel event={calendarEvents[callEventIndex]!} onLeave={leaveCall} />
          ) : (
            <EventDetails
              event={calendarEvents[index]!}
              onJoin={
                calendarEvents[index]!.video
                  ? () =>
                      morphDialog(() => {
                        setCallEventIndex(index);
                        setValue(callPanelIndex);
                      })
                  : undefined
              }
            />
          )
        }
      </Lightbox.Dialog>
    </Lightbox.Root>
  );
}

function EventDetails({ event, onJoin }: { event: CalendarEvent; onJoin?: () => void }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${event.dot}`} aria-hidden />
        <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
          {event.calendar}
        </span>
      </div>
      <Lightbox.DialogTitle className="mt-1">{event.title}</Lightbox.DialogTitle>

      <ul className="mt-3 flex flex-col gap-2.5 text-[13px] text-neutral-700 dark:text-neutral-300">
        <li className="flex items-center gap-2.5">
          <span className="text-neutral-400 [&>svg]:size-4">
            <IconClock />
          </span>
          {event.time}
        </li>
        {event.location ? (
          <li className="flex items-center gap-2.5">
            <span className="text-neutral-400 [&>svg]:size-4">
              <IconPin />
            </span>
            {event.location}
          </li>
        ) : null}
        {event.video ? (
          <li className="flex items-center gap-2.5">
            <span className="text-neutral-400 [&>svg]:size-4">
              <IconVideo />
            </span>
            Video call available
          </li>
        ) : null}
      </ul>

      <div className="mt-3.5 flex items-center gap-2.5">
        <span className="flex" aria-hidden>
          {event.attendees.map((name, i) => (
            <span
              key={name}
              className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white dark:ring-neutral-800 ${avatarTints[i % avatarTints.length]} ${i > 0 ? '-ml-1.5' : ''}`}
            >
              {initials(name)}
            </span>
          ))}
        </span>
        <span className="text-xs text-neutral-500">
          {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
        </span>
      </div>

      <Lightbox.DialogActions className="mt-4">
        <Lightbox.Close>Done</Lightbox.Close>
        {event.primaryAction ? (
          onJoin ? (
            <Lightbox.Button variant="primary" onClick={onJoin}>
              {event.primaryAction}
            </Lightbox.Button>
          ) : (
            <Lightbox.Close variant="primary">{event.primaryAction}</Lightbox.Close>
          )
        ) : null}
      </Lightbox.DialogActions>
    </div>
  );
}

/**
 * FaceTime-style call window — the last panel index, reached via `morphDialog`.
 * Every way out (End, Escape, backdrop, outside click) runs `onLeave`, which
 * morphs back to the parent details dialog rather than closing the lightbox.
 */
function VideoCallPanel({ event, onLeave }: { event: CalendarEvent; onLeave: () => void }) {
  const [muted, setMuted] = React.useState(false);
  const remote = event.attendees.find((name) => name !== 'Maya Chen') ?? 'Guest';

  return (
    <div className="p-2.5">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[9px] bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950">
        <span className="absolute top-2.5 left-2.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur-sm">
          {event.title}
        </span>
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/10 text-base font-semibold text-white/90 ring-1 ring-white/15">
            {initials(remote)}
          </span>
          <span className="text-[13px] font-medium text-white/90">{remote}</span>
          <span className="animate-pulse text-[11px] text-white/50">Connecting…</span>
        </span>
        <span
          className="absolute right-2.5 bottom-2.5 flex h-16 w-12 items-center justify-center rounded-lg bg-gradient-to-b from-neutral-600 to-neutral-800 text-[10px] font-semibold text-white/75 ring-1 ring-white/20"
          aria-hidden
        >
          MC
        </span>
      </div>
      <div className="mt-2.5 mb-0.5 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-pressed={muted}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          onClick={() => setMuted((current) => !current)}
          className={`flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors [&>svg]:size-4 ${
            muted
              ? 'bg-red-500/10 text-red-500 dark:bg-red-400/15 dark:text-red-400'
              : 'bg-black/[0.05] text-neutral-700 dark:bg-white/[0.08] dark:text-neutral-200'
          }`}
        >
          <IconMic />
        </button>
        <button
          type="button"
          aria-label="Camera"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/[0.05] text-neutral-700 dark:bg-white/[0.08] dark:text-neutral-200 [&>svg]:size-4"
        >
          <IconVideo />
        </button>
        <Lightbox.Button variant="destructive" className="ml-1" onClick={onLeave}>
          End
        </Lightbox.Button>
      </div>
    </div>
  );
}

/* ── 4. Payment card ────────────────────────────────────────────────────── */

/** Mastercard-style overlapping circles. */
function CardBrand({ className }: { className?: string }) {
  return (
    <span className={`flex ${className ?? ''}`} aria-hidden>
      <span className="size-3.5 rounded-full bg-red-500/90" />
      <span className="-ml-1.5 size-3.5 rounded-full bg-amber-400/90" />
    </span>
  );
}

const inputClass =
  'w-full rounded-lg bg-black/[0.04] px-3 py-2 text-[13px] text-neutral-900 shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.1)] outline-none focus:shadow-[inset_0_0_0_1.5px_rgb(10_110_253/0.7)] dark:bg-white/[0.06] dark:text-neutral-50 dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.12)]';

function PaymentCardDemo() {
  const [cardholder, setCardholder] = React.useState('Maya Chen');

  return (
    <Lightbox.Root>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Payment card
      </p>
      <Lightbox.Trigger
        index={0}
        crossfade="both"
        className="relative block aspect-[1.586] w-48 rounded-xl bg-gradient-to-br from-neutral-600 via-neutral-800 to-neutral-950 p-3.5 text-left text-white shadow-[0_1px_2px_rgb(0_0_0/0.2),0_8px_20px_rgb(0_0_0/0.25),inset_0_0.5px_0_rgb(255_255_255/0.25)]"
      >
        <span
          className="block h-5 w-[26px] rounded-[4px] bg-gradient-to-br from-amber-200 to-amber-400 shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.25)]"
          aria-hidden
        />
        <span className="mt-3 block font-mono text-[10px] tracking-[0.14em] whitespace-nowrap text-white/90">
          •••• •••• •••• 4242
        </span>
        <span className="mt-2 flex items-end justify-between">
          <span className="min-w-0 truncate text-[10px] font-medium tracking-wider text-white/70 uppercase">
            {cardholder.trim() || 'Your name'}
          </span>
          <CardBrand />
        </span>
      </Lightbox.Trigger>
      <Lightbox.Dialog ariaLabel="Edit payment method">
        <div className="p-5">
          <Lightbox.DialogTitle>Payment method</Lightbox.DialogTitle>
          <Lightbox.DialogDescription className="mt-1">
            Used for purchases and subscriptions.
          </Lightbox.DialogDescription>

          <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-black/[0.04] px-3 py-2.5 shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08)] dark:bg-white/[0.06] dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.1)]">
            <CardBrand />
            <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-50">
              Mastercard ···· 4242
            </span>
            <span className="ml-auto text-xs text-neutral-500">Default</span>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Name on card</span>
              <input
                className={inputClass}
                value={cardholder}
                onChange={(event) => setCardholder(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="flex gap-3">
              <label className="block flex-1">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Expiry</span>
                <input className={inputClass} defaultValue="12 / 28" autoComplete="off" />
              </label>
              <label className="block flex-1">
                <span className="mb-1 block text-xs font-medium text-neutral-500">CVC</span>
                <input className={inputClass} placeholder="•••" autoComplete="off" />
              </label>
            </div>
          </div>

          <Lightbox.DialogActions className="mt-5">
            <Lightbox.Close>Cancel</Lightbox.Close>
            <Lightbox.Close variant="primary">Save</Lightbox.Close>
          </Lightbox.DialogActions>
        </div>
      </Lightbox.Dialog>
    </Lightbox.Root>
  );
}

/* ── 5. Confirmation alert ──────────────────────────────────────────────── */

function ConfirmAlertDemo() {
  return (
    <Lightbox.Root>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
        Confirmation alert
      </p>
      <div className={cardClass}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-neutral-400 to-neutral-500 text-white shadow-sm [&>svg]:size-5">
            <IconTrash />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              Trash
            </span>
            <span className="block text-xs text-neutral-500">128 items · 4.2 GB</span>
          </span>
        </span>
        <Lightbox.Trigger
          index={0}
          crossfade="both"
          className={`${triggerButtonClass} text-red-600 dark:text-red-400`}
        >
          Empty…
        </Lightbox.Trigger>
      </div>
      <Lightbox.Dialog size="sm" ariaLabel="Empty the Trash">
        <div className="flex flex-col items-center p-5 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-500 dark:bg-red-400/15 dark:text-red-400 [&>svg]:size-5">
            <IconTrash />
          </span>
          <Lightbox.DialogTitle className="mt-3">Empty the Trash?</Lightbox.DialogTitle>
          <Lightbox.DialogDescription className="mt-1">
            All 128 items will be permanently erased. You can’t undo this action.
          </Lightbox.DialogDescription>
          <Lightbox.DialogActions stack className="mt-4 w-full">
            <Lightbox.Close variant="destructive">Empty Trash</Lightbox.Close>
            <Lightbox.Close>Cancel</Lightbox.Close>
          </Lightbox.DialogActions>
        </div>
      </Lightbox.Dialog>
    </Lightbox.Root>
  );
}
