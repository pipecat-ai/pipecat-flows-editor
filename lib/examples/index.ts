/**
 * The editor's examples, served verbatim from `public/examples/`. Six are
 * Pipecat's own, each the `flow.yaml` of a directory under
 * `examples/flows/yaml/` in the Pipecat repository, where a `handlers.py`
 * and a `bot.py` sit beside it; the last two are authored here until they
 * are upstreamed with handlers of their own.
 */

export interface FlowExample {
  id: string;
  name: string;
  /** One line on what the flow does and what part of the format it shows. */
  description: string;
  path: string;
}

export const EXAMPLES: FlowExample[] = [
  {
    id: "hello_world",
    name: "Hello World",
    description: "The smallest flow: greet and end.",
    path: "/examples/hello_world.yaml",
  },
  {
    id: "food_ordering",
    name: "Food Ordering",
    description: "Pizza or sushi, confirm, done. Plain routing and a global function.",
    path: "/examples/food_ordering.yaml",
  },
  {
    id: "restaurant_reservation",
    name: "Restaurant Reservation",
    description: "Party size and time, then a branch on availability.",
    path: "/examples/restaurant_reservation.yaml",
  },
  {
    id: "patient_intake",
    name: "Patient Intake",
    description: "Verify identity, collect details section by section, read them back.",
    path: "/examples/patient_intake.yaml",
  },
  {
    id: "insurance_quote",
    name: "Insurance Quote",
    description: "Collect details, quote, and re-enter the quote node as state changes.",
    path: "/examples/insurance_quote.yaml",
  },
  {
    id: "podcast_interview",
    name: "Podcast Interview",
    description: "An interview that loops on itself between questions.",
    path: "/examples/podcast_interview.yaml",
  },
  {
    id: "order_status",
    name: "Order Status and Returns",
    description: "Look up an order and branch on its status, with a default.",
    path: "/examples/order_status.yaml",
  },
  {
    id: "lead_qualification",
    name: "Lead Qualification",
    description: "Learn the need, score the fit, book a demo or send resources.",
    path: "/examples/lead_qualification.yaml",
  },
];

export async function fetchExample(example: FlowExample): Promise<string> {
  const response = await fetch(example.path, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Could not load ${example.path}: ${response.status}`);
  return response.text();
}
