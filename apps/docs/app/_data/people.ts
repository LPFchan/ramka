export type PersonColor = 'rose' | 'indigo' | 'cyan' | 'orange' | 'fuchsia' | 'teal' | 'violet' | 'emerald';

export interface Person {
  name: string;
  role: string;
  color: PersonColor;
  initials: string;
}

export const people: Person[] = [
  { name: 'Olivia Chen', role: 'Design Lead', color: 'rose', initials: 'OC' },
  { name: 'Marcus Johnson', role: 'Engineering', color: 'indigo', initials: 'MJ' },
  { name: 'Sofia Andersson', role: 'Product', color: 'cyan', initials: 'SA' },
  { name: 'James Wright', role: 'Marketing', color: 'orange', initials: 'JW' },
  { name: 'Priya Patel', role: 'Design', color: 'fuchsia', initials: 'PP' },
  { name: 'Alex Kim', role: 'Engineering', color: 'teal', initials: 'AK' },
  { name: 'Emma Davis', role: 'Research', color: 'violet', initials: 'ED' },
  { name: 'Noah Garcia', role: 'Engineering', color: 'emerald', initials: 'NG' },
];

export const colors: PersonColor[] = ['rose', 'indigo', 'cyan', 'orange', 'fuchsia', 'teal', 'violet', 'emerald'];
