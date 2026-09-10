/* The site's button: mono caps, square corners, no shadow. */

const base =
  "type-mono-label inline-flex h-11 items-center justify-center gap-2 border px-6 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

export const siteButton = {
  primary: `${base} border-transparent bg-primary text-primary-foreground hover:bg-primary/85`,
  outline: `${base} border-border bg-card hover:bg-accent`,
};
