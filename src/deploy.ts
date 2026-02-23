import { REST, Routes } from 'discord.js';

import { commands } from '~/commands/index.ts';
import { env } from '~/env.ts';

const rest = new REST().setToken(env.BOT_TOKEN);
const body = [...commands.values()].map((c) => c.data.toJSON());

const data = (await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), {
	body,
})) as unknown[];

console.log(`Registered ${data.length} slash commands.`);
