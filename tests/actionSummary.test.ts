import { describe, expect, it } from "vitest";

import { cardActionLines, summarizeActions } from "@/lib/utils/actionSummary";

const node = {
  pre_actions: [
    { type: "function", handler: "warm_up" },
    { type: "tts_say", text: "Welcome to the restaurant." },
  ],
  post_actions: [
    { type: "ring_bell" },
    { type: "notify", handler: "send_notification" },
    { type: "end_conversation" },
  ],
};

describe("summarizeActions", () => {
  it("groups by kind in a fixed order and leaves out ending the conversation", () => {
    expect(summarizeActions(node)).toEqual([
      { kind: "says", lines: ['Says "Welcome to the restaurant." before the node'] },
      { kind: "handler", lines: ["Runs warm_up before the node"] },
      {
        kind: "custom",
        lines: [
          "Custom action ring_bell after the node, registered in code",
          "Runs send_notification for the notify action after the node",
        ],
      },
    ]);
    expect(summarizeActions({})).toEqual([]);
  });
});

describe("cardActionLines", () => {
  it("splits pre-actions from post-actions and folds each block past the limit", () => {
    const { before, after } = cardActionLines(node);
    expect(before.map((l) => [l.kind, l.text])).toEqual([
      ["handler", "runs warm_up"],
      ["says", "“Welcome to the restaurant.”"],
    ]);
    expect(after.map((l) => [l.kind, l.text])).toEqual([
      ["custom", "ring_bell"],
      ["custom", "runs send_notification"],
    ]);
    const many = cardActionLines({
      pre_actions: [
        { type: "tts_say", text: "One" },
        { type: "tts_say", text: "Two" },
        { type: "tts_say", text: "Three" },
      ],
    });
    expect(many.before.map((l) => [l.kind, l.text])).toEqual([
      ["says", "“One”"],
      ["more", "+2 more"],
    ]);
    expect(many.before[1].title).toBe('Says "Two" before the node\nSays "Three" before the node');
    expect(many.after).toEqual([]);
  });

  it("returns empty blocks for a node without actions, and shortens the card text, not the tooltip", () => {
    const text = "x".repeat(80);
    const { before } = cardActionLines({ pre_actions: [{ type: "tts_say", text }] });
    expect(before).toHaveLength(1);
    expect(before[0].text).toBe(`“${"x".repeat(59)}…”`);
    expect(before[0].title).toBe(`Says "${text}" before the node`);
    expect(cardActionLines({})).toEqual({ before: [], after: [] });
  });
});
