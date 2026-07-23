import type { ReactNode } from 'react';

import { DocsLink, docsLinkClassName } from '../../../_components/docs-link';
import { DocsPager } from '../../../_components/docs-pager';
import { DocsSection, DocsShell, type DocsTocItem } from '../../../_components/docs-shell';
import { lightboxApiHref, lightboxDocsPages } from '../../../_content/lightbox/docs-pages';

const toc: DocsTocItem[] = [
  { id: 'desktop-conventions', title: 'Desktop conventions' },
  { id: 'desktop-ramka', title: 'ramka on desktop' },
  { id: 'mobile-conventions', title: 'Mobile conventions' },
  { id: 'mobile-ramka', title: 'ramka on mobile' },
  { id: 'heuristics', title: 'UX heuristics' },
  { id: 'wcag', title: 'WCAG conformance' },
];

/** External link (opens in a new tab) styled like an inline docs link. */
function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={docsLinkClassName}>
      {children}
    </a>
  );
}

const tableWrap =
  'overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800';
const headRow =
  'bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400';
const th = 'px-3 py-2 font-medium whitespace-nowrap';
const td = 'px-3 py-2 align-top';
const tdLabel = 'px-3 py-2 align-top text-neutral-700 dark:text-neutral-300';

// --- Table A: how mainstream desktop viewers map zoom/pan --------------------
const appRows: {
  app: string;
  bareScroll: string;
  modifier: string;
  doubleClick: string;
  drag: string;
}[] = [
  { app: 'macOS Preview', bareScroll: 'Pan / scroll', modifier: 'Zoom (pinch)', doubleClick: 'Smart-zoom toggle', drag: 'Pan' },
  { app: 'Apple Photos (Mac)', bareScroll: '—', modifier: 'Zoom (pinch)', doubleClick: 'Toggle 1×↔zoom', drag: 'Pan' },
  { app: 'Windows Photos', bareScroll: 'Navigate', modifier: 'Zoom (Ctrl+wheel)', doubleClick: 'Toggle', drag: 'Pan' },
  { app: 'Google Photos (web)', bareScroll: 'Zoom to cursor', modifier: 'Zoom', doubleClick: 'Toggle', drag: 'Pan' },
  { app: 'Google Maps', bareScroll: 'Zoom to cursor', modifier: 'Zoom', doubleClick: 'Zoom-in step', drag: 'Pan' },
  { app: 'PhotoSwipe v5', bareScroll: 'Opt-in (wheelToZoom)', modifier: 'Zoom (pinch)', doubleClick: 'Toggle', drag: 'Pan' },
  { app: 'OpenSeadragon', bareScroll: 'Zoom to cursor', modifier: 'Zoom', doubleClick: 'Zoom-in step', drag: 'Pan' },
  { app: 'Lightroom', bareScroll: 'Zoom', modifier: 'Zoom', doubleClick: 'Toggle 1:1', drag: 'Pan' },
  { app: 'Figma / Miro (canvas)', bareScroll: 'Pan', modifier: 'Zoom to cursor', doubleClick: '—', drag: 'Pan (space)' },
];

// --- Table B: ramka vs the consensus, per interaction ------------------------
const ramkaRows: { interaction: string; ramka: string; consensus: string; verdict: string }[] = [
  { interaction: 'Ctrl / ⌘ + wheel', ramka: 'Zooms, focal at cursor', consensus: 'Zoom to cursor', verdict: 'Match' },
  { interaction: 'Trackpad pinch', ramka: 'Zooms to cursor (Safari GestureEvent; Chrome/FF via ctrlKey+wheel)', consensus: 'Zoom to cursor', verdict: 'Match, cross-browser' },
  { interaction: 'Bare scroll wheel', ramka: 'Off by default (scrollToZoom=false): no-op at 1×, pans when zoomed', consensus: 'Split — media viewers zoom, canvas apps pan', verdict: 'Defensible default; opt-in covers the other' },
  { interaction: 'Double-click', ramka: 'Toggles zoom, focal at cursor', consensus: 'Toggle, focal', verdict: 'Match' },
  { interaction: 'Drag to pan', ramka: 'Yes — grab / grabbing cursor, elastic + momentum', consensus: 'Universal', verdict: 'Match' },
  { interaction: 'Wheel to pan (zoomed)', ramka: 'Yes (deltaX / deltaY)', consensus: 'Common', verdict: 'Match' },
  { interaction: 'Zoom buttons', ramka: 'ZoomIn / ZoomOut, step ×2', consensus: 'Common', verdict: 'Zooms about center, not cursor' },
  { interaction: 'Keyboard zoom', ramka: '+ = − _ and ⌘/Ctrl+0', consensus: 'Expected', verdict: 'Match' },
  { interaction: 'Keyboard pan', ramka: 'Arrows pan (50px) when zoomed', consensus: 'Expected', verdict: 'Match' },
  { interaction: 'Max zoom', ramka: "Auto-capped to image's native resolution (fallback 4×)", consensus: 'Best practice (avoids blur)', verdict: 'Better than many' },
  { interaction: 'Cursor at 1×', ramka: 'No zoom-in affordance (consumer CSS)', consensus: 'Some apps show a zoom-in cursor', verdict: 'Minor discoverability gap' },
];

