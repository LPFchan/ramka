export const checkoutUrls = {
  commercial: 'https://whop.com/checkout/plan_dnHa69yVtWFwJ',
  agency: 'https://whop.com/checkout/plan_I5dvvgmSSwwDl',
} as const;

export type PaidCheckoutPlan = keyof typeof checkoutUrls;
