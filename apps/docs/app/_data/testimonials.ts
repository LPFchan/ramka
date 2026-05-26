import type { PersonColor } from './people';

export interface Testimonial {
  quote: string;
  author: string;
  title: string;
  initials: string;
  color: PersonColor;
  rating: number;
}

export const testimonials: Testimonial[] = [
  {
    quote: 'This design system has completely transformed how we build products. The component quality is unmatched.',
    author: 'Sarah Chen',
    title: 'VP of Engineering, Acme Corp',
    initials: 'SC',
    color: 'rose',
    rating: 5,
  },
  {
    quote:
      'We cut our development time in half after adopting this library. The APIs are intuitive and the components are rock solid.',
    author: 'David Park',
    title: 'Lead Developer, Nexus Labs',
    initials: 'DP',
    color: 'indigo',
    rating: 5,
  },
  {
    quote:
      'The attention to accessibility out of the box saved our team weeks of work. Truly best-in-class primitives.',
    author: 'Maria Gonzalez',
    title: 'Head of Product, Orbit.io',
    initials: 'MG',
    color: 'teal',
    rating: 5,
  },
  {
    quote:
      "Finally a component library that doesn't fight you on styling. Headless where it matters, polished where you need it.",
    author: 'James Liu',
    title: 'Senior Engineer, CloudBase',
    initials: 'JL',
    color: 'orange',
    rating: 4,
  },
  {
    quote:
      'We migrated from three different UI libraries to just this one. Our bundle size dropped by 40% and DX went through the roof.',
    author: 'Amara Osei',
    title: 'CTO, Paystack',
    initials: 'AO',
    color: 'fuchsia',
    rating: 5,
  },
];
