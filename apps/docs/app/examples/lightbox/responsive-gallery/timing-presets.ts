// ---------------------------------------------------------------------------
// Morph-timing lab archive.
//
// Every preset explored while picking the composited morph's default timing
// (now the `default` entry of VIEW_TRANSITION_PRESETS in ramka's vt-timing.ts,
// `360,.44,.58,0,1` — "launch tamed more"; consumers pick presets via the
// `viewTransition` prop on Lightbox.Root). Each value is a
// `window.__RAMKA_VT_TIMING__` string, applied live per open/close:
//   - `duration,x1,y1,x2,y2`         plain cubic-bezier
//   - `duration,out,windup,travel`   protected ease-out
//   - `duration,spring,zeta`         UIKit-style damped spring
//   - `duration,pspring,zeta,a,q`    spring with protected launch
//
// Try any of them on a running page via the URL, e.g. `?vttiming=500,spring,.8`,
// or from the console: `window.__RAMKA_VT_TIMING__ = '500,spring,.8'`.
// To bring the picker UI back, see the git history of page.tsx (a radio list
// that assigns the chosen value to `window.__RAMKA_VT_TIMING__`).
// ---------------------------------------------------------------------------

export const ARCHIVED_TIMING_PRESETS = {
  chosen: { label: 'Launch tamed more (SHIPPED DEFAULT)', value: '360,.44,.58,0,1' },
  mainBranchReference: { label: 'Stock timing — sheet curve @ 340ms', value: '340,.32,.72,0,1' },
  launchTamedVariations: [
    { label: 'Launch tamed a touch', value: '340,.38,.66,0,1' },
    { label: 'Launch tamed a touch, +40ms', value: '380,.38,.66,0,1' },
    { label: 'Launch tamed more, longer', value: '400,.48,.5,0,1' },
  ],
  durationStretches: [
    { label: 'Same curve, +20ms', value: '360,.32,.72,0,1' },
    { label: 'Same curve, +40ms', value: '380,.32,.72,0,1' },
    { label: 'Same curve, +60ms', value: '400,.32,.72,0,1' },
  ],
  appleInspired: [
    { label: 'iOS sheet curve — long', value: '500,.32,.72,0,1' },
    { label: 'Photos zoom spring (documented UIKit values)', value: '500,spring,.8' },
    { label: 'Photos zoom spring — tighter', value: '400,spring,.8' },
    { label: 'Critically damped spring (iOS 18 fluid-zoom feel)', value: '450,spring,1' },
    { label: 'Photos spring, protected launch', value: '500,pspring,.8,.2,.08' },
    { label: 'Critical spring, protected launch', value: '450,pspring,1,.22,.08' },
    { label: 'UIKit curveEaseOut (pre-spring Photos era)', value: '400,0,0,.58,1' },
  ],
  protectedEaseOuts: [
    { label: 'Protected out — former default', value: '350,out,.28,.1' },
    { label: 'Protected out — calm', value: '420,out,.24,.08' },
    { label: 'Protected out — brisk', value: '300,out,.32,.12' },
    { label: 'Protected out, sheet tempo', value: '400,out,.22,.1' },
    { label: 'Protected critical spring, sheet tempo', value: '380,pspring,1,.2,.09' },
    { label: 'Floaty — long settle', value: '600,out,.18,.05' },
  ],
  earlyBeziers: [
    { label: 'Material S-curve (first composited default)', value: '350,.5,0,.2,1' },
    { label: 'Soft slow-start bezier @ 400ms', value: '400,.5,0,.15,1' },
    { label: 'Soft slow-start bezier @ 500ms', value: '500,.5,0,.15,1' },
    { label: 'Ease-out expo', value: '450,.16,1,.3,1' },
    { label: 'Ease-out quint', value: '400,.22,1,.36,1' },
  ],
} as const;
