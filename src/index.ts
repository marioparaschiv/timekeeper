import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';

import { commands } from '~/commands/index.ts';
import { env } from '~/env';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
	const rest = new REST().setToken(env.BOT_TOKEN);
	const body = [...commands.values()].map((cmd) => cmd.data.toJSON());
	await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), { body });
	console.log(`Logged in as ${c.user.tag} — ${body.length} commands registered`);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = commands.get(interaction.commandName);
	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(`Error executing /${interaction.commandName}:`, error);
		const content = 'Something went wrong executing that command.';
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content, flags: 64 });
		} else {
			await interaction.reply({ content, flags: 64 });
		}
	}
});

client.login(env.BOT_TOKEN);
