/**
 * Insère ou met à jour les consoles du site. Idempotent : peut être relancé.
 *
 *   npm run db:seed
 */
import { CONSOLES } from "../src/lib/consoles.ts";
import { openDatabase, schema } from "./_db.ts";

const { db, sqlite } = openDatabase();

for (const console_ of CONSOLES) {
  db.insert(schema.consoles)
    .values({
      slug: console_.slug,
      name: console_.name,
      shortName: console_.shortName,
      hasShoulderButtons: console_.hasShoulderButtons,
      screenWidth: console_.screenWidth,
      screenHeight: console_.screenHeight,
      sortOrder: console_.sortOrder,
    })
    .onConflictDoUpdate({
      target: schema.consoles.slug,
      set: {
        name: console_.name,
        shortName: console_.shortName,
        hasShoulderButtons: console_.hasShoulderButtons,
        screenWidth: console_.screenWidth,
        screenHeight: console_.screenHeight,
        sortOrder: console_.sortOrder,
      },
    })
    .run();

  console.log(`  ${console_.slug.padEnd(4)} ${console_.name}`);
}

console.log(`\n${CONSOLES.length} consoles en base.`);
sqlite.close();
