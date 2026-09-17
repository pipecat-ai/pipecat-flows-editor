import type { ReactFlowInstance as RFInstance } from "@xyflow/react";

import type { CanvasEdge, FlowCanvasNode } from "@/lib/convert/configToCanvas";

export type {
  CanvasEdge,
  CanvasEdgeData,
  CanvasNode,
  ConfigCanvasNode,
  ConfigNodeData,
  ConfigNodeType,
  DecisionCanvasNode,
  DecisionNodeData,
  FlowCanvasNode,
} from "@/lib/convert/configToCanvas";

/** What React Flow draws: config nodes and the decision nodes derived from them. */
export type FlowNode = FlowCanvasNode;
export type FlowEdge = CanvasEdge;
export type ReactFlowInstance = RFInstance<FlowNode, FlowEdge>;
