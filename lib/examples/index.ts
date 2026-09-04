/**
 * The editor's examples are Pipecat's own example configs, served verbatim
 * from `public/examples/` and copied from `examples/flows/` in the Pipecat
 * repository.
 */

export interface FlowExample {
  id: string;
  name: string;
  path: string;
}

export const EXAMPLES: FlowExample[] = [
  { id: "food_ordering", name: "Food Ordering", path: "/examples/food_ordering.yaml" },
  {
    id: "restaurant_reservation",
    name: "Restaurant Reservation",
    path: "/examples/restaurant_reservation.yaml",
  },
];

export async function fetchExample(example: FlowExample): Promise<string> {
  const response = await fetch(example.path);
  if (!response.ok) throw new Error(`Could not load ${example.path}: ${response.status}`);
  return response.text();
}
