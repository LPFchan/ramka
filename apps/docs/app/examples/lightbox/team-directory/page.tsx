'use client';

import { Lightbox } from 'react-image-gallery';
import { ChevronLeft, ChevronRight, Globe, Mail, X } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ExampleShell } from '../../../_components/example-shell';
import {
  LightboxFrame,
  LightboxOverlay,
  StackedItemGroup,
  stackedItemClass,
} from '../../../_components/lightbox-chrome';

const teamMembers = [
  {
    id: 'sarah',
    name: 'Sarah Chen',
    role: 'Engineering Lead',
    location: 'San Francisco, CA',
    email: 'sarah@acme.dev',
    avatar: 'https://i.pravatar.cc/400?img=1',
    cover: 'https://picsum.photos/seed/team-sarah/1200/500',
    bio: 'Building distributed systems for the past decade. Previously at Stripe and Google. Passionate about developer tools and open source.',
    stats: { commits: '2,847', reviews: '1,203', projects: '14' },
    tags: ['Systems', 'Rust', 'Go'],
  },
  {
    id: 'marcus',
    name: 'Marcus Johnson',
    role: 'Senior Designer',
    location: 'Brooklyn, NY',
    email: 'marcus@acme.dev',
    avatar: 'https://i.pravatar.cc/400?img=3',
    cover: 'https://picsum.photos/seed/team-marcus/1200/500',
    bio: 'Design systems thinker with a love for motion and micro-interactions. Former lead designer at Figma. Believes every pixel tells a story.',
    stats: { commits: '982', reviews: '567', projects: '8' },
    tags: ['Design Systems', 'Motion', 'Figma'],
  },
  {
    id: 'priya',
    name: 'Priya Patel',
    role: 'Product Manager',
    location: 'London, UK',
    email: 'priya@acme.dev',
    avatar: 'https://i.pravatar.cc/400?img=5',
    cover: 'https://picsum.photos/seed/team-priya/1200/500',
    bio: 'Bridging the gap between users and code. 8 years in product across fintech and dev tools. Data-informed, user-obsessed.',
    stats: { commits: '341', reviews: '892', projects: '11' },
    tags: ['Product', 'Analytics', 'Strategy'],
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    role: 'Frontend Engineer',
    location: 'Austin, TX',
    email: 'alex@acme.dev',
    avatar: 'https://i.pravatar.cc/400?img=8',
    cover: 'https://picsum.photos/seed/team-alex/1200/500',
    bio: 'React nerd and accessibility advocate. Contributor to Radix UI and MDN. Believes the web should work for everyone.',
    stats: { commits: '3,102', reviews: '1,456', projects: '9' },
    tags: ['React', 'A11y', 'TypeScript'],
  },
  {
    id: 'yuki',
    name: 'Yuki Tanaka',
    role: 'Infrastructure',
    location: 'Tokyo, Japan',
    email: 'yuki@acme.dev',
    avatar: 'https://i.pravatar.cc/400?img=9',
    cover: 'https://picsum.photos/seed/team-yuki/1200/500',
    bio: 'Keeping the lights on and the deploys fast. Kubernetes whisperer. Automates everything, including the coffee machine.',
    stats: { commits: '1,678', reviews: '723', projects: '6' },
    tags: ['Kubernetes', 'Terraform', 'SRE'],
  },
  {
    id: 'elena',
    name: 'Elena Volkov',
    role: 'Staff Engineer',
    location: 'Berlin, Germany',
    email: 'elena@acme.dev',
    avatar: 'https://i.pravatar.cc/400?img=10',
    cover: 'https://picsum.photos/seed/team-elena/1200/500',
    bio: 'Compiler nerd turned web performance expert. Runs the perf guild and mentors junior engineers. Speaks at conferences about Core Web Vitals.',
    stats: { commits: '2,214', reviews: '1,890', projects: '12' },
    tags: ['Performance', 'WebAssembly', 'Mentorship'],
  },
  {
    id: 'omar',
    name: 'Omar Hassan',
    role: 'Backend Engineer',
    location: 'Toronto, Canada',
    email: 'omar@acme.dev',
    avatar: 'https://i.pravatar.cc/400?img=11',
    cover: 'https://picsum.photos/seed/team-omar/1200/500',
    bio: 'API architect who dreams in GraphQL schemas. Previously built real-time systems at Shopify. Dog dad and amateur chef.',
    stats: { commits: '1,956', reviews: '1,102', projects: '7' },
    tags: ['GraphQL', 'Node.js', 'PostgreSQL'],
  },
  {
    id: 'mei',
    name: 'Mei Lin',
    role: 'Data Engineer',
    location: 'Singapore',
    email: 'mei@acme.dev',
    avatar: 'https://i.pravatar.cc/400?img=16',
    cover: 'https://picsum.photos/seed/team-mei/1200/500',
    bio: 'Turning messy data into clean pipelines. Spark and Flink expert. Organizes the local PyData meetup and loves teaching workshops.',
    stats: { commits: '1,423', reviews: '645', projects: '5' },
    tags: ['Python', 'Spark', 'Data'],
  },
];

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30';

