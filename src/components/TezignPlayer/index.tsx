import { AudioTrack, VMMLTemplateV4, VideoTrack } from "@/interface/vmml";
import MainVideoTrack from "../video-tracks/MainVideoTrack";
import { Stage, useApp } from "@pixi/react";
import { FC, useEffect, useMemo, useState } from "react";
import { useTimelineStore } from "@/store";
// import CaptionTrack from "@/CaptionTrack";
import SoundTrack from "../audio-track";
import TimeControlV2 from "@/components/Controller/index-2";
import { calculatRectByObjectFit } from "@/util";
import { useTezignPlayerStore } from "@/store/teizng-player";
import { useEventListener, useMount } from "ahooks";
import CaptionTrack from "../caption-track";
import VideoPoster from "@/VideoPoster";
import { extractFrame } from "@/utils/extractVideoFrame";

const SetUp: FC<{
    duration: number;
}> = ({ duration }) => {
    const app = useApp();
    useEffect(() => {
        useTimelineStore.getState().setApp(app, duration);
    }, [app, duration]);

    return null;
};

interface TezignPlayerProps {
    vmml: VMMLTemplateV4;
    containerRect: { width: number; height: number };
}

export const TezignPlayer: FC<TezignPlayerProps> = ({
    vmml,
    containerRect,
}) => {
    const {
        containerRect: { height, width },
        setRect,
    } = useTezignPlayerStore();

    useEffect(() => {
        setRect(containerRect.width, containerRect.height);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerRect.height, containerRect.width]);

    const transformedRect = useMemo(() => {
        return calculatRectByObjectFit(
            {
                containerRect: { width, height },
                sourceRect: vmml.dimension,
            },
            "contain"
        );
    }, [vmml.dimension, height, width]);

    // TODO: main and sub got reversed
    const mainTrack = vmml.tracks.find((t) => t.type === 1);
    const audioTrack = vmml.tracks.find((t) => t.type === 3);
    const subTrack = vmml.tracks.find((t) => t.type === 0);
    const captionTrack = vmml.tracks.find((t) => t.type === 2);

    const duration = useMemo(() => {
        if (!mainTrack?.clips.length) return 0;
        const lastClip = mainTrack.clips[mainTrack.clips.length - 1];
        return (lastClip.inPoint + lastClip.duration) / 1_000;
    }, [mainTrack]);

    useEventListener(
        "fullscreenchange",
        (e) => {
            if (!document.fullscreenElement) {
                useTezignPlayerStore.getState().setRect(800, 450);
            } else {
                useTezignPlayerStore
                    .getState()
                    .setRect(window.innerWidth, window.outerWidth);
            }
        },
        {
            target: document.querySelector("#player-container"),
        }
    );

    const [poster, setPoster] = useState("");

    useMount(() => {
        const load = async () => {
            const url = mainTrack?.clips[0].videoClip?.sourceUrl;
            if (url) {
                const src = await extractFrame(url, 3);
                setPoster(src);
            }
        };

        load();
    });

    return (
        <div
            style={{
                display: "flex",
                position: "relative",
            }}
        >
            <div
                style={{
                    width,
                    height,
                    backgroundColor: "#2e2d2d",
                }}
                className="group/container flex items-center justify-center overflow-hidden relative"
                id="player-container"
            >
                {!!mainTrack && (
                    <Stage
                        width={transformedRect.width}
                        height={transformedRect.height}
                    >
                        <SetUp duration={duration} />
                        <MainVideoTrack
                            mainTrack={subTrack as VideoTrack}
                            stageRect={transformedRect}
                            vmml={vmml}
                        />
                        <MainVideoTrack
                            mainTrack={mainTrack as VideoTrack}
                            stageRect={transformedRect}
                            vmml={vmml}
                        />

                        <CaptionTrack
                            stageRect={transformedRect}
                            captionTrack={captionTrack as any}
                        />
                        {audioTrack && (
                            <SoundTrack audioTrack={audioTrack as AudioTrack} />
                        )}
                    </Stage>
                )}

                {poster && <VideoPoster url={poster} />}
                <TimeControlV2 />
            </div>
        </div>
    );
};