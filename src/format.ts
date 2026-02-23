export function formatDuration(ms: number): string {
	const totalMinutes = Math.floor(ms / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}h${String(minutes).padStart(2, '0')}m`;
}
