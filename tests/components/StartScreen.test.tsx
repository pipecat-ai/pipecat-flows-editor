import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StartScreen from "@/components/start/StartScreen";

describe("StartScreen", () => {
  it("offers open, examples, and scratch, with examples listed by name", () => {
    render(
      <StartScreen onOpenFlow={() => true} onStartFromScratch={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(screen.getByText("Open a flow")).toBeInTheDocument();
    expect(screen.getByText("Start from an example")).toBeInTheDocument();
    expect(screen.getByText("Start from scratch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Food Ordering" })).toBeInTheDocument();
  });

  it("opens pasted YAML as untitled and dismisses when it opens", () => {
    const onOpenFlow = vi.fn(() => true);
    const onDismiss = vi.fn();
    render(
      <StartScreen onOpenFlow={onOpenFlow} onStartFromScratch={vi.fn()} onDismiss={onDismiss} />
    );
    const button = screen.getByRole("button", { name: /open pasted yaml/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Paste YAML"), { target: { value: "initial_node: a" } });
    fireEvent.click(button);
    expect(onOpenFlow).toHaveBeenCalledWith("initial_node: a", "untitled");
    expect(onDismiss).toHaveBeenCalled();
  });

  it("stays up when the flow does not open", () => {
    const onDismiss = vi.fn();
    render(
      <StartScreen onOpenFlow={() => false} onStartFromScratch={vi.fn()} onDismiss={onDismiss} />
    );
    fireEvent.change(screen.getByLabelText("Paste YAML"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /open pasted yaml/i }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("starts a blank flow and dismisses on Escape", () => {
    const onStartFromScratch = vi.fn();
    const onDismiss = vi.fn();
    render(
      <StartScreen
        onOpenFlow={() => true}
        onStartFromScratch={onStartFromScratch}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /blank flow/i }));
    expect(onStartFromScratch).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });
});
