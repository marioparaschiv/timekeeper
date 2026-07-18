<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/clock-dark.svg">
  <img src="assets/clock-light.svg" alt="Timekeeper" width="96" height="96">
</picture>

# Timekeeper

A Discord bot for tracking time-based work and turning it into invoices.

</div>

## About

Timekeeper is built for freelancers and contractors who bill by the hour. You start a session when you begin working, stop it when you're done, and the bot keeps a running ledger of your time. When you're ready to bill the client, one command closes the cycle and posts a clean invoice with every session, every flat charge, and a USDC payment address.

The bot is single-tenant by design. Only the configured owner can run commands, and invoices are scoped per Discord server so the same bot can handle multiple clients without leaking time between them.

## Features

* Per-session time tracking with live "started X minutes ago" timestamps
* Flat charges for fixed-fee items mixed into the same invoice
* Invoice preview before you commit to closing a cycle
* Per-server billing isolation so multiple clients stay separate
* Settlement tracking with a one-click button and reminders for unpaid invoices
* Discord-native output using rich embeds and timestamps
* SQLite storage through Drizzle ORM with a single local database file

## Commands

| Command | Description |
| --- | --- |
| `/start` | Begin a billing session in the current server |
| `/stop` | Stop the active session and log the elapsed time |
| `/charge <amount> <description>` | Add a flat USD charge to the next invoice |
| `/preview` | Show what the current invoice looks like without closing it |
| `/invoice` | Close the billing cycle, post the invoice, and start a fresh one |
| `/invoices [all]` | List invoices grouped by settled and unsettled |
| `/settled <invoice>` | Mark an invoice as paid |

Closed invoices carry a **Mark as Settled** button that only the owner can use. Clicking it records the settlement date, turns the embed green, and removes the button. Anything still unsettled five days after it was invoiced gets a reminder in the channel it was posted in, repeating every five days until it is settled.

`/invoices` shows the last five settled invoices to keep the message readable. Pass `all: true` to include the rest. Unsettled invoices are always listed in full, and the totals cover every invoice whether or not it is shown.

## Recommended channel layout

Group your invoice channels under a single category and keep one active channel for the current cycle. When you close an invoice with `/invoice`, rename `current-invoice` to the closing date and create a fresh `current-invoice` channel for the next cycle. This gives you a clean, scrollable history of past invoices in the sidebar.

```
Invoices
  # current-invoice
  # 15-05-2026
  # 30-04-2026
  # 16-04-2026
```

Each archived channel keeps the full conversation, every session message, and the final invoice embed for that period, which is handy when a client asks about a specific line item months later.

## How it works

Each Discord server you use the bot in is treated as a separate client. Sessions and flat charges accumulate in the database until you run `/invoice`, at which point they are bundled into a billing cycle, totaled at your configured hourly rate, and posted as an embed in the channel. Settled cycles are kept around for history and can be listed any time.

Time is rounded up to the nearest minute, and the final invoice total is rounded up to the nearest whole USDC. All amounts are stored as integers (cents internally, whole USDC on the invoice) to avoid floating-point drift.

## Setup

### Requirements

* Node.js 22 or newer
* pnpm
* A Discord application and bot token

### Installation

```sh
git clone https://github.com/yourname/timekeeper.git
cd timekeeper
pnpm install
```

### Configuration

Copy `.env.example` to `.env` and fill in the values:

```env
BOT_TOKEN=your-discord-bot-token
CLIENT_ID=your-discord-application-id
GUILD_ID=the-server-id-the-bot-runs-in
HOURLY_RATE=75
SOLANA_ADDRESS=your-usdc-receiving-address
OWNER_ID=your-discord-user-id
```

| Variable | Purpose |
| --- | --- |
| `BOT_TOKEN` | Discord bot token from the developer portal |
| `CLIENT_ID` | Application ID for slash command registration |
| `GUILD_ID` | Server ID where commands should be registered |
| `HOURLY_RATE` | Your rate in USD per hour (e.g. `75`) |
| `SOLANA_ADDRESS` | USDC/Solana address shown on invoices |
| `OWNER_ID` | Your Discord user ID. Only this user can run commands |
| `DATABASE_PATH` | Optional. SQLite file to use, defaults to `timekeeper.db` |

### Database

Apply migrations before the first run:

```sh
pnpm db:migrate
```

This uses a custom runner rather than `drizzle-kit migrate`. drizzle wraps each migration in a transaction, and SQLite ignores `PRAGMA foreign_keys=OFF` inside one, so any migration that rebuilds a table other tables reference fails on the `DROP TABLE`. The runner reads the same journal and hashes files identically, so `__drizzle_migrations` records stay compatible.

### Running

For local development with hot reload:

```sh
pnpm dev
```

For a production build:

```sh
pnpm build
pnpm start
```

A `pm2.config.cjs` is included if you want to run Timekeeper as a managed process:

```sh
pnpm build
pm2 start pm2.config.cjs
```

## Tech Stack

* TypeScript on Node 22
* [discord.js](https://discord.js.org/) for the Discord gateway and slash commands
* [Drizzle ORM](https://orm.drizzle.team/) over [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
* [tsdown](https://github.com/rolldown/tsdown) for builds
* [oxlint](https://oxc.rs/) and [oxfmt](https://oxc.rs/) for linting and formatting

## Project Layout

```
src/
  commands/        Slash command handlers
  db/              Drizzle schema and client
  buttons.ts       Button interaction handling
  deploy.ts        One-off command registration script
  env.ts           Environment variable parsing
  format.ts        Invoice math and embed formatting
  index.ts         Bot entrypoint
  messages.ts      Discord message helpers
  migrate.ts       Migration runner
  reminders.ts     Unsettled invoice reminders
```

## License

GPL-3.0. See [LICENSE](LICENSE) for the full text.
