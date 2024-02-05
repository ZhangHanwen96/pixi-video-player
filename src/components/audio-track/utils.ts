import { AudioTrack } from "@/interface/vmml";
/**
 *
 * @param currentTime in milli seconds
 * @param track
 */
export const seekAudio = (currentTime: number, track: AudioTrack) => {
	const found = track.clips.find(({ inPoint, duration }) => {
		const endPoint = inPoint + duration;
		return (
			currentTime >= inPoint / 1_000 && currentTime <= endPoint / 1_000
		);
	});

	return found;
};
