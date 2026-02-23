import {
	Client,
	Events,
	GatewayIntentBits,
	REST,
	Routes,
	type APIApplicationCommand,
} from 'discord.js';

import { commands } from '~/commands/index.ts';
import { env } from '~/env';

export const commandIds = new Map<string, string>();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
	const rest = new REST().setToken(env.BOT_TOKEN);
	const body = [...commands.values()].map((cmd) => cmd.data.toJSON());
	const registered = (await rest.put(
		Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
		{
			body,
		},
	)) as APIApplicationCommand[];

	for (const cmd of registered) {
		commandIds.set(cmd.name, cmd.id);
	}

	console.log(`Logged in as ${c.user.tag} — ${registered.length} commands registered`);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = commands.get(interaction.commandName);
	if (!command) return;

	if (interaction.user.id !== env.OWNER_ID) {
		await interaction.reply({
			content: 'You are not authorized to use this bot.',
			flags: 64,
		});
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(`Error executing /${interaction.commandName}:`, error);
		try {
			const content = 'Something went wrong executing that command.';
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content, flags: 64 });
			} else {
				await interaction.reply({ content, flags: 64 });
			}
		} catch {}
	}
});

client.login(env.BOT_TOKEN);
