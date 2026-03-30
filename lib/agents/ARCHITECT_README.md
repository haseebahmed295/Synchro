# Architect Agent Documentation

## Overview

The Architect Agent (Module B) is responsible for generating UML and ERD diagrams from requirements and maintaining bidirectional traceability between requirements and diagram elements.

## Features

### 1. Diagram Generation from Requirements
- Supports UML Class diagrams, Sequence diagrams, and ERD diagrams
- Uses Claude Sonnet 4.6 for core reasoning
- Generates unique IDs for all nodes and edges
- Creates traceability links automatically
- Completes generation within 10 seconds per diagram

### 2. Traceability Link Creation
- Analyzes requirement text to identify relevant diagram elements
- Generates confidence scores (0.0 to 1.0) for each link
- Filters out low-confidence links (< 0.6)
- Creates bidirectional relationships

### 3. Diagram Validation
- Validates unique node and edge IDs
- Checks edge references point to existing nodes
- Validates position coordinates are non-negative
- Ensures diagram structure integrity

## Usage

### Basic Usage

```typescript
import { ArchitectAgent } from '@/lib/agents/architect'

const architect = new ArchitectAgent()

// Generate a class diagram from requirements
const result = await architect.requirementsToDiagram(
  requirements,
  'class',
  projectId,
  userId
)

console.log(result.diagram) // Generated diagram
console.log(result.traceabilityLinks) // Automatic traceability links
```

### API Endpoints

#### Generate Diagram

```bash
POST /api/architect/generate-diagram
Content-Type: application/json

{
  "requirementIds": ["req-uuid-1", "req-uuid-2"],
  "diagramType": "class",
  "projectId": "project-uuid"
}
```

Response:
```json
{
  "success": true,
  "diagram": {
    "id": "diagram-uuid",
    "type": "class",
    "nodes": [...],
    "edges": [...]
  },
  "traceabilityLinks": [...],
  "generationTime": 8500,
  "validation": {
    "valid": true,
    "errors": []
  }
}
```

#### Create Traceability Links

```bash
POST /api/architect/create-links
Content-Type: application/json

{
  "requirementIds": ["req-uuid-1", "req-uuid-2"],
  "diagramId": "diagram-uuid",
  "projectId": "project-uuid"
}
```

Response:
```json
{
  "success": true,
  "traceabilityLinks": [...],
  "count": 5,
  "analysisTime": 2300
}
```

## Diagram Types

### Class Diagram
- **Nodes**: Classes with attributes and methods
- **Edges**: Inheritance, association, composition, aggregation, dependency
- **Use Case**: Object-oriented design, system architecture

### Sequence Diagram
- **Nodes**: Actors and lifelines (system components)
- **Edges**: Message flow between components
- **Use Case**: Interaction flows, use case scenarios

### ERD (Entity-Relationship Diagram)
- **Nodes**: Database entities with attributes
- **Edges**: Relationships with cardinality
- **Use Case**: Database schema design, data modeling

## Requirements Mapping

The Architect agent implements the following requirements:

- **7.1**: Analyzes requirements and generates appropriate diagrams
- **7.2**: Supports UML Class, Sequence, and ERD diagrams
- **7.3**: Uses Claude Sonnet 4.6 for core reasoning
- **7.4**: Completes diagram generation within 10 seconds
- **7.5**: Creates traceability links to source requirements
- **7.6**: Assigns unique IDs to all diagram nodes and edges

## Testing

Run the test suite:

```bash
npm test -- lib/agents/__tests__/architect.test.ts
```

Test coverage includes:
- Diagram generation for all diagram types
- Traceability link creation with confidence filtering
- Diagram validation (duplicate IDs, invalid references, invalid positions)
- Error handling for AI service failures

## Implementation Details

### AI Model Configuration
- **Task Type**: `architecture`
- **Model**: Claude Sonnet 4.6 (`claude-sonnet-4-20250514`)
- **Max Tokens**: 8,000
- **Temperature**: 0.5

### Confidence Thresholds
- **High Confidence**: 0.9 (direct generation from requirements)
- **Minimum Threshold**: 0.6 (for traceability link creation)

### Validation Rules
1. All node IDs must be unique within a diagram
2. All edge IDs must be unique within a diagram
3. Edge source and target must reference existing nodes
4. Node positions must have non-negative coordinates

## Database Schema

### Artifacts Table
```sql
INSERT INTO artifacts (
  project_id,
  type,
  content,
  metadata,
  version,
  created_by
) VALUES (
  'project-uuid',
  'diagram',
  '{"id": "...", "type": "class", "nodes": [...], "edges": [...]}',
  '{"diagramType": "class", "generationTime": 8500}',
  1,
  'user-uuid'
);
```

### Traceability Links Table
```sql
INSERT INTO traceability_links (
  source_id,
  target_id,
  link_type,
  confidence,
  created_by
) VALUES (
  'requirement-uuid',
  'diagram-node-id',
  'derives_from',
  0.9,
  'user-uuid'
);
```

## Error Handling

The Architect agent handles the following error scenarios:

1. **AI Generation Failure**: Throws descriptive error with original error message
2. **Invalid Diagram**: Returns validation errors before database write
3. **Missing Requirements**: Returns 404 error from API endpoint
4. **Database Errors**: Logs error and returns 500 with details

## Performance Considerations

- **Target Generation Time**: < 10 seconds per diagram (Requirement 7.4)
- **Typical Generation Time**: 5-8 seconds for class diagrams with 5-10 nodes
- **Traceability Analysis Time**: 2-3 seconds for 10 requirements and 10 nodes

## Future Enhancements

1. **Bidirectional Sync**: Implement `diagramToRequirements` for reverse engineering
2. **Diagram Updates**: Implement `suggestDiagramUpdates` for incremental changes
3. **Auto-Layout**: Implement force-directed or hierarchical layout algorithms
4. **Diagram Consistency**: Implement `validateDiagramConsistency` for UML rules
