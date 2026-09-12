/*
 * The Pipecat repository, which the landing page header promotes as the
 * site's does, with its star count revalidated daily. Null when GitHub
 * cannot be reached or rate-limits the unauthenticated request, in which
 * case the badge is simply not shown.
 */

export const GITHUB_REPO_NAME = "pipecat-ai";
export const GITHUB_REPO_URL = "https://github.com/pipecat-ai/pipecat";
export const EDITOR_REPO_URL = "https://github.com/pipecat-ai/pipecat-flows-editor";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export async function getGitHubStarCount(): Promise<string | null> {
  try {
    const response = await fetch("https://api.github.com/repos/pipecat-ai/pipecat", {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const repo: { stargazers_count?: number } = await response.json();
    if (typeof repo.stargazers_count !== "number") return null;
    return compact.format(repo.stargazers_count).toLowerCase();
  } catch {
    return null;
  }
}
