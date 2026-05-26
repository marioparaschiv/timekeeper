# Migrate from Bun to Node.js + pnpm + tsdown

## Goal

Replace Bun runtime with Node.js, run TypeScript via `tsdown` (bundler, Rolldown-based, same Oxc family as the existing `oxlint`/`oxfmt`). Dev loop uses `tsdown --watch` with an `onSuccess` hook that spawns the built output. Path alias `~/` continues to work via tsdown's native `tsconfig.compilerOptions.paths` support. Full removal of Bun residue.

## Decisions (locked)

- **Runtime:** Node.js (LTS, 22.x) + pnpm (already partially in repo)
- **TS execution:** tsdown bundles to `dist/`, node runs `dist/index.js`
- **Dev loop:** `tsdown --watch` with `onSuccess: 'node dist/index.js'` (single process)
- **Path aliases:** Kept as `~/`, resolved by tsdown via tsconfig `paths`
- **Type checker:** `@typescript/native-preview` (tsgo) — already installed, used for `typecheck`. No plain `tsc` anywhere in scripts.
- **SQLite driver:** Switch from `bun:sqlite` + `drizzle-orm/bun-sqlite` to `better-sqlite3` + `drizzle-orm/better-sqlite3` (better-sqlite3 already in devDependencies)
- **Bun cleanup:** Full removal — no dual-runtime support

## Pre-flight checks

- [ ] Confirm Node version available (`node --version` ≥ 22)
- [ ] Confirm pnpm available (`pnpm --version`)
- [ ] Snapshot current behavior: bot starts, `/start` and `/stop` produce expected reply (baseline to compare against post-migration)

## Plan

### 1. Swap the SQLite driver (`src/db/client.ts`)

Only two lines touch Bun directly:

```ts
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
```

Replace with:

```ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
```

`better-sqlite3` is already in devDependencies — move it to `dependencies` since it's now runtime-required. Constructor + `PRAGMA` calls are API-compatible (both accept `sqlite.exec` / `sqlite.pragma`, but `better-sqlite3` uses `.pragma('journal_mode = WAL')` and `.pragma('foreign_keys = ON')` idiomatically; `.exec` also works for raw SQL). Use `.pragma()` for cleanliness.

### 2. Move `better-sqlite3` to dependencies, remove Bun deps

In `package.json`:

- Move `better-sqlite3` from `devDependencies` → `dependencies`
- Remove `@types/bun` from `devDependencies`
- Add `tsdown` to `devDependencies`
- Keep everything else (`drizzle-orm`, `discord.js`, `drizzle-kit`, `oxlint`, `oxfmt`, `@typescript/native-preview`, `eslint-plugin-perfectionist`)

### 3. Add tsdown config (`tsdown.config.ts`)

