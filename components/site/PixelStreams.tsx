"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/*
 * Currents of 4px dithered cells flowing left to right that split and
 * rejoin: a flow with no boxes, in the grammar of pipecat.ai's pixel cloud.
 * Renders one cell per canvas pixel and lets CSS upscale it, so the dither
 * stays chunky. Ink is the element's text color; the ground is transparent.
 * Holds still for viewers who prefer reduced motion, and only runs while
 * on screen. Fills its positioned parent, like the site's pixel cloud.
 */

type Props = {
  /** Size of each cell in CSS pixels. */
  cellSize?: number;
  /** Base strength of the ink, baked into each cell's alpha. */
  opacity?: number;
  /** Cells per second the ink drifts along a current. */
  speed?: number;
  /** Height over which the top edge dissolves in, so the streams tuck under a header. */
  fadeTop?: string;
  className?: string;
};

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/** Half the thickness of a current, in cells. */
const HALF_WIDTH = 7;

const LANES = [
  { base: 0.3, amp: 0.1, ph: 0.0 },
  { base: 0.42, amp: 0.08, ph: 2.1 },
  { base: 0.58, amp: 0.09, ph: 4.0 },
  { base: 0.72, amp: 0.07, ph: 1.3 },
];

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function parseColor(color: string): [number, number, number] {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [113, 113, 122];
}

export default function PixelStreams({
  cellSize = 4,
  opacity = 0.55,
  speed = 22,
  fadeTop,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cols = 0;
    let rows = 0;
    let img: ImageData | null = null;
    let ink: [number, number, number] = [113, 113, 122];
    let raf = 0;
    let last = 0;
    let t = 0;
    let visible = true;

    // Each lane's center row per column; it depends on the size, not on time.
    let centers: Float32Array[] = [];
    const laneCenters = () =>
      LANES.map((l) => {
        const out = new Float32Array(cols);
        for (let x = 0; x < cols; x += 1) {
          const u = x / cols;
          out[x] =
            (l.base + l.amp * Math.sin(u * 4.2 + l.ph) + 0.05 * Math.sin(u * 1.7 + l.ph * 0.5)) *
            rows;
        }
        return out;
      });

    const field = (x: number, y: number) => {
      let v = 0;
      for (let i = 0; i < LANES.length; i += 1) {
        const d = Math.abs(y - centers[i][x]) / HALF_WIDTH;
        if (d >= 1) continue;
        const band = 1 - d * d;
        const grain = 0.55 + 0.45 * noise((x - t * speed) * 0.05, y * 0.05 + i * 11);
        v = Math.max(v, band * grain);
      }
      return clamp(v * 0.95, 0, 1);
    };

    const paint = () => {
      if (!img) return;
      const data = img.data;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const v = field(x, y);
          const shade = Math.floor(v * 4 + BAYER[y & 3][x & 3]) / 4;
          const i = (y * cols + x) * 4;
          data[i] = ink[0];
          data[i + 1] = ink[1];
          data[i + 2] = ink[2];
          data[i + 3] = Math.round(shade * 255 * opacity);
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 1000 / 30) return;
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      t += dt;
      paint();
    };

    const rebuild = () => {
      const { width, height } = canvas.getBoundingClientRect();
      cols = Math.max(1, Math.round(width / cellSize));
      rows = Math.max(1, Math.round(height / cellSize));
      canvas.width = cols;
      canvas.height = rows;
      img = ctx.createImageData(cols, rows);
      centers = laneCenters();
      ink = parseColor(getComputedStyle(canvas).color);
      paint();
    };

    rebuild();
    const resize = new ResizeObserver(rebuild);
    resize.observe(canvas);
    const intersect = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersect.observe(canvas);
    // Animate unless the viewer prefers reduced motion, and follow a change
    // to that preference while mounted.
    const follow = () => {
      if (motion.matches) {
        cancelAnimationFrame(raf);
        raf = 0;
        paint();
      } else if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    follow();
    motion.addEventListener("change", follow);

    return () => {
      cancelAnimationFrame(raf);
      motion.removeEventListener("change", follow);
      resize.disconnect();
      intersect.disconnect();
    };
  }, [cellSize, opacity, speed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{
        imageRendering: "pixelated",
        maskImage: fadeTop
          ? `linear-gradient(to bottom, transparent 0, black ${fadeTop})`
          : undefined,
      }}
    />
  );
}