// --- Table D: how mainstream mobile viewers map zoom/pan ---------------------
const mobileAppRows: {
  app: string;
  pinch: string;
  doubleTap: string;
  pan: string;
  momentum: string;
  swipeDown: string;
}[] = [
  { app: 'iOS Photos', pinch: 'Focal, rubber-band', doubleTap: 'Toggle at tap', pan: '1-finger drag', momentum: 'Yes + overscroll', swipeDown: 'Dismiss' },
  { app: 'Android Google Photos', pinch: 'Focal, rubber-band', doubleTap: 'Toggle at tap', pan: '1-finger drag', momentum: 'Yes', swipeDown: 'Dismiss' },
  { app: 'Instagram', pinch: 'Focal (peek), snaps back', doubleTap: 'Like (not zoom)', pan: 'While pinched', momentum: 'No', swipeDown: 'Dismiss' },
  { app: 'Mobile Safari (page)', pinch: 'Focal', doubleTap: 'Toggle (smart)', pan: '1-finger drag', momentum: 'Yes', swipeDown: '—' },
  { app: 'PhotoSwipe (mobile)', pinch: 'Focal, rubber-band', doubleTap: 'Toggle at tap', pan: '1-finger drag', momentum: 'Yes', swipeDown: 'Dismiss' },
  { app: 'Telegram / WhatsApp', pinch: 'Focal', doubleTap: 'Toggle at tap', pan: '1-finger drag', momentum: 'Yes', swipeDown: 'Dismiss' },
];

// --- Table E: ramka on touch vs the consensus, per interaction ---------------
const mobileRamkaRows: { interaction: string; ramka: string; consensus: string; verdict: string }[] = [
  { interaction: 'Pinch to zoom', ramka: 'Focal at pinch midpoint; elastic past bounds, snaps back with haptic tick', consensus: 'Focal + rubber-band', verdict: 'Match' },
  { interaction: 'Double-tap', ramka: 'Toggles zoom, focal at tap; commit deferred to pointerup so a flick never misfires', consensus: 'Toggle at tap', verdict: 'Match (robust detection)' },
  { interaction: '1-finger pan (zoomed)', ramka: 'Elastic drag; velocity tracked', consensus: 'Universal', verdict: 'Match' },
  { interaction: 'Release with velocity', ramka: 'Momentum pan (decelerates, clamps to bounds)', consensus: 'iOS/Android inertia', verdict: 'Match' },
  { interaction: 'Swipe left / right', ramka: 'Navigates via Slides snap carousel (only at 1×)', consensus: 'Navigate photos', verdict: 'Match' },
  { interaction: 'Swipe down', ramka: 'Pull-to-dismiss; blocked while zoomed > 1×', consensus: 'Dismiss', verdict: 'Match' },
  { interaction: 'touch-action', ramka: "none when zoomed; pan-x pan-y at 1× (lets Slides + page own the swipe)", consensus: 'Guard native gestures', verdict: 'Correct' },
  { interaction: 'Native page pinch-zoom', ramka: 'Suppressed while Content is open so it never fights Lightbox.Zoom', consensus: 'Prevent conflict', verdict: 'Match' },
  { interaction: 'Haptics', ramka: 'Light tick on snap-back', consensus: 'iOS rubber-band feel', verdict: 'Better than many' },
];

