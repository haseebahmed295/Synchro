/**
 * Diagram Types
 * Type definitions for diagram nodes and edges
 * Requirements: 9.1
 */

export type DiagramType = "class" | "sequence" | "erd" | "deployment" | "component" | "flowchart";

export type NodeType =
  | "class" | "entity" | "actor" | "lifeline"
  // deployment
  | "node" | "executionEnvironment" | "component" | "artifact" | "interface"
  // flowchart
  | "process" | "decision" | "terminal" | "io"
  // sequence
  | "fragment";

export type EdgeType =
  | "association"
  | "inheritance"
  | "dependency"
  | "composition"
  | "aggregation";

export interface DiagramNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    attributes?: string[];
    methods?: string[];
    stereotype?: string;
    // deployment diagram: child node IDs nested inside this node
    children?: string[];
  };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  multiplicity?: {
    source?: string;
    target?: string;
  };
  // sequence diagram message type
  msgType?: "sync" | "return" | "async";
  // sequence diagram vertical position
  msgY?: number;
  // sequence diagram execution order (1-based, derived from msgY sort)
  order?: number;
  // component diagram: specific handle IDs for per-interface connections
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Diagram {
  id: string;
  type: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  metadata?: {
    name?: string;
    description?: string;
  };
}
