function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

export const env = {
	BOT_TOKEN: required('BOT_TOKEN'),
	CLIENT_ID: required('CLIENT_ID'),
	GUILD_ID: required('GUILD_ID'),
	HOURLY_RATE: (() => {
		const rate = Number(required('HOURLY_RATE'));
		if (!Number.isFinite(rate) || rate <= 0)
			throw new Error('HOURLY_RATE must be a positive number');
		return rate;
	})(),
	SOLANA_ADDRESS: required('SOLANA_ADDRESS'),
	OWNER_ID: required('OWNER_ID'),
};