function ProfileCard({ member }: { member: (typeof teamMembers)[number] }) {
  return (
    <Card
      data-lightbox-morph
      className="w-[min(420px,90vw)] gap-0 overflow-hidden bg-card text-card-foreground shadow-[0_8px_40px_rgba(0,0,0,0.4)] ring-0 [&>img:first-child]:rounded-none"
    >
      <div className="relative h-[140px] overflow-hidden">
        <img src={member.cover} alt="" className="block h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/0 to-transparent" />
      </div>

      <CardContent className="-mt-12 px-5 pb-5">
        <img
          src={member.avatar}
          alt={member.name}
          className="block h-20 w-20 rounded-2xl border-[3px] border-card object-cover"
        />

        <CardHeader className="mt-3 px-0">
          <CardTitle className="text-lg">{member.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{member.role}</p>
        </CardHeader>

        <p className="mt-3 text-sm leading-relaxed">{member.bio}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {member.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="flex justify-around text-center">
          {Object.entries(member.stats).map(([label, value]) => (
            <div key={label}>
              <div className="text-base font-bold">{value}</div>
              <div className="text-xs capitalize text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Globe aria-hidden className="h-4 w-4 opacity-70" />
            <span>{member.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail aria-hidden className="h-4 w-4 opacity-70" />
            <span>{member.email}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamDirectoryPage() {
  return (
    <ExampleShell
      title="Team directory"
      description={
        <>
          A compact roster: each member&apos;s small avatar tile morphs into a rich profile card. The card itself is composed
          of shadcn primitives (Card, Avatar, Badge, Separator), with{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">data-lightbox-morph</code>{' '}
          applied to the avatar tile and the card so the morph aligns on a non-image surface.
        </>
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="py-4">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">About Us</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Meet the Team</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The people behind Acme Dev Tools. Click anyone to learn more about them.
          </p>
        </div>

        <Lightbox.Root viewTransition>
          <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2">
            {teamMembers.map((member, i) => (
              <Lightbox.Trigger
                key={member.id}
                index={i}
                crossfade
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-foreground/20"
              >
                <div
                  data-lightbox-morph
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-muted"
                >
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="block h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{member.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{member.role}</div>
                </div>
              </Lightbox.Trigger>
            ))}
          </div>

          <LightboxOverlay />

          <LightboxFrame ariaLabel="Team profiles">
            <div className="absolute right-4 top-4 z-10">
              <Lightbox.Close className={iconButton} aria-label="Close">
                <X aria-hidden className="h-5 w-5" />
              </Lightbox.Close>
            </div>

            <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
              <Lightbox.Previous className={iconButton} aria-label="Previous">
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </Lightbox.Previous>
            </div>

            <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2">
              <Lightbox.Next className={iconButton} aria-label="Next">
                <ChevronRight aria-hidden className="h-5 w-5" />
              </Lightbox.Next>
            </div>

            <StackedItemGroup>
              {teamMembers.map((member, i) => (
                <Lightbox.Item key={member.id} index={i} className={stackedItemClass}>
                  <ProfileCard member={member} />
                </Lightbox.Item>
              ))}
            </StackedItemGroup>

            <Lightbox.Counter className="pb-4 text-xs tabular-nums text-white/60" />
          </LightboxFrame>
        </Lightbox.Root>
      </div>
    </ExampleShell>
  );
}
