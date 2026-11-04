/**
 * Crée un compte. L'inscription est fermée sur le site : le premier compte,
 * et tout compte d'administration, naît ici.
 *
 *   npm run user:create -- --pseudo admin --email admin@exemple.fr --admin
 *
 * --email est facultatif.
 *
 * Sans --password, un mot de passe est tiré au hasard et affiché une seule
 * fois. Il n'est jamais réécrit ailleurs : à transmettre puis à oublier.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password.ts";
import { optionalEmailSchema, passwordSchema, pseudoSchema } from "../src/lib/validation.ts";
import { openDatabase, schema } from "./_db.ts";

const { values } = parseArgs({
  options: {
    pseudo: { type: "string" },
    email: { type: "string" },
    password: { type: "string" },
    admin: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!values.pseudo) {
  fail("Usage : npm run user:create -- --pseudo <pseudo> [--email <adresse>] [--password <mdp>] [--admin]");
}

const pseudo = pseudoSchema.safeParse(values.pseudo);
if (!pseudo.success) fail(pseudo.error.issues[0]?.message ?? "Pseudo invalide.");

const email = optionalEmailSchema.safeParse(values.email ?? "");
if (!email.success) fail(email.error.issues[0]?.message ?? "Adresse invalide.");

/** Mot de passe lisible à l'oral, sans caractères ambigus. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

const generated = !values.password;
const password = values.password ?? generatePassword();

if (!generated) {
  const checked = passwordSchema.safeParse(password);
  if (!checked.success) fail(checked.error.issues[0]?.message ?? "Mot de passe invalide.");
}

const { db, sqlite } = openDatabase();

// Unicité insensible à la casse, comme les index de la base.
const clash = db
  .select({ pseudo: schema.users.pseudo, email: schema.users.email })
  .from(schema.users)
  .where(
    email.data === null
      ? sql`lower(${schema.users.pseudo}) = ${pseudo.data.toLowerCase()}`
      : sql`lower(${schema.users.pseudo}) = ${pseudo.data.toLowerCase()} or lower(${schema.users.email}) = ${email.data}`,
  )
  .get();

if (clash) {
  sqlite.close();
  fail(
    email.data !== null && clash.email === email.data
      ? `Un compte utilise déjà l'adresse ${email.data}.`
      : `Le pseudo « ${clash.pseudo} » est déjà pris.`,
  );
}

const id = randomUUID();
db.insert(schema.users)
  .values({
    id,
    pseudo: pseudo.data,
    email: email.data,
    passwordHash: await hashPassword(password),
    role: values.admin ? "ADMIN" : "USER",
  })
  .run();

sqlite.close();

console.log(`\n  Compte créé : ${pseudo.data}${email.data ? ` <${email.data}>` : " (sans adresse)"}${values.admin ? "  [administrateur]" : ""}`);
if (generated) {
  console.log(`  Mot de passe : ${password}`);
  console.log(`\n  Ce mot de passe ne sera plus affiché. À transmettre par un canal sûr.\n`);
} else {
  console.log("");
}
