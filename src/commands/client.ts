import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';

import { guildClients } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const client = {
	data: new SlashCommandBuilder()
		.setName('client')
		.setDescription('Manage who gets mentioned in invoice reminders')
		.addSubcommand((sub) =>
			sub
				.setName('set')
				.setDescription("Set the client mentioned in this server's invoice reminders")
				.addUserOption((opt) =>
					opt.setName('user').setDescription('The client to mention').setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub.setName('clear').setDescription('Stop mentioning a client in this server'),
		)
		.addSubcommand((sub) =>
			sub.setName('show').setDescription('Show the client configured for this server'),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const { guildId } = interaction;

		if (!guildId) {
			await interaction.reply({
				content: 'This command can only be used in a server.',
				flags: 64,
			});
			return;
		}

		const subcommand = interaction.options.getSubcommand(true);

		if (subcommand === 'show') {
			const existing = db
				.select()
				.from(guildClients)
				.where(eq(guildClients.guildId, guildId))
				.get();

			await interaction.reply({
				content: existing
					? `Invoice reminders in this server mention <@${existing.userId}>.`
					: 'No client set for this server. Reminders will not mention anyone.',
				flags: 64,
			});
			return;
		}

		if (subcommand === 'clear') {
			await db.delete(guildClients).where(eq(guildClients.guildId, guildId));

			await interaction.reply({
				content:
					'Cleared. Invoice reminders in this server will no longer mention a client.',
				flags: 64,
			});
			return;
		}

		const user = interaction.options.getUser('user', true);

		await db
			.insert(guildClients)
			.values({ guildId, userId: user.id, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: guildClients.guildId,
				set: { userId: user.id, updatedAt: new Date() },
			});

		await interaction.reply({
			content: `Invoice reminders in this server will now mention <@${user.id}>.`,
			flags: 64,
		});
	},
};
