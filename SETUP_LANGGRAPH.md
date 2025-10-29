# LangGraph CSV Agent - Setup Instructions

## Prerequisites

1. Install dependencies:

```bash
pnpm install
# or
npm install
```

2. Set up environment variables in `.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
# Optional:
LLM_MODEL=gpt-4o-mini  # Default: gpt-4o-mini
```

## Database Migration

The Message model has been added to the Prisma schema. Run migrations if needed:

```bash
pnpm prisma migrate dev
```

## Usage

### API Endpoints

1. **Get Messages**: `GET /api/sessions/[id]/messages`

   - Returns all messages for a session

2. **Send Message**: `POST /api/sessions/[id]/messages`

   - Body: `{ "content": "What are the top 5 sales regions?" }`
   - Returns the assistant's response

3. **Stream Messages**: `POST /api/sessions/[id]/messages/stream`
   - Server-Sent Events endpoint for streaming responses

### CSV Analysis Tools

The agent has access to these CSV analysis tools:

- `load_csv_data` - Load and parse CSV files
- `filter_csv_rows` - Filter rows by conditions
- `aggregate_csv_data` - Perform calculations (sum, avg, count, min, max, group_by)
- `filter_and_aggregate_csv_data` - Combined filtering and aggregation
- `get_csv_statistics` - Get descriptive statistics
- `search_csv_text` - Search for text patterns
- `compare_csv_data` - Compare multiple CSV files

## Architecture

The implementation follows the plan in `plans/langgraph-csv-agent-plan.md`:

1. **Message Model**: Added to Prisma schema for conversation persistence
2. **CSV Analysis Service**: Handles CSV parsing, filtering, aggregation
3. **LangGraph Agent**: Single LLM node with tool calling capabilities
4. **Graph Nodes**:
   - `loadCsvMetadata` - Loads CSV metadata (columns, row count)
   - `agent` - Main LLM node with CSV tools
   - `saveMessage` - Persists messages to database
5. **System Prompt**: Dynamically built with CSV resource information

## Next Steps

1. Install dependencies: `pnpm install`
2. Set up OpenAI API key in `.env.local`
3. Test the API endpoints
4. Optionally integrate with UI components
