import {
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandX,
  IconBrandYoutube,
} from "@tabler/icons-react";

import { GITHUB_REPO_URL } from "@/lib/github";
import { cn } from "@/lib/utils";

/* The site's icon row: Pipecat's GitHub, YouTube, X, and Discord. */
const socialLinks = [
  { label: "GitHub", href: GITHUB_REPO_URL, icon: IconBrandGithub },
  { label: "YouTube", href: "https://www.youtube.com/@DailyHQ", icon: IconBrandYoutube },
  { label: "X", href: "https://x.com/pipecat_ai", icon: IconBrandX },
  { label: "Discord", href: "https://discord.gg/pipecat", icon: IconBrandDiscord },
];

export function SocialLinks({ className }: { className?: string }) {
  return (
    <ul className={cn("flex items-center gap-4", className)}>
      {socialLinks.map(({ label, href, icon: Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            className="flex text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Icon aria-hidden className="size-4.5" />
          </a>
        </li>
      ))}
    </ul>
  );
}
