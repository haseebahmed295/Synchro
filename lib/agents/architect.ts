/**
 * Module B: The Architect Agent
 * Handles diagram generation from requirements and bidirectional sync
 * Requirements: 7.1-7.6
 */

import { generateAIObject } from '../ai/client'
import { z } from 'zod'
import type { Diagram, DiagramNode, DiagramEdge } from '../types/diagram'
import type { Requirement } from './analyst'
import type { TraceabilityLink } from './types'
import { v4 as uuidv4 } from 'uuid'

/**
 * Diagram generation result schema
 */
const DiagramGenerationSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['class', 'entity', 'actor', 'lifeline']),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
    data: z.object({
      label: z.string(),
      attributes: z.array(z.string()).optional(),
      methods: z.array(z.string()).optional(),
      stereotype: z.string().optional(),
    }),
    linkedRequirements: z.array(z.string()).optional(),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: z.enum(['association', 'inheritance', 'dependency', 'composition', 'aggregation']),
    label: z.string().optional(),
    multiplicity: z.object({
      source: z.string().optional(),
      target: z.string().optional(),
    }).optional(),
  })),
  reasoning: z.string(),
})

type DiagramGenerationResult = z.infer<typeof DiagramGenerationSchema>

/**
 * The Architect Agent
 * Responsible for generating diagrams from requirements and maintaining bidirectional sync
 */
export class ArchitectAgent {
  /**
   * Generate diagram from requirements
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6
   */
  async requirementsToDiagram(
    requirements: Requirement[],
    diagramType: 'class' | 'sequence' | 'erd',
    projectId: string,
    userId: string
  ): Promise<{ diagram: Diagram; traceabilityLinks: TraceabilityLink[] }> {
    const systemPrompt = this.getSystemPromptForDiagramType(diagramType)

    const prompt = `Generate a ${diagramType} diagram from the following requirements:

${requirements.map(req => `
**${req.id}: ${req.title}**
${req.description}
Type: ${req.type}
Priority: ${req.priority}
`).join('\n')}

Instructions:
1. Generate unique IDs for all nodes and edges (use descriptive names like "USER_CLASS", "AUTH_ENTITY", etc.)
2. For each node, specify which requirements it relates to in the linkedRequirements array
3. Position nodes in a logical layout (use a grid or hierarchical layout)
4. Create appropriate relationships between nodes based on requirement descriptions
5. Include reasoning explaining your design decisions

Return a JSON object with nodes, edges, and reasoning.`

    try {
      const result = await generateAIObject(
        'architecture',
        prompt,
        DiagramGenerationSchema,
        systemPrompt
      )

      // Create diagram with unique ID
      const diagramId = uuidv4()
      const diagram: Diagram = {
        id: diagramId,
        type: diagramType,
        nodes: result.nodes.map(node => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        })),
        edges: result.edges,
        metadata: {
          name: `${diagramType.toUpperCase()} Diagram`,
          description: result.reasoning,
        },
      }

      // Create traceability links from requirements to diagram nodes
      const traceabilityLinks: TraceabilityLink[] = []
      
      for (const node of result.nodes) {
        if (node.linkedRequirements && node.linkedRequirements.length > 0) {
          for (const reqId of node.linkedRequirements) {
            // Verify requirement exists
            const requirement = requirements.find(r => r.id === reqId)
            if (requirement) {
              traceabilityLinks.push({
                sourceId: reqId,
                targetId: node.id,
                linkType: 'derives_from',
                confidence: 0.9, // High confidence for direct generation
                createdBy: userId,
              })
            }
          }
        }
      }

