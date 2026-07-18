import {
	Client,
	Events,
	GatewayIntentBits,
	MessageFlags,
	REST,
	Routes,
	type APIApplicationCommand,
} from 'discord.js';

import { startReminders } from '~/reminders.ts';
import { commands } from '~/commands/index.ts';
import { setCommandIds } from '~/messages.ts';
import { handleButton } from '~/buttons.ts';
import { resumeTickers } from '~/ticker.ts';
import { env } from '~/env';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const rest = new REST().setToken(env.BOT_TOKEN);

const isDevelopment = env.NODE_ENV === 'development';

let globalCommandIds = new Map<string, string>();

function commandBody() {
	return [...commands.values()].map((cmd) => cmd.data.toJSON());
}

function idsByName(registered: APIApplicationCommand[]) {
	return new Map(registered.map((cmd) => [cmd.name, cmd.id]));
}

/**
 * Global commands take up to an hour to propagate, so development overwrites a
 * single guild instead to pick changes up immediately.
 */
async function registerCommands(client: Client<true>) {
	if (isDevelopment) {
		const registered = (await rest.put(
			Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
			{ body: commandBody() },
		)) as APIApplicationCommand[];

		setCommandIds(env.GUILD_ID, idsByName(registered));

		return `${registered.length} commands registered in guild ${env.GUILD_ID}`;
	}

	const registered = (await rest.put(Routes.applicationCommands(env.CLIENT_ID), {
		body: commandBody(),
	})) as APIApplicationCommand[];

	// A global command carries the same id in every guild, so each guild the bot
	// is in maps to that one set.
	globalCommandIds = idsByName(registered);

	const guilds = await client.guilds.fetch();
	for (const [guildId] of guilds) setCommandIds(guildId, globalCommandIds);

	return `${registered.length} commands registered globally across ${guilds.size} guild(s)`;
}

client.once(Events.ClientReady, async (c) => {
	try {
		const summary = await registerCommands(c);
		console.log(`Logged in as ${c.user.tag} — ${summary} — db ${env.DATABASE_PATH}`);
	} catch (error) {
		console.error('Failed to register commands:', error);
	}

	startReminders(c);
	resumeTickers(c);
});

client.on(Events.GuildCreate, (guild) => {
	if (isDevelopment) return;

	setCommandIds(guild.id, globalCommandIds);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

	if (interaction.user.id !== env.OWNER_ID) {
		await interaction.reply({
			content: 'You are not authorized to use this bot.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const label = interaction.isButton()
		? `button ${interaction.customId}`
		: `/${interaction.commandName}`;

	try {
		if (interaction.isButton()) {
			await handleButton(interaction);
			return;
		}

		const command = commands.get(interaction.commandName);
		if (!command) return;

		await command.execute(interaction);
	} catch (error) {
		console.error(`Error executing ${label}:`, error);
		try {
			const content = 'Something went wrong executing that command.';
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content, flags: MessageFlags.Ephemeral });
			}
		} catch {}
	}
});

client.login(env.BOT_TOKEN);
