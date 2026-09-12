import { IconBrandGithub, IconStarFilled } from "@tabler/icons-react";

import { GITHUB_REPO_NAME, GITHUB_REPO_URL } from "@/lib/github";
import { cn } from "@/lib/utils";

/* The repository link with the star-count chip; the chip is left out when
   the count is unknown. */
export function GitHubStarLink({
  starCount,
  className,
}: {
  starCount: string | null;
  className?: string;
}) {
  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-2 text-sm transition-colors outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <IconBrandGithub aria-hidden className="size-4.5" />
      {GITHUB_REPO_NAME}
      {starCount && (
        <span className="ml-2 flex items-center gap-1.5 bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground">
          <IconStarFilled aria-hidden className="size-3" />
          {starCount}
        </span>
      )}
      <span className="sr-only">on GitHub</span>
    </a>
  );
}