// --- Table C: WCAG 2.2 criteria that govern zoom/pan -------------------------
const wcagRows: { sc: ReactNode; level: string; applies: string; status: ReactNode }[] = [
  {
    sc: (
      <ExternalLink href="https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html">
        2.5.1 Pointer Gestures
      </ExternalLink>
    ),
    level: 'A',
    applies: 'Pinch (touch + trackpad) is a multipoint gesture — needs a single-pointer alternative.',
    status: (
      <>
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">Pass.</strong> Double-tap /
        double-click and the ZoomIn / ZoomOut buttons are all single-pointer.
      </>
    ),
  },
  {
    sc: (
      <ExternalLink href="https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html">
        2.5.7 Dragging Movements
      </ExternalLink>
    ),
    level: 'AA',
    applies: 'Pan is drag-based and ramka implements its own pan (preventDefaults wheel), so the author-content clause applies.',
    status: (
      <>
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">Partial.</strong> Keyboard
        arrows + wheel-pan exist, but a strict single-pointer, non-drag pan alternative (e.g. pan
        controls) is not built in. See note below.
      </>
    ),
  },
  {
    sc: (
      <ExternalLink href="https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html">
        2.1.1 Keyboard
      </ExternalLink>
    ),
    level: 'A',
    applies: 'All zoom/pan must be reachable by keyboard.',
    status: (
      <>
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">Pass.</strong> +/−/0 and
        arrows route through the active-zoom bridge in Content.
      </>
    ),
  },
  {
    sc: (
      <ExternalLink href="https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html">
        2.5.8 Target Size (Minimum)
      </ExternalLink>
    ),
    level: 'AA',
    applies: 'Zoom / close controls should be ≥24×24 CSS px (44 px is the touch norm).',
    status: (
      <>
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">Consumer.</strong> Sizing
        is your CSS in a headless library — a guidance item, not a library defect.
      </>
    ),
  },
];

