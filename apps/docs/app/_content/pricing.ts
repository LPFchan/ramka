/**
 * Single source of truth for paid-license pricing shown across the site:
 * the /license tier cards, the landing page's closing CTA, and the nav
 * teasers all read from here, so a price change is a one-file edit.
 *
 * Launch week: `regular` is the price that applies once launch week ends.
 * It is always framed as a future price ("$99 after launch week"), never as
 * a former price: these tiers have not sold at the regular price yet, and a
 * struck-through price that never applied is a fictitious reference price
 * under EU/Polish price-indication rules.
 *
 * To end launch week: set each `price` to its `regular` value, delete the
 * `regular` fields, and update the Whop plans to charge the new prices.
 * `isLaunchWeek` is derived, so the launch-week UI disappears on its own.
 */
export const pricing = {
  indie: { price: '$79', regular: '$99' },
  business: { price: '$129', regular: '$150' },
  agency: { price: '$299', regular: '$349' },
} as const satisfies Record<string, { price: string; regular?: string }>;

export const isLaunchWeek = Object.values(pricing).some((tier) => 'regular' in tier);

/** The cheapest tier's price, for "from $79" copy. */
export const startingPrice = pricing.indie.price;
