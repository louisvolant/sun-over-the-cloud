// src/app/links.ts
export interface LinkItem {
  label: string;
  href: string;
}

export const internalLinks: LinkItem[] = [
  { label: 'Home', href: '/' },
];

// Footer links now point only to the author's personal site: the long list of
// companion projects was removed to keep the footer focused.
export const externalLinks: LinkItem[] = [
  { label: 'Personal Page', href: 'https://www.louisvolant.com' },
  { label: 'Portfolio', href: 'https://www.louisvolant.com/portfolio' },
];