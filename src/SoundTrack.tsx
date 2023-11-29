import * as PIXI from "pixi.js";
import { Sound, sound } from "@pixi/sound";
import { FC, useEffect, useState } from "react";
import { useTimelineStore } from "./store";
import EventEmitter from "eventemitter3";
import { $on, $ons } from "./event-utils";

const AUDIO_ALIAS = "AUDIO_TRACK";

const SoundTrack: FC<{ url: string }> = ({ url }) => {
    const [soundInstance, setInstance] = useState<Sound | null>(null);
    const timeline = useTimelineStore.use.timeline?.();

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
                console.log(parseFloat((offsetMS / 1_000).toFixed(2)), 1111111);
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
            ],
            timeline
        );
    }, [soundInstance, timeline]);

    useEffect(() => {
        if (!soundInstance) return;

        return $on(
            "complete",
            () => {
                soundInstance.pause();
            },
            timeline
        );
    }, [soundInstance, timeline]);

    return null;
};

export default SoundTrack;
