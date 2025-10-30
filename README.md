## Video Demo

Watch the demo: [Project Video Demo](https://drive.google.com/file/d/1nc_K_PaKXCl92fbsBgAYB4z_LS1Zg2q8/view?usp=sharing)

## Local Development Setup

Follow these steps to run the project locally with Prisma + SQLite sessions API.

### 1) Install dependencies

```bash
npm install
```

### 2) Prisma/SQLite setup

- The Prisma schema is at `prisma/schema.prisma` and is preconfigured to use SQLite at `file:./prisma/dev.db`.
- If you prefer using an environment variable instead, switch the datasource `url` to `env("DATABASE_URL")` and create a `.env` file with:

```bash
DATABASE_URL="file:./prisma/dev.db"
```

### 3) Generate Prisma client and apply migrations

```bash
npx prisma generate
npx prisma migrate dev
```

### 4) Run the development server

```bash
npm run dev
```

## Project Structure

```
ai-intern-project-29-10-2025/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   └── sessions/             # Session API endpoints
│   │       ├── [id]/             # Dynamic session routes
│   │       │   ├── messages/     # Message endpoints
│   │       │   │   ├── route.ts
│   │       │   │   └── stream/   # Streaming endpoint
│   │       │   │       └── route.ts
│   │       │   └── resources/    # Resource endpoints
│   │       │       ├── [resourceId]/
│   │       │       │   ├── download/
│   │       │       │   │   └── route.ts
│   │       │       │   └── route.ts
│   │       │       └── route.ts
│   │       └── route.ts
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                    # React components
│   ├── chat-area.tsx             # Chat interface component
│   ├── chat-layout.tsx           # Chat layout wrapper
│   ├── chat-messages.tsx         # Message display component
│   ├── session-context.tsx       # Session context provider
│   ├── sidebar.tsx               # Sidebar navigation
│   └── theme-provider.tsx        # Theme context provider
├── docs/                         # Documentation
│   ├── csv-resources.md          # CSV resource documentation
│   ├── langgraph.md              # LangGraph architecture docs
│   └── session.md                # Session management docs
├── lib/                          # Library code and utilities
│   ├── csv-analysis-service.ts   # CSV analysis service
│   ├── langgraph/                # LangGraph agent implementation
│   │   ├── agent-state.ts        # Agent state definition
│   │   ├── checkpointer.ts       # State checkpointing
│   │   ├── graph.ts              # Graph definition
│   │   ├── nodes/                # Graph nodes
│   │   │   ├── index.ts
│   │   │   ├── load-csv-metadata-node.ts
│   │   │   ├── model-node.ts
│   │   │   └── should-continue.ts
│   │   ├── tools/                # Agent tools
│   │   │   ├── csv-tools.ts
│   │   │   └── index.ts
│   │   └── system-prompt.ts      # System prompt definition
│   ├── langgraph-agent-service.ts # LangGraph service wrapper
│   ├── message-service.ts        # Message service
│   ├── prisma.ts                 # Prisma client instance
│   ├── resource-service.ts       # Resource service
│   ├── schemas/                  # Zod schemas
│   │   ├── message-with-images.ts
│   │   ├── message.ts
│   │   ├── resource.ts
│   │   └── session.ts
│   ├── session-service.ts        # Session service
│   ├── storage/                  # Storage utilities
│   │   └── disk.ts               # Disk storage implementation
│   ├── types/                    # TypeScript types
│   │   └── message.ts
│   └── utils.ts                  # Utility functions
├── prisma/                       # Prisma ORM configuration
│   ├── migrations/               # Database migrations
│   └── schema.prisma             # Database schema
├── public/                       # Static assets
│   └── placeholder-*.{png,svg,jpg} # Placeholder images
├── script/                       # Utility scripts
│   └── log-checkpoint.ts         # Checkpoint logging utility
├── uploads/                      # Uploaded files storage
│   └── [session-id]/             # Session-specific uploads
│       └── *.csv                 # CSV files
├── components.json               # shadcn/ui configuration
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```
