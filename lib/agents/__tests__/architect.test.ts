/**
 * Unit Tests for Architect Agent
 * Tests diagram generation and traceability link creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ArchitectAgent } from '../architect'
import type { Requirement } from '../analyst'
import type { Diagram } from '../../types/diagram'

// Mock the AI client
vi.mock('../../ai/client', () => ({
  generateAIObject: vi.fn(),
}))

import { generateAIObject } from '../../ai/client'

describe('ArchitectAgent', () => {
  let agent: ArchitectAgent
  const mockUserId = 'user-123'
  const mockProjectId = 'project-456'

  beforeEach(() => {
    agent = new ArchitectAgent()
    vi.clearAllMocks()
  })

  describe('requirementsToDiagram', () => {
    it('should generate a class diagram from requirements', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_AUTH_001',
          title: 'User Authentication',
          description: 'System shall authenticate users with email and password',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
        {
          id: 'REQ_USER_002',
          title: 'User Profile Management',
          description: 'Users shall be able to update their profile information',
          type: 'functional',
          priority: 'medium',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'USER_CLASS',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: {
              label: 'User',
              attributes: ['id: string', 'email: string', 'password: string'],
              methods: ['authenticate()', 'updateProfile()'],
            },
            linkedRequirements: ['REQ_AUTH_001', 'REQ_USER_002'],
          },
          {
            id: 'AUTH_SERVICE',
            type: 'class' as const,
            position: { x: 300, y: 100 },
            data: {
              label: 'AuthService',
              methods: ['login()', 'logout()', 'validateToken()'],
            },
            linkedRequirements: ['REQ_AUTH_001'],
          },
        ],
        edges: [
          {
            id: 'EDGE_1',
            source: 'AUTH_SERVICE',
            target: 'USER_CLASS',
            type: 'dependency' as const,
            label: 'authenticates',
          },
        ],
        reasoning: 'Created User class to represent user entity and AuthService to handle authentication logic',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      expect(result.diagram).toBeDefined()
      expect(result.diagram.type).toBe('class')
      expect(result.diagram.nodes).toHaveLength(2)
      expect(result.diagram.edges).toHaveLength(1)
      expect(result.diagram.id).toBeDefined()

      // Check traceability links
      expect(result.traceabilityLinks).toBeDefined()
      expect(result.traceabilityLinks.length).toBeGreaterThan(0)
      
      const link = result.traceabilityLinks[0]
      expect(link.sourceId).toBe('REQ_AUTH_001')
      expect(link.targetId).toBe('USER_CLASS')
      expect(link.linkType).toBe('derives_from')
      expect(link.confidence).toBe(0.9)
      expect(link.createdBy).toBe(mockUserId)
    })

    it('should generate an ERD diagram from requirements', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_DB_001',
          title: 'User Data Storage',
          description: 'System shall store user information in a database',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'USER_ENTITY',
            type: 'entity' as const,
            position: { x: 100, y: 100 },
            data: {
              label: 'users',
              attributes: ['id (PK)', 'email', 'created_at'],
            },
            linkedRequirements: ['REQ_DB_001'],
          },
        ],
        edges: [],
        reasoning: 'Created users table to store user data',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'erd',
        mockProjectId,
        mockUserId
      )

      expect(result.diagram.type).toBe('erd')
      expect(result.diagram.nodes[0].type).toBe('entity')
    })

    it('should handle requirements with no linked nodes', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_TEST_001',
          title: 'Test Requirement',
          description: 'Test description',
          type: 'functional',
          priority: 'low',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'TEST_CLASS',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: {
              label: 'TestClass',
            },
            // No linkedRequirements
          },
        ],
        edges: [],
        reasoning: 'Created test class',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      expect(result.traceabilityLinks).toHaveLength(0)
    })

    it('should throw error when AI generation fails', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_001',
          title: 'Test',
          description: 'Test',
          type: 'functional',
          priority: 'low',
          status: 'draft',
          links: [],
        },
      ]

      vi.mocked(generateAIObject).mockRejectedValue(new Error('AI service unavailable'))

      await expect(
        agent.requirementsToDiagram(requirements, 'class', mockProjectId, mockUserId)
      ).rejects.toThrow('Diagram generation failed')
    })
  })

  describe('createTraceabilityLinks', () => {
    it('should create traceability links between requirements and diagram nodes', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_AUTH_001',
          title: 'User Authentication',
          description: 'System shall authenticate users',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
      ]

      const diagram: Diagram = {
        id: 'diagram-123',
        type: 'class',
        nodes: [
          {
            id: 'USER_CLASS',
            type: 'class',
            position: { x: 100, y: 100 },
            data: {
              label: 'User',
              methods: ['authenticate()'],
            },
          },
          {
            id: 'AUTH_SERVICE',
            type: 'class',
            position: { x: 300, y: 100 },
            data: {
              label: 'AuthService',
              methods: ['login()', 'logout()'],
            },
          },
        ],
        edges: [],
      }

      const mockLinksResult = {
        links: [
          {
            requirementId: 'REQ_AUTH_001',
            nodeId: 'USER_CLASS',
            confidence: 0.85,
            reasoning: 'User class implements authentication functionality',
          },
          {
            requirementId: 'REQ_AUTH_001',
            nodeId: 'AUTH_SERVICE',
            confidence: 0.95,
            reasoning: 'AuthService directly handles authentication',
          },
        ],
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockLinksResult)

      const links = await agent.createTraceabilityLinks(requirements, diagram, mockUserId)

      expect(links).toHaveLength(2)
      expect(links[0].sourceId).toBe('REQ_AUTH_001')
      expect(links[0].targetId).toBe('USER_CLASS')
      expect(links[0].confidence).toBe(0.85)
      expect(links[0].linkType).toBe('derives_from')
      expect(links[1].targetId).toBe('AUTH_SERVICE')
      expect(links[1].confidence).toBe(0.95)
    })

    it('should filter out low confidence links', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_001',
          title: 'Test',
          description: 'Test',
          type: 'functional',
          priority: 'low',
          status: 'draft',
          links: [],
        },
      ]

      const diagram: Diagram = {
        id: 'diagram-123',
        type: 'class',
        nodes: [
          {
            id: 'TEST_CLASS',
            type: 'class',
            position: { x: 100, y: 100 },
            data: { label: 'Test' },
          },
        ],
        edges: [],
      }

      const mockLinksResult = {
        links: [
          {
            requirementId: 'REQ_001',
            nodeId: 'TEST_CLASS',
            confidence: 0.3, // Below threshold
            reasoning: 'Weak relationship',
          },
        ],
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockLinksResult)

      const links = await agent.createTraceabilityLinks(requirements, diagram, mockUserId)

      expect(links).toHaveLength(0) // Filtered out due to low confidence
    })
  })

  describe('validateDiagram', () => {
    it('should validate a correct diagram', () => {
      const diagram: Diagram = {
        id: 'diagram-123',
        type: 'class',
        nodes: [
          {
            id: 'NODE_1',
            type: 'class',
            position: { x: 100, y: 100 },
            data: { label: 'Class1' },
          },
          {
            id: 'NODE_2',
            type: 'class',
            position: { x: 200, y: 200 },
            data: { label: 'Class2' },
          },
        ],
        edges: [
          {
            id: 'EDGE_1',
            source: 'NODE_1',
            target: 'NODE_2',
            type: 'association',
          },
        ],
      }

      const result = agent.validateDiagram(diagram)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect duplicate node IDs', () => {
      const diagram: Diagram = {
        id: 'diagram-123',
        type: 'class',
        nodes: [
          {
            id: 'NODE_1',
            type: 'class',
            position: { x: 100, y: 100 },
            data: { label: 'Class1' },
          },
          {
            id: 'NODE_1', // Duplicate
            type: 'class',
            position: { x: 200, y: 200 },
            data: { label: 'Class2' },
          },
        ],
        edges: [],
      }

      const result = agent.validateDiagram(diagram)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate node ID: NODE_1')
    })

    it('should detect invalid edge references', () => {
      const diagram: Diagram = {
        id: 'diagram-123',
        type: 'class',
        nodes: [
          {
            id: 'NODE_1',
            type: 'class',
            position: { x: 100, y: 100 },
            data: { label: 'Class1' },
          },
        ],
        edges: [
          {
            id: 'EDGE_1',
            source: 'NODE_1',
            target: 'NODE_NONEXISTENT', // Invalid reference
            type: 'association',
          },
        ],
      }

      const result = agent.validateDiagram(diagram)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('non-existent target node')
    })

    it('should detect invalid positions', () => {
      const diagram: Diagram = {
        id: 'diagram-123',
        type: 'class',
        nodes: [
          {
            id: 'NODE_1',
            type: 'class',
            position: { x: -10, y: 100 }, // Negative position
            data: { label: 'Class1' },
          },
        ],
        edges: [],
      }

      const result = agent.validateDiagram(diagram)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('invalid position')
    })

    it('should detect duplicate edge IDs', () => {
      const diagram: Diagram = {
        id: 'diagram-123',
        type: 'class',
        nodes: [
          {
            id: 'NODE_1',
            type: 'class',
            position: { x: 100, y: 100 },
            data: { label: 'Class1' },
          },
          {
            id: 'NODE_2',
            type: 'class',
            position: { x: 200, y: 200 },
            data: { label: 'Class2' },
          },
        ],
        edges: [
          {
            id: 'EDGE_1',
            source: 'NODE_1',
            target: 'NODE_2',
            type: 'association',
          },
          {
            id: 'EDGE_1', // Duplicate
            source: 'NODE_2',
            target: 'NODE_1',
            type: 'dependency',
          },
        ],
      }

      const result = agent.validateDiagram(diagram)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate edge ID: EDGE_1')
    })
  })

  describe('diagram generation - node and edge ID uniqueness', () => {
    it('should generate unique node IDs across multiple requirements', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_001',
          title: 'User Management',
          description: 'System shall manage users',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
        {
          id: 'REQ_002',
          title: 'Order Processing',
          description: 'System shall process orders',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
        {
          id: 'REQ_003',
          title: 'Payment Integration',
          description: 'System shall integrate with payment providers',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'USER_CLASS',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: { label: 'User' },
            linkedRequirements: ['REQ_001'],
          },
          {
            id: 'ORDER_CLASS',
            type: 'class' as const,
            position: { x: 300, y: 100 },
            data: { label: 'Order' },
            linkedRequirements: ['REQ_002'],
          },
          {
            id: 'PAYMENT_SERVICE',
            type: 'class' as const,
            position: { x: 500, y: 100 },
            data: { label: 'PaymentService' },
            linkedRequirements: ['REQ_003'],
          },
        ],
        edges: [
          {
            id: 'EDGE_USER_ORDER',
            source: 'USER_CLASS',
            target: 'ORDER_CLASS',
            type: 'association' as const,
          },
          {
            id: 'EDGE_ORDER_PAYMENT',
            source: 'ORDER_CLASS',
            target: 'PAYMENT_SERVICE',
            type: 'dependency' as const,
          },
        ],
        reasoning: 'Generated class diagram with unique IDs',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      // Verify all node IDs are unique
      const nodeIds = result.diagram.nodes.map(n => n.id)
      const uniqueNodeIds = new Set(nodeIds)
      expect(nodeIds.length).toBe(uniqueNodeIds.size)

      // Verify all edge IDs are unique
      const edgeIds = result.diagram.edges.map(e => e.id)
      const uniqueEdgeIds = new Set(edgeIds)
      expect(edgeIds.length).toBe(uniqueEdgeIds.size)

      // Verify diagram passes validation
      const validation = agent.validateDiagram(result.diagram)
      expect(validation.valid).toBe(true)
    })

    it('should generate unique IDs for sequence diagrams', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_LOGIN_001',
          title: 'User Login Flow',
          description: 'User logs in through the web interface',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'ACTOR_USER',
            type: 'actor' as const,
            position: { x: 100, y: 100 },
            data: { label: 'User' },
            linkedRequirements: ['REQ_LOGIN_001'],
          },
          {
            id: 'LIFELINE_WEB_APP',
            type: 'lifeline' as const,
            position: { x: 250, y: 100 },
            data: { label: 'WebApp' },
            linkedRequirements: ['REQ_LOGIN_001'],
          },
          {
            id: 'LIFELINE_AUTH_SERVICE',
            type: 'lifeline' as const,
            position: { x: 400, y: 100 },
            data: { label: 'AuthService' },
            linkedRequirements: ['REQ_LOGIN_001'],
          },
        ],
        edges: [
          {
            id: 'MSG_1',
            source: 'ACTOR_USER',
            target: 'LIFELINE_WEB_APP',
            type: 'association' as const,
            label: 'login(credentials)',
          },
          {
            id: 'MSG_2',
            source: 'LIFELINE_WEB_APP',
            target: 'LIFELINE_AUTH_SERVICE',
            type: 'association' as const,
            label: 'authenticate()',
          },
        ],
        reasoning: 'Generated sequence diagram for login flow',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'sequence',
        mockProjectId,
        mockUserId
      )

      expect(result.diagram.type).toBe('sequence')
      
      // Verify unique IDs
      const nodeIds = result.diagram.nodes.map(n => n.id)
      expect(new Set(nodeIds).size).toBe(nodeIds.length)
      
      const edgeIds = result.diagram.edges.map(e => e.id)
      expect(new Set(edgeIds).size).toBe(edgeIds.length)
    })

    it('should generate unique IDs for ERD diagrams', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_DB_001',
          title: 'Database Schema',
          description: 'System shall store users, orders, and products',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'ENTITY_USERS',
            type: 'entity' as const,
            position: { x: 100, y: 100 },
            data: {
              label: 'users',
              attributes: ['id (PK)', 'email', 'name'],
            },
            linkedRequirements: ['REQ_DB_001'],
          },
          {
            id: 'ENTITY_ORDERS',
            type: 'entity' as const,
            position: { x: 300, y: 100 },
            data: {
              label: 'orders',
              attributes: ['id (PK)', 'user_id (FK)', 'total'],
            },
            linkedRequirements: ['REQ_DB_001'],
          },
          {
            id: 'ENTITY_PRODUCTS',
            type: 'entity' as const,
            position: { x: 500, y: 100 },
            data: {
              label: 'products',
              attributes: ['id (PK)', 'name', 'price'],
            },
            linkedRequirements: ['REQ_DB_001'],
          },
        ],
        edges: [
          {
            id: 'REL_USER_ORDER',
            source: 'ENTITY_USERS',
            target: 'ENTITY_ORDERS',
            type: 'association' as const,
            multiplicity: { source: '1', target: 'N' },
          },
        ],
        reasoning: 'Generated ERD for database schema',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'erd',
        mockProjectId,
        mockUserId
      )

      expect(result.diagram.type).toBe('erd')
      
      // Verify all entities have unique IDs
      const entityIds = result.diagram.nodes.map(n => n.id)
      expect(new Set(entityIds).size).toBe(entityIds.length)
      expect(entityIds.every(id => id.startsWith('ENTITY_'))).toBe(true)
    })
  })

  describe('diagram generation - traceability link creation', () => {
    it('should create traceability links for all linked requirements', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_A',
          title: 'Requirement A',
          description: 'Description A',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
        {
          id: 'REQ_B',
          title: 'Requirement B',
          description: 'Description B',
          type: 'functional',
          priority: 'medium',
          status: 'draft',
          links: [],
        },
        {
          id: 'REQ_C',
          title: 'Requirement C',
          description: 'Description C',
          type: 'non-functional',
          priority: 'low',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'NODE_1',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: { label: 'Class1' },
            linkedRequirements: ['REQ_A', 'REQ_B'],
          },
          {
            id: 'NODE_2',
            type: 'class' as const,
            position: { x: 300, y: 100 },
            data: { label: 'Class2' },
            linkedRequirements: ['REQ_B', 'REQ_C'],
          },
        ],
        edges: [],
        reasoning: 'Test diagram',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      // Should create 4 traceability links total
      expect(result.traceabilityLinks).toHaveLength(4)

      // Verify links for NODE_1
      const node1Links = result.traceabilityLinks.filter(l => l.targetId === 'NODE_1')
      expect(node1Links).toHaveLength(2)
      expect(node1Links.map(l => l.sourceId)).toContain('REQ_A')
      expect(node1Links.map(l => l.sourceId)).toContain('REQ_B')

      // Verify links for NODE_2
      const node2Links = result.traceabilityLinks.filter(l => l.targetId === 'NODE_2')
      expect(node2Links).toHaveLength(2)
      expect(node2Links.map(l => l.sourceId)).toContain('REQ_B')
      expect(node2Links.map(l => l.sourceId)).toContain('REQ_C')

      // Verify all links have correct properties
      result.traceabilityLinks.forEach(link => {
        expect(link.linkType).toBe('derives_from')
        expect(link.confidence).toBe(0.9)
        expect(link.createdBy).toBe(mockUserId)
      })
    })

    it('should only create links for requirements that exist', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_VALID',
          title: 'Valid Requirement',
          description: 'This exists',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'NODE_1',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: { label: 'Class1' },
            linkedRequirements: ['REQ_VALID', 'REQ_INVALID'], // One invalid
          },
        ],
        edges: [],
        reasoning: 'Test diagram',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      // Should only create link for valid requirement
      expect(result.traceabilityLinks).toHaveLength(1)
      expect(result.traceabilityLinks[0].sourceId).toBe('REQ_VALID')
    })

    it('should handle multiple nodes linking to same requirement', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_SHARED',
          title: 'Shared Requirement',
          description: 'Used by multiple classes',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'NODE_A',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: { label: 'ClassA' },
            linkedRequirements: ['REQ_SHARED'],
          },
          {
            id: 'NODE_B',
            type: 'class' as const,
            position: { x: 300, y: 100 },
            data: { label: 'ClassB' },
            linkedRequirements: ['REQ_SHARED'],
          },
          {
            id: 'NODE_C',
            type: 'class' as const,
            position: { x: 500, y: 100 },
            data: { label: 'ClassC' },
            linkedRequirements: ['REQ_SHARED'],
          },
        ],
        edges: [],
        reasoning: 'Multiple classes implement same requirement',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      // Should create 3 separate links
      expect(result.traceabilityLinks).toHaveLength(3)
      
      // All should link from same requirement
      expect(result.traceabilityLinks.every(l => l.sourceId === 'REQ_SHARED')).toBe(true)
      
      // But to different targets
      const targetIds = result.traceabilityLinks.map(l => l.targetId)
      expect(targetIds).toContain('NODE_A')
      expect(targetIds).toContain('NODE_B')
      expect(targetIds).toContain('NODE_C')
    })
  })

  describe('diagram generation - various requirement sets', () => {
    it('should handle empty requirement list', async () => {
      const requirements: Requirement[] = []

      const mockDiagramResult = {
        nodes: [],
        edges: [],
        reasoning: 'No requirements provided',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      expect(result.diagram.nodes).toHaveLength(0)
      expect(result.diagram.edges).toHaveLength(0)
      expect(result.traceabilityLinks).toHaveLength(0)
    })

    it('should handle single requirement', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_SINGLE',
          title: 'Single Requirement',
          description: 'Only one requirement',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'SINGLE_CLASS',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: { label: 'SingleClass' },
            linkedRequirements: ['REQ_SINGLE'],
          },
        ],
        edges: [],
        reasoning: 'Simple single class diagram',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      expect(result.diagram.nodes).toHaveLength(1)
      expect(result.traceabilityLinks).toHaveLength(1)
    })

    it('should handle complex requirement set with mixed types', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_FUNC_1',
          title: 'Functional Requirement 1',
          description: 'User authentication',
          type: 'functional',
          priority: 'high',
          status: 'validated',
          links: [],
        },
        {
          id: 'REQ_FUNC_2',
          title: 'Functional Requirement 2',
          description: 'Data persistence',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
        {
          id: 'REQ_NON_FUNC_1',
          title: 'Non-Functional Requirement',
          description: 'System shall respond within 200ms',
          type: 'non-functional',
          priority: 'medium',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'AUTH_CLASS',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: {
              label: 'AuthService',
              methods: ['login()', 'logout()'],
            },
            linkedRequirements: ['REQ_FUNC_1'],
          },
          {
            id: 'DB_CLASS',
            type: 'class' as const,
            position: { x: 300, y: 100 },
            data: {
              label: 'DatabaseService',
              methods: ['save()', 'load()'],
            },
            linkedRequirements: ['REQ_FUNC_2'],
          },
        ],
        edges: [
          {
            id: 'EDGE_AUTH_DB',
            source: 'AUTH_CLASS',
            target: 'DB_CLASS',
            type: 'dependency' as const,
          },
        ],
        reasoning: 'Generated diagram from mixed requirement types',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      expect(result.diagram.nodes).toHaveLength(2)
      expect(result.diagram.edges).toHaveLength(1)
      expect(result.traceabilityLinks).toHaveLength(2)
    })

    it('should handle requirements with different priorities', async () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ_HIGH',
          title: 'High Priority',
          description: 'Critical feature',
          type: 'functional',
          priority: 'high',
          status: 'draft',
          links: [],
        },
        {
          id: 'REQ_MEDIUM',
          title: 'Medium Priority',
          description: 'Important feature',
          type: 'functional',
          priority: 'medium',
          status: 'draft',
          links: [],
        },
        {
          id: 'REQ_LOW',
          title: 'Low Priority',
          description: 'Nice to have',
          type: 'functional',
          priority: 'low',
          status: 'draft',
          links: [],
        },
      ]

      const mockDiagramResult = {
        nodes: [
          {
            id: 'CORE_CLASS',
            type: 'class' as const,
            position: { x: 100, y: 100 },
            data: { label: 'CoreService' },
            linkedRequirements: ['REQ_HIGH', 'REQ_MEDIUM'],
          },
          {
            id: 'OPTIONAL_CLASS',
            type: 'class' as const,
            position: { x: 300, y: 100 },
            data: { label: 'OptionalService' },
            linkedRequirements: ['REQ_LOW'],
          },
        ],
        edges: [],
        reasoning: 'Prioritized diagram generation',
      }

      vi.mocked(generateAIObject).mockResolvedValue(mockDiagramResult)

      const result = await agent.requirementsToDiagram(
        requirements,
        'class',
        mockProjectId,
        mockUserId
      )

      expect(result.diagram.nodes).toHaveLength(2)
      expect(result.traceabilityLinks).toHaveLength(3)
    })
  })
})
