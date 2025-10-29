## Local Development Setup

Follow these steps to run the project locally with Prisma + SQLite sessions API.

### 1) Install dependencies

```bash
pnpm install
```

If prompted about ignored build scripts, you can approve them:

```bash
pnpm approve-builds
```

### 2) Prisma/SQLite setup

- The Prisma schema is at `prisma/schema.prisma` and is preconfigured to use SQLite at `file:./prisma/dev.db`.
- If you prefer using an environment variable instead, switch the datasource `url` to `env("DATABASE_URL")` and create a `.env` file with:

```bash
DATABASE_URL="file:./prisma/dev.db"
```

### 3) Generate Prisma client and apply migrations

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

This will create the SQLite database and the `Session` table with fields: `id`, `name`, `createdAt`, `updatedAt`.

### 4) Run the development server

```bash
pnpm dev
```

Visit the app at `http://localhost:3000`.

## API Endpoints

- `GET /api/sessions` — list sessions
- `POST /api/sessions` — create session `{ name: string }`
- `GET /api/sessions/:id` — get a session by id
- `PATCH /api/sessions/:id` — update session `{ name?: string }`
- `DELETE /api/sessions/:id` — delete a session

## Frontend Integration

The UI component `components/sidebar.tsx` is wired to the API to:

- Load sessions on mount
- Create sessions via the dialog
- Delete sessions from the list
