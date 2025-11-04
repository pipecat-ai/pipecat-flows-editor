import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-8">
      <h1 className="text-2xl font-semibold">Pipecat Flows Editor</h1>
      <p className="text-muted-foreground text-center max-w-xl">
        Build dynamic Pipecat Flows visually. Import/export JSON with validation. No server
        required.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/editor">Open Editor</Link>
        </Button>
        <Button variant="secondary" asChild>
          <a href="https://github.com/pipecat-ai/pipecat-flows" target="_blank" rel="noreferrer">
            Repo
          </a>
        </Button>
      </div>
    </main>
  );
}
