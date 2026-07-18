import type { Client } from 'discord.js';

/** Guild-scoped commands get a distinct id per guild, so mentions built from
 * another guild's id render as plain text. */
const commandIdsByGuild = new Map<string, Map<string, string>>();

export function setCommandIds(guildId: string, ids: Map<string, string>) {
	commandIdsByGuild.set(guildId, ids);
}

export function discordTimestamp(date: Date, style: 'R' | 'D' | 'd' | 't' | 'T' | 'f' = 'R') {
	return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

export function stopMention(guildId: string) {
	const id = commandIdsByGuild.get(guildId)?.get('stop');
	return id ? `</stop:${id}>` : '`/stop`';
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
