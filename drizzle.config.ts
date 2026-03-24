import { defineConfig } from "drizzle-kit";
import { loadAppEnv } from "./electron/load-env";

const env = loadAppEnv();

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL || "postgresql://localhost:5432/lumen_dev",
  },
});
