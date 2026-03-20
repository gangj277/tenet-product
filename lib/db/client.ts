import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/lumen_dev",
});

export const db = drizzle(pool, { schema });
