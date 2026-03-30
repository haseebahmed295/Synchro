/**
 * Module D: The Judge Agent
 * Handles diagram validation and governance
 * Requirements: 8.1-8.6, 21.1-21.8
 */

import { generateAIObject, generateAIText } from '../ai/client'
import { z } from 'zod'
import type { Diagram, DiagramEdge } from '../types/diagram'
import type { ValidationIssue } from './types'

/**
 * Validation result schema for AI-powered validation
 */
const ValidationResultSchema = z.object({
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    affectedArtifacts: z.array(z.string()),
    suggestedFix: z.string().optional(),
  })),
  reasoning: z.string(),
})

/**
 * Refinement feedback schema
 */
export interface RefinementFeedback {
  issues: ValidationIssue[]
  suggestions: string[]
  iterationCount: number
}

/**
 * The Judge Agent
 * Responsible for validation, governance, and quality control
 */
export class JudgeAgent {
  private readonly MAX_REFINEMENT_ITERATIONS = 2

  /**
   * Validate diagram consistency
   * Requirements: 8.1, 8.3, 8.4, 8.6
   */
  async validateDiagramConsistency(diagram: Diagram): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = []

    // Check for orphaned nodes (nodes with no connections)
    const orphanedNodes = this.detectOrphanedNodes(diagram)
    if (orphanedNodes.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Found ${orphanedNodes.length} orphaned node(s) with no connections`,
        affectedArtifacts: orphanedNodes,
        suggestedFix: 'Consider adding relationships to connect these nodes or removing them if they are not needed',
      })
    }

    // Check for circular inheritance
    const inheritanceCycles = this.detectInheritanceCycles(diagram)
    if (inheritanceCycles.length > 0) {
      issues.push({
        severity: 'error',
        message: 'Detected circular inheritance dependencies',
        affectedArtifacts: inheritanceCycles.flat(),
        suggestedFix: 'Break the inheritance cycle by removing one of the inheritance relationships',
      })
    }

    // Use GPT-5.2 for complex UML validation
    const aiValidationIssues = await this.performComplexUMLValidation(diagram)
    issues.push(...aiValidationIssues)

    return issues
  }

  /**
   * Detect orphaned nodes (nodes with no edges)
   * Requirements: 8.3
   */
  private detectOrphanedNodes(diagram: Diagram): string[] {
    const connectedNodeIds = new Set<string>()

    // Collect all nodes that have at least one edge
    for (const edge of diagram.edges) {
      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
    }

    // Find nodes that are not connected
    const orphanedNodes = diagram.nodes
      .filter(node => !connectedNodeIds.has(node.id))
      .map(node => node.id)

    return orphanedNodes
  }

  /**
   * Detect circular inheritance using depth-first search
   * Requirements: 8.4
   */
  private detectInheritanceCycles(diagram: Diagram): string[][] {
    const cycles: string[][] = []

    // Build adjacency list for inheritance edges only
    const inheritanceGraph = new Map<string, string[]>()
    for (const edge of diagram.edges) {
      if (edge.type === 'inheritance') {
        if (!inheritanceGraph.has(edge.source)) {
          inheritanceGraph.set(edge.source, [])
        }
        inheritanceGraph.get(edge.source)!.push(edge.target)
      }
    }

    // DFS to detect cycles
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const currentPath: string[] = []

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId)
      recursionStack.add(nodeId)
      currentPath.push(nodeId)

      const neighbors = inheritanceGraph.get(nodeId) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true
          }
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStartIndex = currentPath.indexOf(neighbor)
          const cycle = currentPath.slice(cycleStartIndex)
          cycles.push([...cycle, neighbor]) // Include the neighbor to close the cycle
          return true
        }
      }

      recursionStack.delete(nodeId)
      currentPath.pop()
      return false
    }

    // Check all nodes
    for (const node of diagram.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id)
      }
    }

    return cycles
  }

  /**
   * Perform complex UML validation using GPT-5.2
   * Requirements: 8.6
   */
  private async performComplexUMLValidation(diagram: Diagram): Promise<ValidationIssue[]> {
    const systemPrompt = `You are an expert UML validator specializing in complex diagram analysis.

Your task is to validate UML diagrams for correctness and best practices.

Check for:
1. Invalid relationship types for the diagram type (class, sequence, ERD)
2. Incorrect multiplicity specifications
3. Missing or invalid stereotypes
4. Semantic inconsistencies (e.g., composition from child to parent)
5. Naming convention violations
6. Missing required attributes or methods for specific patterns

For each issue found:
- Classify severity as "error" (must fix), "warning" (should fix), or "info" (suggestion)
- Provide clear message explaining the issue
- List affected node/edge IDs
- Suggest a specific fix

Only report genuine issues. If the diagram is valid, return an empty issues array.`

    const prompt = `Validate this ${diagram.type} diagram:

**Nodes:**
${diagram.nodes.map(node => `
- ${node.id} (${node.type}): ${node.data.label}
  ${node.data.attributes ? `Attributes: ${node.data.attributes.join(', ')}` : ''}
  ${node.data.methods ? `Methods: ${node.data.methods.join(', ')}` : ''}
  ${node.data.stereotype ? `Stereotype: ${node.data.stereotype}` : ''}
`).join('\n')}

**Edges:**
${diagram.edges.map(edge => `
- ${edge.id}: ${edge.source} --[${edge.type}]--> ${edge.target}
  ${edge.label ? `Label: ${edge.label}` : ''}
  ${edge.multiplicity ? `Multiplicity: ${edge.multiplicity.source || '*'} to ${edge.multiplicity.target || '*'}` : ''}
`).join('\n')}

Return a JSON object with issues array and reasoning.`

    try {
      const result = await generateAIObject(
        'validation',
        prompt,
        ValidationResultSchema,
        systemPrompt
      )

      return result.issues
    } catch (error) {
      console.error('Complex UML validation failed', error)
      // Return empty array on failure - don't block the workflow
      return []
    }
  }

  /**
   * Validate output with Critic/Refine loop
   * Requirements: 8.2, 8.5, 21.1, 21.6, 21.7, 21.8
   */
  async validateWithRefinement<T>(
    output: T,
    validator: (output: T) => Promise<ValidationIssue[]>,
    refiner: (output: T, feedback: RefinementFeedback) => Promise<T>,
    context: string
  ): Promise<{ output: T; issues: ValidationIssue[]; requiresEscalation: boolean; reasoningLog: string[] }> {
    const reasoningLog: string[] = []
    let currentOutput = output
    let iterationCount = 0

    reasoningLog.push(`Starting validation for: ${context}`)

    while (iterationCount < this.MAX_REFINEMENT_ITERATIONS) {
      // Validate current output
      const issues = await validator(currentOutput)

      // Check if there are critical errors
      const criticalErrors = issues.filter(issue => issue.severity === 'error')

      if (criticalErrors.length === 0) {
        reasoningLog.push(`Validation passed on iteration ${iterationCount + 1}`)
        return {
          output: currentOutput,
          issues,
          requiresEscalation: false,
          reasoningLog,
        }
      }

      // Log the issues found
      reasoningLog.push(`Iteration ${iterationCount + 1}: Found ${criticalErrors.length} critical error(s)`)
      for (const error of criticalErrors) {
        reasoningLog.push(`  - ${error.message}`)
      }

      // Prepare feedback for refinement
      const feedback: RefinementFeedback = {
        issues: criticalErrors,
        suggestions: criticalErrors
          .filter(e => e.suggestedFix)
          .map(e => e.suggestedFix!),
        iterationCount: iterationCount + 1,
      }

      // Attempt refinement
      try {
        reasoningLog.push(`Attempting refinement iteration ${iterationCount + 1}`)
        currentOutput = await refiner(currentOutput, feedback)
        iterationCount++
      } catch (error) {
        reasoningLog.push(`Refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        break
      }
    }

    // If we reach here, validation failed after max iterations
    const finalIssues = await validator(currentOutput)
    const criticalErrors = finalIssues.filter(issue => issue.severity === 'error')

    reasoningLog.push(`Validation failed after ${this.MAX_REFINEMENT_ITERATIONS} refinement iterations`)
    reasoningLog.push(`Escalating to user with ${criticalErrors.length} unresolved error(s)`)

    return {
      output: currentOutput,
      issues: finalIssues,
      requiresEscalation: true,
      reasoningLog,
    }
  }

  /**
   * Validate Architect diagram output before database write
   * Requirements: 21.1, 21.6
   */
  async validateArchitectOutput(
    diagram: Diagram,
    refineCallback: (diagram: Diagram, feedback: RefinementFeedback) => Promise<Diagram>
  ): Promise<{ diagram: Diagram; issues: ValidationIssue[]; requiresEscalation: boolean; reasoningLog: string[] }> {
    return this.validateWithRefinement(
      diagram,
      (d) => this.validateDiagramConsistency(d),
      refineCallback,
      `Architect diagram generation (${diagram.type})`
    )
  }

  /**
   * Generate refinement prompt for Architect
   * Helper method to create feedback for the Architect agent
   */
  generateRefinementPrompt(feedback: RefinementFeedback): string {
    const prompt = `The diagram validation found ${feedback.issues.length} issue(s) that need to be addressed:

${feedback.issues.map((issue, idx) => `
${idx + 1}. **${issue.severity.toUpperCase()}**: ${issue.message}
   Affected: ${issue.affectedArtifacts.join(', ')}
   ${issue.suggestedFix ? `Suggested fix: ${issue.suggestedFix}` : ''}
`).join('\n')}

This is refinement iteration ${feedback.iterationCount} of ${this.MAX_REFINEMENT_ITERATIONS}.

Please revise the diagram to address these issues. Focus on:
${feedback.suggestions.map(s => `- ${s}`).join('\n')}

Return the corrected diagram with the same structure.`

    return prompt
  }
}
