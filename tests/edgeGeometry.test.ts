import { describe, expect, it } from "vitest";

import { simplify, smoothPath } from "@/components/edges/edgeGeometry";

describe("simplify", () => {
  it("drops waypoints that lie on the line between their neighbors", () => {
    expect(
      simplify([
        [100, 0],
        [103, 100],
        [98, 200],
        [100, 300],
      ])
    ).toEqual([
      [100, 0],
      [100, 300],
    ]);
  });

  it("keeps a waypoint that bends the line", () => {
    const points: Array<[number, number]> = [
      [100, 0],
      [100, 100],
      [300, 200],
      [300, 300],
    ];
    expect(simplify(points)).toEqual(points);
  });
});

describe("smoothPath", () => {
  it("leaves and arrives straight down by default", () => {
    const path = smoothPath([
      [100, 0],
      [300, 300],
    ]);
    const [c1, c2] = path
      .match(/C ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)/)!
      .slice(1)
      .map(Number)
      .reduce(
        (pairs, n, i) =>
          i % 2 === 0 ? [...pairs, [n]] : [...pairs.slice(0, -1), [...pairs.at(-1)!, n]],
        [] as number[][]
      );
    expect(c1[0]).toBe(100);
    expect(c1[1]).toBeGreaterThan(0);
    expect(c2[0]).toBe(300);
    expect(c2[1]).toBeLessThan(300);
  });

  it("leaves in the direction given", () => {
    const path = smoothPath(
      [
        [100, 0],
        [300, 300],
      ],
      [1, 0]
    );
    const c1x = Number(path.match(/C ([\d.]+)/)![1]);
    expect(c1x).toBeGreaterThan(100);
  });

  it("threads a straight run as one segment", () => {
    const path = smoothPath([
      [100, 0],
      [100, 100],
      [100, 200],
    ]);
    expect(path.match(/C/g)).toHaveLength(1);
  });
});
