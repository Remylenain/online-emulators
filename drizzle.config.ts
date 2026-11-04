import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit lit la configuration hors du contexte Next : il n'a pas accès au
 * module de validation d'environnement, d'où la lecture directe avec un défaut.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./data/app.db",
  },
  strict: true,
  verbose: true,
});
