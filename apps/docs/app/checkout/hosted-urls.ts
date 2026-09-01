export const checkoutUrls = {
  // TODO(indie): placeholder — create the Indie plan in the Whop dashboard and
  // paste its hosted-checkout URL here before this tier goes live. Configure
  // the same terms links (Terms, Privacy, Return Policy, License Agreement)
  // on that plan as on the existing ones.
  indie: 'https://whop.com/checkout/plan_INDIE_TODO',
  commercial: 'https://whop.com/checkout/plan_dnHa69yVtWFwJ',
  agency: 'https://whop.com/checkout/plan_I5dvvgmSSwwDl',
} as const;

export type PaidCheckoutPlan = keyof typeof checkoutUrls;
