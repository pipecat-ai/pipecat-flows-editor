import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  actionHandlers,
  referencedTools,
  templateVariables,
} from "@/lib/document/flowIntrospection";
import type { FlowConfig } from "@/lib/schema/flowConfig";

function loadExample(name: string): FlowConfig {
  return parse(readFileSync(resolve(__dirname, "../public/examples", name), "utf8"));
}

const foodOrdering = loadExample("food_ordering.yaml");
const restaurantReservation = loadExample("restaurant_reservation.yaml");

describe("referencedTools", () => {
  it("lists every tool with the nodes that offer it, globals last", () => {
    expect(referencedTools(foodOrdering)).toEqual([
      { name: "choose_pizza", usedBy: ["initial"] },
      { name: "choose_sushi", usedBy: ["initial"] },
      { name: "complete_order", usedBy: ["confirm"] },
      { name: "get_delivery_estimate", usedBy: ["global"] },
      { name: "revise_order", usedBy: ["confirm"] },
      { name: "select_pizza_order", usedBy: ["choose_pizza"] },
      { name: "select_sushi_order", usedBy: ["choose_sushi"] },
    ]);
  });

  it("merges a tool offered on several nodes", () => {
    expect(referencedTools(restaurantReservation)).toContainEqual({
      name: "check_availability",
      usedBy: ["get_time", "no_availability"],
    });
  });

  it("skips unnamed entries", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: { a: { task_messages: [], functions: [{ name: "" }] } },
    };
    expect(referencedTools(config)).toEqual([]);
  });
});

describe("actionHandlers", () => {
  it("lists function action handlers from pre and post actions", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: {
          task_messages: [],
          pre_actions: [{ type: "function", handler: "warm_up" }],
          post_actions: [
            { type: "tts_say", text: "Bye" },
            { type: "function", handler: "log" },
          ],
        },
        b: { task_messages: [], post_actions: [{ type: "function", handler: "log" }] },
      },
    };
    expect(actionHandlers(config)).toEqual([
      { name: "log", usedBy: ["a", "b"] },
      { name: "warm_up", usedBy: ["a"] },
    ]);
    expect(actionHandlers(foodOrdering)).toEqual([
      { name: "check_kitchen_status", usedBy: ["initial"] },
    ]);
  });
});

describe("templateVariables", () => {
  it("finds variables in role messages, task messages, and action text", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: {
          role_message: "You work for {{ restaurant_name }}.",
          task_messages: [
            { role: "developer", content: "Greet {{caller}} at {{restaurant_name}}." },
          ],
          post_actions: [{ type: "tts_say", text: "Bye from {{ restaurant_name }}" }],
        },
        b: {
          task_messages: [{ role: "developer", content: "No {{ 1bad }} or {{ spaced name }}." }],
        },
      },
    };
    expect(templateVariables(config)).toEqual([
      { name: "caller", usedBy: ["a"] },
      { name: "restaurant_name", usedBy: ["a"] },
    ]);
    expect(templateVariables(foodOrdering)).toEqual([
      { name: "restaurant_name", usedBy: ["initial"] },
    ]);
  });
});
