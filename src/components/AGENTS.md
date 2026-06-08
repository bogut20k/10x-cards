# Repository Guidelines

Components split by interactivity: static layout goes in `.astro` files; anything needing React state, hooks, or form submission goes in `.tsx` islands. The `ui/` subdirectory holds shadcn/ui primitives (new-york variant); `auth/` holds form-flow components.

## Tripwires

- Always use `cn()` from `@/lib/utils` for class merging — never concatenate Tailwind strings manually.
- React Compiler ESLint rule is set to `error` — components that violate it will fail lint.
- Do not hand-author files into `ui/`; use `npx shadcn@latest add [name]` instead.

## File layout & naming

- PascalCase for all components (`FormField.tsx`, `Banner.astro`). No kebab-case.
- No barrel `index.ts`; import via full alias path (`@/components/auth/FormField`).
- Static/presentational → `.astro` at root. Interactive (state, hooks, form actions) → `.tsx` in a feature subdirectory.

## Adding a new component

- Static: follow `@src/components/Banner.astro` as reference shape.
- Interactive React: follow `@src/components/auth/FormField.tsx` as reference shape.
- Props: declare a named `interface XxxProps`. For HTML-element wrappers, extend `React.ComponentProps<"element">` and intersect with `VariantProps` if variants apply.

## Local conventions

- Named exports for UI primitives (`Button`, `FormField`); default exports for feature/form components (`SignInForm`, `SignUpForm`).
- Imports: use `@/...` alias — no `../../` traversals across feature boundaries.
- No co-located tests exist; no test framework is configured — do not add test files without first setting up Vitest.

See `@CLAUDE.md` for repo-wide build commands, auth routes, and Supabase conventions.
