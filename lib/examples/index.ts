/**
 * The editor's examples, served verbatim from `public/examples/`. Five are
 * Pipecat's own, copied from `examples/flows/` in the Pipecat repository at
 * the same commit as the vendored schema; the last two are authored here
 * until they are upstreamed with tools modules and scenarios.
 */

export interface FlowExample {
  id: string;
  name: string;
  path: string;
}

export const EXAMPLES: FlowExample[] = [
  { id: "hello_world", name: "Hello World", path: "/examples/hello_world.yaml" },
  { id: "food_ordering", name: "Food Ordering", path: "/examples/food_ordering.yaml" },
  {
    id: "restaurant_reservation",
    name: "Restaurant Reservation",
    path: "/examples/restaurant_reservation.yaml",
  },
  { id: "patient_intake", name: "Patient Intake", path: "/examples/patient_intake.yaml" },
  { id: "podcast_interview", name: "Podcast Interview", path: "/examples/podcast_interview.yaml" },
  { id: "order_status", name: "Order Status and Returns", path: "/examples/order_status.yaml" },
  {
    id: "lead_qualification",
    name: "Lead Qualification",
    path: "/examples/lead_qualification.yaml",
  },
];

export async function fetchExample(example: FlowExample): Promise<string> {
  const response = await fetch(example.path);
  if (!response.ok) throw new Error(`Could not load ${example.path}: ${response.status}`);
  return response.text();
}
