import type { Client } from 'discord.js';

export function discordTimestamp(date: Date, style: 'R' | 't' | 'T' | 'f' = 'R') {
	return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

export async function editStartMessage(client: Client, startMessageUrl: string) {
	const match = startMessageUrl.match(/channels\/(\d+)\/(\d+)\/(\d+)$/);
	if (!match) return;

	const [, guildId, channelId, messageId] = match;

	try {
		const guild = await client.guilds.fetch(guildId!);
		const channel = await guild.channels.fetch(channelId!);
		if (!channel?.isTextBased()) return;

		const message = await channel.messages.fetch(messageId!);
		await message.edit({ content: 'Session started.' });
	} catch {
		// Start message may have been deleted
	}
}
