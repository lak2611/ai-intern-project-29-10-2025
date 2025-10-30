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

Visit the app at `http://localhost:3000`.
