'use client';

import { useRef, useState } from 'react';

import { StripLabel, TransformStrip } from './demo-shared';

const PRESETS = [
  { label: 'Reverse-engineered iOS', value: 0.95 },
  { label: 'Heavier', value: 0.92 },
  { label: 'Ice rink', value: 0.985 },
] as const;

/**
 * Demo 2: the same transform carousel, with the momentum constant exposed.
 * The point is not that one value is right. The point is that you are picking
 * one value for every device, input, and OS your users have, and the native
 * scroller next to it never had to choose.
 */
export function MomentumLab() {
  const [decel, setDecel] = useState(0.95);
  // The strip reads this ref every frame, so the slider retunes live flings.
  const decelRef = useRef(0.95);
  decelRef.current = decel;

  return (
    <figure className="my-8 rounded-2xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-3 text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
          Friction
          <input
            type="range"
            min={0.9}
            max={0.99}
            step={0.001}
            value={decel}
            onChange={(e) => setDecel(Number(e.target.value))}
            className="w-40 accent-neutral-900 dark:accent-neutral-100"
          />
          <span className="tabular-nums text-neutral-500">{decel.toFixed(3)}</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDecel(preset.value)}
              aria-pressed={decel === preset.value}
              className={`h-7 rounded-full px-3 text-[12px] font-medium transition ${
                decel === preset.value
                  ? 'bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900'
                  : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <StripLabel>Flick it, then change the friction and flick again</StripLabel>
      <TransformStrip decelRef={decelRef} ariaLabel="Momentum tuning image strip" />

      <figcaption className="mt-4 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
        Velocity multiplied by this constant every frame is the whole momentum model. 0.95 is the value people
        have reverse-engineered out of iOS. Whatever you pick, it is one curve for every OS, every input device,
        and every future software update. Your users notice, even if they cannot say what is off.
      </figcaption>
    </figure>
  );
}
