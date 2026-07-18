import { EmbedBuilder, type ButtonInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';

import { SETTLE_BUTTON_PREFIX, settledEmbed } from '~/format.ts';
import { billingCycles } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export async function handleButton(interaction: ButtonInteraction) {
	const [prefix, cycleId] = interaction.customId.split(':');
	if (prefix !== SETTLE_BUTTON_PREFIX || !cycleId) return;

	const cycle = await db.select().from(billingCycles).where(eq(billingCycles.id, cycleId)).get();

	if (!cycle) {
		await interaction.reply({ content: `No invoice with ID \`${cycleId}\`.`, flags: 64 });
		return;
	}

	const settledAt = cycle.settledAt ?? new Date();

	if (!cycle.settledAt) {
		await db.update(billingCycles).set({ settledAt }).where(eq(billingCycles.id, cycleId));
	}

	const [existing] = interaction.message.embeds;
	if (!existing) return;

	await interaction.update({
		embeds: [settledEmbed(EmbedBuilder.from(existing), settledAt)],
		components: [],
	});
}
