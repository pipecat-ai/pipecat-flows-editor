import { IconBrandGithub } from "@tabler/icons-react";
import Link from "next/link";

import { DailyLogo } from "@/components/icons/DailyLogo";
import PipecatLogo from "@/components/icons/PipecatLogo";
import { GitHubStarLink } from "@/components/site/GitHubStarLink";
import PixelStreams from "@/components/site/PixelStreams";
import { siteButton } from "@/components/site/siteButton";
import { SocialLinks } from "@/components/site/SocialLinks";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { EDITOR_REPO_URL, getGitHubStarCount } from "@/lib/github";

const DOCS_URL = "https://docs.pipecat.ai/guides/features/pipecat-flows";

export default async function HomePage() {
  const starCount = await getGitHubStarCount();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-2 flex max-w-6xl items-stretch justify-between border-x sm:mx-6 xl:mx-auto">
          <div className="flex items-center gap-3 px-4 py-5 sm:px-8">
            <PipecatLogo className="h-4 sm:h-7 w-auto" />
            <h1 className="text-md sm:text-xl font-semibold">Pipecat Flows Editor</h1>
          </div>
          {/* The site's right-hand cluster: theme, source, docs, in hairline cells. */}
          <div className="flex items-stretch">
            <div className="flex items-center border-l px-3">
              <ThemeToggle />
            </div>
            <GitHubStarLink starCount={starCount} className="hidden border-l px-6 lg:flex" />
            <div className="hidden items-center border-l px-6 sm:flex">
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className={`${siteButton.primary} h-9 px-4`}
              >
                Documentation
              </a>
            </div>
          </div>
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
            <div className="grid lg:min-h-[26rem] lg:grid-cols-[1fr_32.5rem]">
              <div className="flex flex-col justify-between gap-10 bg-card/70 p-6 sm:p-10">
                <div className="flex flex-col gap-5">
                  {/* The site's hero headline: 2.25rem, line height 1.3, tracking -0.02em. */}
                  <h2 className="max-w-xl text-2xl font-light text-pretty sm:text-[2.25rem] sm:leading-[1.3] sm:tracking-[-0.02em]">
                    A <strong className="font-semibold">visual editor</strong> for Pipecat Flows
                  </h2>
                  <p className="max-w-lg text-pretty text-muted-foreground">
                    Build a flow with a coding agent, then visualize it here. Validate, fix, and
                    export it to your Pipecat project.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/editor" prefetch className={siteButton.primary}>
                    Launch the editor
                  </Link>
                  <a
                    href={EDITOR_REPO_URL}
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
        <div className="mx-2 flex max-w-6xl flex-col gap-6 border-x px-4 py-8 sm:mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 xl:mx-auto">
          <SocialLinks />
          <a
            href="https://www.daily.co"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
