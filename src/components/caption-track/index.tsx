/* eslint-disable react-refresh/only-export-components */
import { FC, memo, useEffect, useRef, useState } from "react";
import { Text } from "@pixi/react";
import * as PIXI from "pixi.js";
import { EVENT_UPDATE } from "@/Timeline";
import { useTimelineStore } from "@/store";
import { $on } from "@/event-utils";
import { CaptionTrack } from "@/interface/vmml";

interface CaptionTrackProps {
    stageRect: any;
    captionTrack: CaptionTrack;
}

export const Caption: FC<CaptionTrackProps> = ({ stageRect, captionTrack }) => {
    const { timeline } = useTimelineStore();

    const [text, setText] = useState("");
    const textRef = useRef<PIXI.Text | null>(null);
    const captionClipRef = useRef<CaptionTrack["clips"][number]>();

    useEffect(() => {
        if (!timeline) return;

        return $on(
            "update",
            (event: EVENT_UPDATE) => {
                const currentCaption = captionTrack.clips.find((clip) => {
                    const start = clip.inPoint / 1_000;
                    const end = (clip.inPoint + clip.duration) / 1_000;
                    return (
                        event.elapsedTime >= start &&
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        event.elapsedTime <= end
                    );
                });

                if (captionClipRef.current?.id !== currentCaption?.id) {
                    captionClipRef.current = currentCaption;
                    setText(captionClipRef.current?.textClip.textContent ?? "");
                }
            },
            timeline
        );
    }, [timeline, ...captionTrack.clips.map((c) => c.id)]);

    const yOffset = captionClipRef.current?.textClip.posParam.centerY ?? 0.8;

    return (
        <Text
            anchor={{
                x: 0.5,
                y: 0,
            }}
            x={stageRect.width / 2}
            y={stageRect.height * yOffset - 16}
            ref={textRef}
            text={text}
            style={
                new PIXI.TextStyle({
                    align: "center",
                    fontFamily: "Helvetica, sans-serif",
                    fontSize: 24,
                    // fontWeight: "400",
                    fill: "#ffffff", // gradient
                    // stroke: "#01d27e",
                    // strokeThickness: 5,
                    // letterSpacing: 12,
                    // dropShadow: true,
                    // dropShadowColor: "#ccced2",
                    dropShadowBlur: 4,
                    dropShadowAngle: Math.PI / 6,
                    dropShadowDistance: 6,
                    wordWrap: true,
                    wordWrapWidth: stageRect.width,
                    lineHeight: 32,
                })
            }
        ></Text>
    );
};

export default memo(Caption);
