import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

import { charges } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const charge = {
	data: new SlashCommandBuilder()
		.setName('charge')
		.setDescription('Add a flat USD charge to the next invoice')
		.addNumberOption((o) => o.setName('amount').setDescription('Amount in USD (e.g. 25.50)').setRequired(true))
		.addStringOption((o) => o.setName('description').setDescription('What the charge is for').setRequired(true)),

	async execute(interaction: ChatInputCommandInteraction) {
		const guildId = interaction.guildId;
		if (!guildId) {
			await interaction.reply({
				content: 'This command can only be used in a server.',
				flags: 64,
			});
			return;
		}

		const amount = interaction.options.getNumber('amount', true);
		const description = interaction.options.getString('description', true);
		const amountCents = Math.round(amount * 100);

		await db.insert(charges).values({
			guildId,
			userId: interaction.user.id,
			amountCents,
			description,
			createdAt: new Date(),
		});

		await interaction.reply({
			content: `Charge added: ${description} — $${(amountCents / 100).toFixed(2)}`,
			flags: 64,
		});
	},
};