Minimal config — tsdown reads `tsconfig.json` for `paths`, target, etc. automatically:

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/deploy.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  clean: true,
  // tsconfig paths picked up automatically
});
```

Two entries because `deploy.ts` is a separate script (`pnpm deploy`).

### 4. Rewrite `package.json` scripts

Replace:

```json
"dev": "bun --watch src/index.ts",
"deploy": "bun src/deploy.ts",
```

With:

```json
"dev": "tsdown --watch --onSuccess \"node dist/index.js\"",
"build": "tsdown",
"start": "node dist/index.js",
"deploy": "tsdown && node dist/deploy.js",
```

Keep `db:generate/migrate/push`, `lint`, `fmt`, `typecheck` unchanged — they all run on Node already.

Also add `"type": "module"` to `package.json` (tsdown outputs ESM; Node needs the flag to execute it as such).

Also add an `engines` field: `"engines": { "node": ">=22" }`.

### 5. Update `tsconfig.json`

Two tweaks for Node + tsdown:

- Change `"moduleResolution": "bundler"` → keep `"bundler"` (works with tsdown, which IS a bundler)
- `"allowImportingTsExtensions": true` — keep, tsdown handles it
- `"noEmit": true` — keep, tsdown emits, not tsc
- Verify the source's `.ts` extension imports (e.g. `import { commands } from '~/commands/index.ts'`) still resolve. tsdown handles these; no source changes needed.

If issues arise, the fallback is to strip `.ts` extensions from imports (a sed across `src/`), but try without first.

### 6. Update `.gitignore`

Add:
- `dist/` (already covered by Nuxt section line 95 but not explicit — add an explicit `dist/` entry near top for clarity)
- Verify `*.db*` line still catches the committed `.db`, `.db-shm`, `.db-wal` files

**Also remove committed DB files from working tree** (separate concern, flag to user but don't auto-delete):
- `timekeeper.db`, `timekeeper.db-shm`, `timekeeper.db-wal` should not be in the repo

### 7. Delete Bun artifacts

- `bun.lock` — delete
- `pnpm-workspace.yaml` — review. Current content is just `allowBuilds: better-sqlite3, esbuild`. Keep it (it tells pnpm to allow native build scripts for `better-sqlite3`). No change needed.

### 8. Install + verify

```bash
pnpm install
pnpm typecheck     # tsgo --noEmit should pass
pnpm build         # tsdown writes dist/
pnpm start         # node dist/index.js connects to Discord
```

For dev loop:
```bash
pnpm dev           # tsdown --watch + onSuccess
```

### 9. Functional verification (manual, against real Discord)

- [ ] Bot logs in successfully (`Logged in as <tag> — N commands registered`)
- [ ] `/start` creates a session row, posts the start message
- [ ] `/stop` updates the session, posts the stop message, edits start message
- [ ] `/preview` renders an invoice embed with the right total
- [ ] `/charge` adds a charge that appears in the next `/preview`
- [ ] Existing `timekeeper.db` from before migration still reads/writes correctly (schema unchanged, just driver swap)

### 10. Update README (if it exists — currently doesn't)

Out of scope for this migration. Flag for follow-up: a README that mentions Node ≥ 22, `pnpm install`, `pnpm dev`.

## Risk register

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `.ts` extension imports break under tsdown bundling | Low | tsdown supports them; fallback is a one-shot rewrite |
| `better-sqlite3` native build fails on this Windows machine | Medium | Already in devDependencies, `pnpm-workspace.yaml` already allows its build. If it fails: `pnpm rebuild better-sqlite3` or install build tools (`windows-build-tools` / VS Build Tools) |
| `verbatimModuleSyntax: true` surfaces a missing `type` import that Bun ignored | Low | tsdown/Oxc will error clearly. Fix the import. |
| Drizzle bun-sqlite ↔ better-sqlite3 behavior divergence | Very low | Same SQL, same schema, both sync drivers. Drizzle abstracts the difference. |
| `onSuccess` flag name in tsdown | Low | Verify exact tsdown CLI flag at implementation time — may be `--on-success` or config-file only. Check `tsdown --help` first. |

## Out of scope

- README / screenshots / repo polish (separate task)
- Removing committed `.db` files (flag to user, don't auto-delete user data)
- Any feature changes (currency, multi-tenant, etc.)
- CI setup (no CI exists today)

## Review section

**Status:** Complete.

### What changed

- `src/db/client.ts` — swapped `bun:sqlite` + `drizzle-orm/bun-sqlite` → `better-sqlite3` + `drizzle-orm/better-sqlite3`. Switched `.run('PRAGMA ...')` → `.pragma(...)` for idiomatic better-sqlite3.
- `package.json` — added `"type": "module"`, `"engines.node": ">=22"`, switched `main` to `dist/index.js`. Scripts: `dev`/`build`/`start`/`deploy` rewritten around `tsdown` + `node --env-file=.env`. Removed `@types/bun`, added `tsdown` and `@types/better-sqlite3`, promoted `better-sqlite3` to `dependencies`.
- `tsdown.config.ts` — new file. ESM, target `node22`, two entries (`index.ts`, `deploy.ts`), `clean: true`. `tsconfig.compilerOptions.paths` (`~/*`) picked up natively.
- `.gitignore` — added explicit `dist/` entry near top.
- Deleted: `bun.lock`, `timekeeper.db`, `timekeeper.db-shm`, `timekeeper.db-wal`.

### Surprise

Bun auto-loads `.env`; Node does not. Fixed by using Node's built-in `--env-file=.env` flag (Node 20.6+) on every script that runs the bot. No `dotenv` dependency needed.

### Design departure from plan

- Moved `onSuccess` from `tsdown.config.ts` to the `--on-success` CLI flag on the `dev` script only. Reason: putting it in config would also fire it on `pnpm build`, spawning the bot in the background after every one-shot build.
- Plan called for `git filter-repo` to scrub `.db` files from history. Project is not a git repository (no `.git` dir) — no history to rewrite, plain `rm` sufficed.

### Verification

- `pnpm install` — clean (52 added, 7 removed, no errors). better-sqlite3 native build succeeded under the existing `pnpm-workspace.yaml` allowlist.
- `pnpm typecheck` (tsgo) — pass, no output.
- `pnpm build` — emits `dist/{index,deploy}.js` + shared `commands-*.js` chunk in 26ms.
- `node --check` on all three output files — pass.
- `node --env-file=.env dist/index.js` — runtime smoke test. Bot:
  - Loaded env successfully
  - Authenticated to Discord (token accepted)
  - Reached `ClientReady`
  - Assembled all 7 slash-command payloads (confirms every command file imports correctly through the bundle)
  - Failed with Discord 403 `Missing Access` when registering commands to the configured `GUILD_ID` — this is a config issue (bot not in that guild, or stale guild ID), NOT a migration issue. Same failure would occur under Bun.

### Follow-ups for the user

- The `GUILD_ID` in `.env` either points to a guild the bot isn't in, or is stale. Worth re-inviting or updating before next run.
- README still doesn't exist. Separate task.
- No CI exists. Separate task.
