import "@testing-library/jest-dom/vitest";

// jsdom has no canvas. PixelStreams takes the null context and draws nothing,
// which is its fallback for a browser without one.
(HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
