import { REST, Routes } from 'discord.js';

import { commands } from '~/commands/index.ts';
import { env } from '~/env.ts';

const rest = new REST().setToken(env.BOT_TOKEN);
const body = [...commands.values()].map((c) => c.data.toJSON());

const route =
	env.NODE_ENV === 'development'
		? Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID)
		: Routes.applicationCommands(env.CLIENT_ID);

const data = (await rest.put(route, { body })) as unknown[];

console.log(
	env.NODE_ENV === 'development'
		? `Registered ${data.length} slash commands in guild ${env.GUILD_ID}.`
		: `Registered ${data.length} slash commands globally.`,
);
