/**
 * API Route: Generate Diagram from Requirements
 * Endpoint for testing the Architect agent diagram generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { ArchitectAgent } from '@/lib/agents/architect'
import { createClient } from '@/lib/supabase/server'
import { initializeAI } from '@/lib/ai'

// Initialize AI on module load
initializeAI()

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { requirementIds, diagramType, projectId } = body

    if (!requirementIds || !Array.isArray(requirementIds) || requirementIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid "requirementIds" field (must be non-empty array)' },
        { status: 400 }
      )
    }

    if (!diagramType || !['class', 'sequence', 'erd'].includes(diagramType)) {
      return NextResponse.json(
        { error: 'Invalid "diagramType" field (must be "class", "sequence", or "erd")' },
        { status: 400 }
      )
    }

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "projectId" field' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch requirements from database
    const { data: artifacts, error: fetchError } = await supabase
      .from('artifacts')
      .select('id, content')
      .eq('project_id', projectId)
      .eq('type', 'requirement')
      .in('id', requirementIds)

    if (fetchError) {
      console.error('Failed to fetch requirements', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch requirements', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!artifacts || artifacts.length === 0) {
      return NextResponse.json(
        { error: 'No requirements found with provided IDs' },
        { status: 404 }
      )
    }

    // Extract requirement content
    const requirements = artifacts.map(artifact => artifact.content)

    // Create Architect agent and generate diagram
    const architect = new ArchitectAgent()
    const startTime = Date.now()
    
    const result = await architect.requirementsToDiagram(
      requirements,
      diagramType,
      projectId,
      user.id
    )
    
    const generationTime = Date.now() - startTime

    // Validate diagram
    const validation = architect.validateDiagram(result.diagram)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Generated diagram failed validation',
          validationErrors: validation.errors,
        },
        { status: 500 }
      )
    }

    // Store diagram in database
    const { data: diagramArtifact, error: insertError } = await supabase
      .from('artifacts')
      .insert({
        project_id: projectId,
        type: 'diagram',
        content: result.diagram,
        metadata: {
          diagramType,
          generationTime,
          sourceRequirements: requirementIds,
        },
        version: 1,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert diagram', insertError)
      return NextResponse.json(
        { error: 'Failed to save diagram', details: insertError.message },
        { status: 500 }
      )
    }

    // Store traceability links
    if (result.traceabilityLinks.length > 0) {
      const links = result.traceabilityLinks.map(link => ({
        source_id: link.sourceId,
        target_id: link.targetId,
        link_type: link.linkType,
        confidence: link.confidence,
        created_by: user.id,
      }))

      const { error: linksError } = await supabase
        .from('traceability_links')
        .insert(links)

      if (linksError) {
        console.error('Failed to insert traceability links', linksError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      diagram: result.diagram,
      diagramArtifact,
      traceabilityLinks: result.traceabilityLinks,
      generationTime,
      validation,
    })
  } catch (error) {
    console.error('Diagram generation failed', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