export default function LightboxZoomPage() {
  return (
    <DocsShell
      title="Zoom & a11y"
      description={
        <>
          How ramka&rsquo;s zoom &amp; pan — on desktop and on touch — lines up with mainstream image
          viewers, and how it maps to WCAG 2.2. For the wiring and gesture ownership, see{' '}
          <DocsLink href={lightboxDocsPages.gestures.href}>Gestures</DocsLink>.
        </>
      }
      toc={toc}
    >
      <DocsSection id="desktop-conventions" title="Desktop conventions">
        <p>
          Desktop image viewers split into two families, depending on whether the surface is treated as
          a <em>media viewer</em> or a <em>canvas / document</em>:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Media-viewer model</strong>{' '}
            (Google Photos, Lightroom, PhotoSwipe, OpenSeadragon): a bare scroll wheel zooms toward the
            cursor; drag pans.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Canvas / document model</strong>{' '}
            (Figma, macOS Preview, Google Maps on trackpad): a bare scroll pans, and zoom is gated behind a
            modifier (Ctrl / ⌘) or a trackpad pinch — so it never hijacks the user&rsquo;s scroll.
          </li>
        </ul>
        <p>
          Regardless of family, four things are near-universal: <strong className="font-medium text-neutral-800 dark:text-neutral-200">drag pans</strong>{' '}
          when zoomed, <strong className="font-medium text-neutral-800 dark:text-neutral-200">wheel/pinch zoom is focal</strong>{' '}
          (zooms toward the pointer), <strong className="font-medium text-neutral-800 dark:text-neutral-200">double-click toggles</strong>{' '}
          zoom, and <strong className="font-medium text-neutral-800 dark:text-neutral-200">Ctrl/⌘+wheel and trackpad pinch always zoom</strong>.
          The only real disagreement is whether a <em>bare</em> wheel zooms or pans.
        </p>
        <div className={tableWrap}>
          <table className="w-full text-left text-sm">
            <thead className={headRow}>
              <tr>
                <th className={th}>App</th>
                <th className={th}>Bare scroll</th>
                <th className={th}>Ctrl/⌘+wheel · pinch</th>
                <th className={th}>Double-click</th>
                <th className={th}>Drag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {appRows.map((r) => (
                <tr key={r.app}>
                  <td className={tdLabel}>{r.app}</td>
                  <td className={td}>{r.bareScroll}</td>
                  <td className={td}>{r.modifier}</td>
                  <td className={td}>{r.doubleClick}</td>
                  <td className={td}>{r.drag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection id="desktop-ramka" title="ramka on desktop">
        <p>
          ramka defaults to the canvas model: Ctrl/⌘+wheel and trackpad pinch zoom to the cursor, a bare
          wheel is a no-op at 1× (and pans when zoomed), and{' '}
          <code className="text-xs">scrollToZoom</code> on <DocsLink href={lightboxApiHref.zoom}>Zoom</DocsLink>{' '}
          opts into the media-viewer behavior. That is the more embed-friendly default — a lightbox often
          lives inside a scrollable page, so bare-wheel zoom risks trapping the user&rsquo;s scroll.
        </p>
        <div className={tableWrap}>
          <table className="w-full text-left text-sm">
            <thead className={headRow}>
              <tr>
                <th className={th}>Interaction</th>
                <th className={th}>ramka</th>
                <th className={th}>Consensus</th>
                <th className={th}>Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {ramkaRows.map((r) => (
                <tr key={r.interaction}>
                  <td className={tdLabel}>{r.interaction}</td>
                  <td className={td}>{r.ramka}</td>
                  <td className={td}>{r.consensus}</td>
                  <td className={td}>{r.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The one intentional inconsistency: <DocsLink href={lightboxApiHref.zoomIn}>ZoomIn</DocsLink> /{' '}
          <DocsLink href={lightboxApiHref.zoomOut}>ZoomOut</DocsLink> zoom about the center rather than the
          cursor. That is standard — buttons have no pointer position — and matches Google Maps / OpenSeadragon
          button behavior.
        </p>
      </DocsSection>

      <DocsSection id="mobile-conventions" title="Mobile conventions">
        <p>
          Touch is far more uniform than desktop — every mainstream photo viewer converges on the same
          model, set by iOS Photos and Android&rsquo;s Google Photos:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Pinch to zoom</strong>,
            focal at the pinch midpoint, with a <em>rubber-band</em> overshoot past the min/max that snaps
            back on release.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Double-tap</strong>{' '}
            toggles between fit and a zoomed level, centered on the tap point.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">One-finger drag pans</strong>{' '}
            while zoomed, with <strong className="font-medium text-neutral-800 dark:text-neutral-200">inertia / momentum</strong>{' '}
            on release.
          </li>
          <li>
            At fit, a <strong className="font-medium text-neutral-800 dark:text-neutral-200">horizontal swipe navigates</strong>{' '}
            and a <strong className="font-medium text-neutral-800 dark:text-neutral-200">downward swipe dismisses</strong>{' '}
            the viewer.
          </li>
        </ul>
        <p>
          The subtle-but-critical part is arbitration: pinch, pan, swipe-to-navigate, and swipe-to-dismiss
          all start from the same finger, so a viewer has to decide which gesture owns a given touch
          without misfiring.
        </p>
        <div className={tableWrap}>
          <table className="w-full text-left text-sm">
            <thead className={headRow}>
              <tr>
                <th className={th}>App</th>
                <th className={th}>Pinch</th>
                <th className={th}>Double-tap</th>
                <th className={th}>Pan</th>
                <th className={th}>Momentum</th>
                <th className={th}>Swipe down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {mobileAppRows.map((r) => (
                <tr key={r.app}>
                  <td className={tdLabel}>{r.app}</td>
                  <td className={td}>{r.pinch}</td>
                  <td className={td}>{r.doubleTap}</td>
                  <td className={td}>{r.pan}</td>
                  <td className={td}>{r.momentum}</td>
                  <td className={td}>{r.swipeDown}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection id="mobile-ramka" title="ramka on mobile">
        <p>
          ramka implements the full iOS/Android touch model, including the arbitration details that make
          it feel native — deferred double-tap commit (so a flick that starts near the last tap never
          zooms by mistake), elastic overscroll on both pinch and pan, momentum with bound-clamping, and a
          haptic tick on snap-back. Pull-to-dismiss and zoom/pan share a{' '}
          <DocsLink href={`${lightboxDocsPages.gestures.href}#matrix`}>navigation lock</DocsLink> so an
          in-flight Slides fling can&rsquo;t be hijacked mid-scroll.
        </p>
        <div className={tableWrap}>
          <table className="w-full text-left text-sm">
            <thead className={headRow}>
              <tr>
                <th className={th}>Interaction</th>
                <th className={th}>ramka</th>
                <th className={th}>Consensus</th>
                <th className={th}>Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {mobileRamkaRows.map((r) => (
                <tr key={r.interaction}>
                  <td className={tdLabel}>{r.interaction}</td>
                  <td className={td}>{r.ramka}</td>
                  <td className={td}>{r.consensus}</td>
                  <td className={td}>{r.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The touch model is where ramka is strongest — it matches the platform viewers point-for-point
          and adds haptics that most web lightboxes skip. Note that Instagram-style{' '}
          <em>pinch-to-peek</em> (zoom only holds while fingers are down, then springs back to fit) is a
          deliberate product choice, not the default; ramka keeps the zoom level after release like
          Photos, which is the right behavior for a general-purpose viewer.
        </p>
      </DocsSection>

      <DocsSection id="heuristics" title="UX heuristics">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Zoom to the cursor.</strong>{' '}
            The single most important pointer-zoom heuristic. ramka honors it for wheel, pinch, and
            double-click.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Don&rsquo;t hijack bare scroll by default.</strong>{' '}
            Keeping <code className="text-xs">scrollToZoom</code> off is the safer default for embedded
            lightboxes; enable it for full-bleed, single-image viewers.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Signal zoomability at rest.</strong>{' '}
            Consider a <code className="text-xs">zoom-in</code> cursor over the image at 1× so mouse-only
            users discover double-click / Ctrl-wheel zoom. ramka leaves this to your CSS — the{' '}
            <DocsLink href={lightboxApiHref.zoom}>Zoom</DocsLink> surface exposes{' '}
            <code className="text-xs">data-zoom</code> only while scaled past 1×, so target your own Zoom
            class and gate on <code className="text-xs">:not([data-zoom])</code>:
          </li>
        </ul>
        <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100 dark:bg-neutral-950">
          <code>{`/* .my-zoom is the className you pass to Lightbox.Zoom */
.my-zoom:not([data-zoom]) {
  cursor: zoom-in;
}`}</code>
        </pre>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Never steal swipe-to-dismiss.</strong>{' '}
            On touch, pan must only take over <em>after</em> the image is zoomed; at fit, the vertical
            swipe belongs to pull-to-dismiss and the horizontal swipe to navigation. ramka gates this with{' '}
            <code className="text-xs">touch-action</code> and the navigation lock.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Rubber-band, don&rsquo;t hard-stop.</strong>{' '}
            Elastic overscroll on pinch and pan (plus a haptic tick on snap-back) is what makes zoom feel
            native rather than mechanical.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Size touch controls for fingers.</strong>{' '}
            Give <DocsLink href={lightboxApiHref.zoomIn}>ZoomIn</DocsLink> /{' '}
            <DocsLink href={lightboxApiHref.zoomOut}>ZoomOut</DocsLink> and{' '}
            <DocsLink href={lightboxApiHref.close}>Close</DocsLink> a hit area of at least 44×44 px on touch
            (WCAG 2.5.8 asks ≥24 px; 44 px is the platform norm).
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="wcag" title="WCAG conformance">
        <p>
          These are the WCAG 2.2 success criteria that govern zoom &amp; pan. ramka ships the pointer and
          keyboard alternatives the criteria expect:
        </p>
        <div className={tableWrap}>
          <table className="w-full text-left text-sm">
            <thead className={headRow}>
              <tr>
                <th className={th}>Success criterion</th>
                <th className={th}>Level</th>
                <th className={th}>Applies to</th>
                <th className={th}>ramka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {wcagRows.map((r, i) => (
                <tr key={i}>
                  <td className={tdLabel}>{r.sc}</td>
                  <td className={td}>{r.level}</td>
                  <td className={td}>{r.applies}</td>
                  <td className={td}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Note on 2.5.7.</strong>{' '}
          Pan-by-drag has a keyboard alternative (arrows), which satisfies{' '}
          <ExternalLink href="https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html">2.1.1 Keyboard</ExternalLink>,
          but 2.5.7 specifically wants a <em>single-pointer, non-drag</em> alternative — keyboard does not
          count for it. If you must meet AA strictly, add pointer pan controls (e.g. edge/arrow buttons)
          alongside <DocsLink href={lightboxApiHref.zoomIn}>ZoomIn</DocsLink> /{' '}
          <DocsLink href={lightboxApiHref.zoomOut}>ZoomOut</DocsLink>. Many shipping viewers do not either,
          but for enterprise targets it is worth flagging.
        </p>
      </DocsSection>

      <DocsPager prev={lightboxDocsPages.gestures} next={lightboxDocsPages.api} />
    </DocsShell>
  );
}
