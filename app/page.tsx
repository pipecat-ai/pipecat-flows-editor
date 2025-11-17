import { IconBrandGithub } from "@tabler/icons-react";
import Link from "next/link";

import { DailyLogo } from "@/components/icons/DailyLogo";
import PipecatLogo from "@/components/icons/PipecatLogo";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
      <header className="border-b bg-background/80 backdrop-blur-lg z-20">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-6">
          <div className="flex items-center gap-3">
            <PipecatLogo height={28} />
            <h1 className="text-2xl font-semibold">Pipecat Flows Editor</h1>
          </div>
          <div className="hidden sm:flex gap-3">
            <Button asChild>
              <Link href="/editor">Open Editor</Link>
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" asChild>
                    <a
                      href="https://github.com/pipecat-ai/pipecat-flows-editor"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="sr-only">Visit repository</span>
                      <IconBrandGithub />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  Visit repository
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      <iframe
        src="/editor"
        className="w-dvw h-dvh z-0 absolute inset-0 pointer-events-none opacity-10"
      />

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center backdrop-blur-xs">
          <div className="space-y-4">
            <p className="text-base font-medium uppercase tracking-[0.2em] text-purple-400">
              Build conversational AI faster
            </p>
            <p className="text-balance text-3xl font-semibold sm:text-4xl lg:text-5xl">
              Design, validate, and share <span className="whitespace-nowrap">Pipecat Flows</span>{" "}
              without touching code.
            </p>
            <p className="text-balance text-lg text-muted-foreground">
              Instantly create, validate, and export conversational flows with a visual editor — no
              coding required. Runs fully in your browser for effortless, private, and
              lightning-fast workflow.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/editor" prefetch>
                Launch the editor
              </Link>
            </Button>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto" asChild>
              <a
                href="https://github.com/pipecat-ai/pipecat-flows-editor"
                target="_blank"
                rel="noreferrer"
              >
                <IconBrandGithub />
                Explore repository
              </a>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t bg-muted/30 backdrop-blur-lg z-20">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {resources.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide">Theme</span>
              <ThemeSwitch />
            </div>
            <div className="flex items-center gap-2">
              <span>Maintained by</span>
              <a
                href="https://www.daily.co"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 font-medium text-foreground"
              >
                <DailyLogo height={20} color="currentColor" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
