import type { ReactFlowInstance as RFInstance } from "@xyflow/react";

import type { CanvasEdge, CanvasNode } from "@/lib/convert/configToCanvas";

export type {
  BranchCanvasNode,
  BranchNodeData,
  CanvasEdge,
  CanvasEdgeData,
  CanvasNode,
  ConfigCanvasNode,
  ConfigNodeData,
  ConfigNodeType,
} from "@/lib/convert/configToCanvas";

export type FlowNode = CanvasNode;
export type FlowEdge = CanvasEdge;
export type ReactFlowInstance = RFInstance<FlowNode, FlowEdge>;
