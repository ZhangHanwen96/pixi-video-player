import { VideoTrack } from "@/interface/vmml";

/**
 *
 * @param currentTime in milli seconds
 * @param track
 */
export const seekVideo = (currentTime: number, track: VideoTrack) => {
    const found = track.clips.find(({ inPoint, duration }) => {
        const endPoint = inPoint + duration;
        return (
            currentTime >= inPoint / 1_000 && currentTime <= endPoint / 1_000
        );
    });

    if (!found) {
        throw new Error("Invalid time");
    }

    return found;
};
