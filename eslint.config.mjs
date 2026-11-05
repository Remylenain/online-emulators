import next from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * ESLint 9, configuration à plat. `next lint` a disparu avec Next 16 : on
 * appelle ESLint directement (`npm run lint`), avec les règles de Next et
 * celles de TypeScript.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "coeurs/**",
      "drizzle/**",
      "data/**",
      "library/**",
      ".claude/**",
      "next-env.d.ts",
      "postcss.config.mjs",
    ],
  },
  ...next,
  ...typescript,
  {
    rules: {
      // Une variable précédée d'un tiret bas est ignorée exprès (reste d'une
      // déstructuration, paramètre imposé par une signature).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Lire le navigateur après le montage (stockage local, type de pointeur,
      // adresse) puis poser un état est ici la bonne façon de garder le rendu
      // serveur et le premier rendu client identiques. La règle le signale à
      // chaque fois : on la garde comme simple avertissement.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Dans les adaptateurs d'émulateur, `module` est le module Emscripten du
    // cœur, pas la variable `module` de Node que vise cette règle.
    files: ["src/lib/emulator/**"],
    rules: { "@next/next/no-assign-module-variable": "off" },
  },
];

export default config;
