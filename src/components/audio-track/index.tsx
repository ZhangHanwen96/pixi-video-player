/* eslint-disable react-refresh/only-export-components */
import { Sound, sound } from "@pixi/sound";
import { FC, memo, useEffect, useState } from "react";
import { useTimelineStore } from "@/store";
import { $on, $ons } from "@/event-utils";
import { AudioTrack } from "@/interface/vmml";

const AUDIO_ALIAS = "AUDIO_TRACK";

interface SoundTrackProps {
    audioTrack: AudioTrack;
}

const SoundTrack: FC<SoundTrackProps> = ({ audioTrack }) => {
    const [soundInstance, setInstance] = useState<Sound | null>(null);
    const timeline = useTimelineStore.use.timeline?.();
    const url = audioTrack?.clips[0]?.audioClip?.sourceUrl;

    useEffect(() => {
        if (!url) return;
        const currentAlias = AUDIO_ALIAS + url;
        const audio = sound.add(currentAlias, url);
        audio.autoPlay = false;
        audio.preload = true;
        audio.loop = true;

        setInstance(audio);

        return () => {
            audio.destroy();
            sound.remove(currentAlias);
        };
    }, [url]);

    useEffect(() => {
        if (!soundInstance) return;
        return $on(
            "seek",
            (currentTime: number) => {
                const durationInMS = soundInstance.duration * 1_000;
                const offsetMS = currentTime % durationInMS;

                soundInstance.stop();
                soundInstance.play({
                    start: parseFloat((offsetMS / 1_000).toFixed(2)),
                    loop: true,
                });
            },
            timeline
        );
    }, [soundInstance, timeline]);

    useEffect(() => {
        if (!soundInstance) return;
        soundInstance.speed = timeline?.speed || 1;

        return $on(
            "speed",
            (speed: number) => {
                soundInstance.speed = speed;
            },
            timeline
        );
    }, [timeline, soundInstance]);

    useEffect(() => {
        if (!soundInstance) return;
        return $on(
            "pause",
            () => {
                soundInstance.pause();
            },
            timeline
        );
    }, [soundInstance, timeline]);

    useEffect(() => {
        if (!soundInstance) return;

        return $ons(
            [
                {
                    event: "start",
                    handler: () => {
                        soundInstance.play();
                    },
                },
                {
                    event: "resume",
                    handler: () => {
                        soundInstance.play();
                    },
                },
                {
                    event: "complete",
                    handler: () => {
                        soundInstance.pause();
                    },
                },
                {
                    event: "audio-volume",
                    handler: (volume: number) => {
                        soundInstance.volume = volume;
                    },
                },
            ],
            timeline
        );
    }, [soundInstance, timeline]);

    return null;
};

export default memo(SoundTrack);
