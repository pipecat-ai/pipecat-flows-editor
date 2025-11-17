import "../styles/globals.css";

import type { Metadata } from "next";

import { ThemeProvider } from "@/components/ThemeProvider";

// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
  title: "Pipecat Flows Editor",
  description: "Visual editor for dynamic Pipecat Flows",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
