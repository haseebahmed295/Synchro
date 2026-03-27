# Synchro - AI-Native CASE Tool

Synchro is an "Active Architect" Computer-Aided Software Engineering (CASE) tool that leverages an Agentic AI Mesh to automate transitions between Software Development Lifecycle (SDLC) phases. The system maintains bidirectional traceability between Requirements, Design Diagrams, and Code through intelligent agents that react to changes in real-time.

## Features

- **Intelligent Requirements Ingestion**: Extract requirements from text, images (OCR), and PDF documents
- **Automated Diagram Generation**: Generate UML Class, Sequence, and ERD diagrams from requirements
- **Bidirectional Synchronization**: Keep requirements, diagrams, and code in sync automatically
- **Code Generation & Reverse Engineering**: Generate boilerplate code from diagrams and extract diagrams from existing code
- **Real-time Collaboration**: See changes from team members in real-time
- **Traceability Management**: Maintain complete traceability between all artifacts
- **Governance & Validation**: Automated quality checks and Architecture Decision Records (ADRs)

## Tech Stack

- **Frontend & Backend**: Next.js 16.2+ (App Router, API Routes)
- **Styling**: Tailwind CSS, Shadcn/UI
- **Canvas**: React Flow for diagram visualization
- **Database**: Supabase Cloud (PostgreSQL, Auth, Realtime)
- **Intelligence**: LangGraph (agent orchestration), Vercel AI SDK
- **Type Safety**: TypeScript strict mode, Zod validation
- **LLMs**: Claude Sonnet 4.6, Gemini 3 Flash, GPT-5.2, DeepSeek-V3
- **Vector DB**: Pinecone or Qdrant Cloud (semantic search)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Supabase Cloud account
- AI API keys (Anthropic, Google AI, OpenAI, DeepSeek)
- Vector database account (Pinecone or Qdrant)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd synchro
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys and configuration.

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run Biome linter
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
synchro/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes for webhooks and agent orchestration
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   └── ui/               # Shadcn/UI components
├── lib/                   # Utility functions and shared code
├── public/               # Static assets
├── .env.local            # Environment variables (not committed)
├── .env.example          # Environment variables template
├── biome.json            # Biome linter configuration
├── .prettierrc           # Prettier configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Architecture

Synchro follows a hub-and-spoke architecture with Supabase as the central data hub. All modules are loosely coupled and communicate asynchronously through database changes and webhooks.

### Key Components

1. **Module A: The Analyst** - Ingests and structures requirements from various sources
2. **Module B: The Architect** - Generates and maintains design diagrams
3. **Module C: The Implementer** - Generates code and performs reverse engineering
4. **Module D: The Judge** - Validates consistency and enforces governance

## Development Guidelines

- Follow TypeScript strict mode conventions
- Use Biome for linting and Prettier for formatting
- Write tests for all new features
- Maintain 80% code coverage target
- Follow the spec-driven development workflow in `.kiro/specs/synchro/`

## Documentation

- [Requirements Document](.kiro/specs/synchro/requirements.md)
- [Design Document](.kiro/specs/synchro/design.md)
- [Implementation Tasks](.kiro/specs/synchro/tasks.md)

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
