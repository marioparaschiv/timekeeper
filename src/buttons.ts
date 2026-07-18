import { EmbedBuilder, type ButtonInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';

import { SETTLE_BUTTON_PREFIX, settledEmbed } from '~/format.ts';
import { billingCycles } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export async function handleButton(interaction: ButtonInteraction) {
	const [prefix, cycleId] = interaction.customId.split(':');
	if (prefix !== SETTLE_BUTTON_PREFIX || !cycleId) return;

	// Discord expires the interaction token after 3 seconds, so acknowledge
	// before touching the database or editing the message.
	await interaction.deferUpdate();

	const cycle = db.select().from(billingCycles).where(eq(billingCycles.id, cycleId)).get();

	if (!cycle) {
		await interaction.followUp({ content: `No invoice with ID \`${cycleId}\`.`, flags: 64 });
		return;
	}

	const settledAt = cycle.settledAt ?? new Date();

	if (!cycle.settledAt) {
		db.update(billingCycles).set({ settledAt }).where(eq(billingCycles.id, cycleId)).run();
	}

	const [existing] = interaction.message.embeds;
	if (!existing) return;

	await interaction.editReply({
		embeds: [settledEmbed(EmbedBuilder.from(existing), settledAt)],
		components: [],
	});
}