      return { diagram, traceabilityLinks }
    } catch (error) {
      console.error('Failed to generate diagram from requirements', error)
      throw new Error(`Diagram generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze requirement text to identify relevant diagram elements
   * Requirements: 7.5
   */
  async createTraceabilityLinks(
    requirements: Requirement[],
    diagram: Diagram,
    userId: string
  ): Promise<TraceabilityLink[]> {
    const systemPrompt = `You are an expert at analyzing requirements and identifying which diagram elements they relate to.

Your task is to create traceability links between requirements and diagram nodes based on semantic similarity and logical relationships.

For each requirement, identify:
1. Which diagram nodes implement or represent concepts from the requirement
2. The confidence level (0.0 to 1.0) based on how strongly they relate
3. Only create links with confidence >= 0.6

Consider:
- Keywords and terminology matches
- Functional relationships (e.g., "User authentication" relates to "User" and "AuthService" classes)
- Data flow and dependencies
- Domain concepts`

    const prompt = `Analyze these requirements and diagram nodes to create traceability links:

**Requirements:**
${requirements.map(req => `
${req.id}: ${req.title}
${req.description}
`).join('\n')}

**Diagram Nodes:**
${diagram.nodes.map(node => `
${node.id}: ${node.data.label}
Type: ${node.type}
${node.data.attributes ? `Attributes: ${node.data.attributes.join(', ')}` : ''}
${node.data.methods ? `Methods: ${node.data.methods.join(', ')}` : ''}
`).join('\n')}

Return a JSON array of links with: requirementId, nodeId, confidence, reasoning`

    try {
      const LinksSchema = z.object({
        links: z.array(z.object({
          requirementId: z.string(),
          nodeId: z.string(),
          confidence: z.number().min(0).max(1),
          reasoning: z.string(),
        })),
      })

      const result = await generateAIObject(
        'architecture',
        prompt,
        LinksSchema,
        systemPrompt
      )

      // Convert to TraceabilityLink format
      const traceabilityLinks: TraceabilityLink[] = result.links
        .filter(link => link.confidence >= 0.6)
        .map(link => ({
          sourceId: link.requirementId,
          targetId: link.nodeId,
          linkType: 'derives_from' as const,
          confidence: link.confidence,
          createdBy: userId,
        }))

      return traceabilityLinks
    } catch (error) {
      console.error('Failed to create traceability links', error)
      throw new Error(`Traceability link creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get system prompt based on diagram type
   */
  private getSystemPromptForDiagramType(diagramType: 'class' | 'sequence' | 'erd'): string {
    switch (diagramType) {
      case 'class':
        return `You are an expert software architect specializing in UML Class diagrams.

Your task is to generate well-structured class diagrams from requirements.

Guidelines for Class Diagrams:
1. Identify key entities, services, and data structures from requirements
2. Define attributes (properties/fields) for each class
3. Define methods (operations/functions) for each class
4. Use appropriate relationships:
   - inheritance: "is-a" relationships (e.g., Admin extends User)
   - association: general relationships between classes
   - composition: strong "has-a" relationships (lifecycle dependency)
   - aggregation: weak "has-a" relationships (independent lifecycle)
   - dependency: one class uses another temporarily
5. Add stereotypes when appropriate (<<interface>>, <<abstract>>, <<service>>)
6. Position classes in a logical grid layout (100px spacing)
7. Ensure all node and edge IDs are unique and descriptive

Best Practices:
- Keep classes focused and cohesive
- Follow SOLID principles
- Use clear, descriptive names
- Include multiplicity for associations when relevant`

      case 'sequence':
        return `You are an expert software architect specializing in UML Sequence diagrams.

Your task is to generate sequence diagrams showing interactions between components.

Guidelines for Sequence Diagrams:
1. Identify actors (users, external systems) and system components
2. Use "actor" type for external entities
3. Use "lifeline" type for system components
4. Create edges showing message flow in chronological order
5. Label edges with method calls or messages
6. Position actors/lifelines horizontally with 150px spacing
7. Ensure all node and edge IDs are unique and descriptive

Best Practices:
- Show the flow of a specific use case or scenario
- Include both synchronous and asynchronous messages
- Show return messages when relevant
- Keep sequences focused on one interaction flow`

      case 'erd':
        return `You are an expert database architect specializing in Entity-Relationship Diagrams.

Your task is to generate ERD diagrams showing data models and relationships.

Guidelines for ERD Diagrams:
1. Identify entities (database tables) from requirements
2. Define attributes (columns) for each entity
3. Identify primary keys and important fields
4. Use appropriate relationships:
   - association: general relationships with cardinality
   - composition: strong relationships (cascade delete)
   - aggregation: weak relationships
5. Add multiplicity labels (1:1, 1:N, N:M)
6. Position entities in a logical layout (120px spacing)
7. Ensure all node and edge IDs are unique and descriptive

Best Practices:
- Normalize to at least 3NF when appropriate
- Identify foreign key relationships
- Include important constraints
- Use clear, database-friendly naming conventions`

      default:
        return 'You are an expert software architect.'
    }
  }

  /**
   * Validate diagram structure
   */
  validateDiagram(diagram: Diagram): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for unique node IDs
    const nodeIds = new Set<string>()
    for (const node of diagram.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`)
      }
      nodeIds.add(node.id)
    }

    // Check for unique edge IDs
    const edgeIds = new Set<string>()
    for (const edge of diagram.edges) {
      if (edgeIds.has(edge.id)) {
        errors.push(`Duplicate edge ID: ${edge.id}`)
      }
      edgeIds.add(edge.id)
    }

    // Check that edge sources and targets reference existing nodes
    for (const edge of diagram.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge ${edge.id} references non-existent source node: ${edge.source}`)
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id} references non-existent target node: ${edge.target}`)
      }
    }

    // Check for valid positions
    for (const node of diagram.nodes) {
      if (node.position.x < 0 || node.position.y < 0) {
        errors.push(`Node ${node.id} has invalid position: (${node.position.x}, ${node.position.y})`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
