import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StartScreen from "@/components/start/StartScreen";
import { EXAMPLES } from "@/lib/examples";

const setup = (over: Partial<React.ComponentProps<typeof StartScreen>> = {}) => {
  const props = {
    onOpenFlow: vi.fn(() => true),
    onStartFromScratch: vi.fn(),
    onDismiss: vi.fn(),
    ...over,
  };
  render(<StartScreen {...props} />);
  return props;
};

describe("StartScreen", () => {
  it("offers four equal choices, one click each", () => {
    const props = setup();
    for (const name of ["Open a file", "Paste YAML", "Start from an example", "Blank flow"]) {
      expect(screen.getByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: /Blank flow/ }));
    expect(props.onStartFromScratch).toHaveBeenCalled();
  });

  it("opens pasted YAML from a large editor as untitled and dismisses when it opens", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Paste YAML/ }));
    const open = screen.getByRole("button", { name: "Open" });
    expect(open).toBeDisabled();
    fireEvent.change(screen.getByLabelText("YAML"), { target: { value: "initial_node: a" } });
    fireEvent.click(open);
    expect(props.onOpenFlow).toHaveBeenCalledWith("initial_node: a", "untitled");
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it("stays up when the flow does not open", () => {
    const props = setup({ onOpenFlow: vi.fn(() => false) });
    fireEvent.click(screen.getByRole("button", { name: /Paste YAML/ }));
    fireEvent.change(screen.getByLabelText("YAML"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it("lists every example as a tile on its own step", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Start from an example/ }));
    for (const example of EXAMPLES) {
      expect(screen.getByRole("button", { name: new RegExp(example.name) })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByRole("button", { name: /Blank flow/ })).toBeInTheDocument();
  });

  it("steps back on Escape, then dismisses", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Paste YAML/ }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Blank flow/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onDismiss).toHaveBeenCalled();
  });
});
