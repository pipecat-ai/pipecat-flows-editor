import { IconBrandGithub } from "@tabler/icons-react";
import Link from "next/link";

import { DailyLogo } from "@/components/icons/DailyLogo";
import PipecatLogo from "@/components/icons/PipecatLogo";
import PixelStreams from "@/components/site/PixelStreams";
import { siteButton } from "@/components/site/siteButton";
import { ThemeSwitch } from "@/components/ThemeSwitch";

const resources = [
  { label: "Pipecat", href: "https://pipecat.ai" },
  { label: "Discord", href: "https://discord.gg/pipecat" },
  {
    label: "Docs",
    href: "https://docs.pipecat.ai/guides/features/pipecat-flows",
  },
  {
    label: "API Reference",
    href: "https://docs.pipecat.ai/server/frameworks/flows/pipecat-flows",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-2 flex max-w-6xl items-center justify-between gap-6 border-x px-4 py-5 sm:mx-6 sm:px-8 xl:mx-auto">
          <div className="flex items-center gap-3">
            <PipecatLogo className="h-4 sm:h-7 w-auto" />
            <h1 className="text-md sm:text-xl font-semibold">Pipecat Flows Editor</h1>
          </div>
          <ThemeSwitch />
        </div>
      </header>

      {/* The streams run full-bleed behind the whole hero, as the site's pixel
          cloud does; the copy sits on a translucent card, and the right half of
          the frame is left open so they show at full strength. */}
      <main className="relative isolate flex flex-1 flex-col">
        <PixelStreams className="-z-10 text-accent-line" fadeTop="3rem" />
        <div className="mx-2 h-12 border-x sm:mx-6 xl:mx-auto xl:w-full xl:max-w-6xl" />
        <div className="border-y">
          <div className="crosshair-frame mx-2 max-w-6xl border-x sm:mx-6 xl:mx-auto">
            <div className="grid lg:h-120 lg:grid-cols-[1fr_32.5rem]">
              <div className="flex flex-col justify-between gap-10 bg-card/70 p-6 sm:p-10">
                <div className="flex flex-col gap-5">
                  <h2 className="max-w-xl text-3xl font-light leading-snug text-pretty sm:text-4xl lg:text-5xl">
                    A <strong className="font-semibold">visual editor</strong> for Pipecat Flows
                  </h2>
                  <p className="max-w-lg text-pretty text-muted-foreground">
                    Open a flow written by an agent or by hand. See the graph, validate it, and fix
                    it in place.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/editor" prefetch className={siteButton.primary}>
                    Launch the editor
                  </Link>
                  <a
                    href="https://github.com/pipecat-ai/pipecat-flows-editor"
                    target="_blank"
                    rel="noreferrer"
                    className={siteButton.outline}
                  >
                    <IconBrandGithub className="size-4" />
                    Explore repository
                  </a>
                </div>
              </div>
              <div className="min-h-64 border-t lg:border-t-0 lg:border-l" />
            </div>
          </div>
        </div>
        <div className="mx-2 flex-1 border-x sm:mx-6 xl:mx-auto xl:w-full xl:max-w-6xl" />
      </main>

      <footer className="border-t">
        <div className="mx-2 flex max-w-6xl flex-col gap-6 border-x px-4 py-8 sm:mx-6 sm:px-8 md:flex-row md:items-center md:justify-between xl:mx-auto">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {resources.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="type-mono-label text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            href="https://www.daily.co"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Maintained by
            <DailyLogo className="h-4 w-auto" />
            <span className="sr-only">Daily</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
