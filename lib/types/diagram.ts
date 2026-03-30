/**
 * Diagram Types
 * Type definitions for diagram nodes and edges
 * Requirements: 9.1
 */

export type DiagramType = 'class' | 'sequence' | 'erd';

export type NodeType = 'class' | 'entity' | 'actor' | 'lifeline';

export type EdgeType = 
  | 'association' 
  | 'inheritance' 
  | 'dependency' 
  | 'composition' 
  | 'aggregation';

export interface DiagramNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    attributes?: string[];
    methods?: string[];
    stereotype?: string;
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
