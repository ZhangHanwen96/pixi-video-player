/* eslint-disable react-refresh/only-export-components */
import React, { memo, useContext, useEffect, useRef, useState } from "react";
import { useApp, Text, Container } from "@pixi/react";
import mockCaption from "./mockCaption";
import * as PIXI from "pixi.js";
import { useCreation } from "ahooks";
import { EVENT_UPDATE } from "./Timeline";
import { useTimelineStore } from "./store";
import { $on } from "./event-utils";

export const Caption = () => {
    const { timeline } = useTimelineStore();

    const [text, setText] = useState("");
    const textRef = useRef<PIXI.Text | null>(null);
    const captionRef = useRef(text);

    useEffect(() => {
        if (!timeline) return;

        return $on(
            "update",
            (event: EVENT_UPDATE) => {
                // if (captionRef.current !== event.caption?.text) {
                // captionRef.current = event.caption?.text ?? "";
                captionRef.current = event.caption?.text ?? "";
                setText(captionRef.current);
                // }
            },
            timeline
        );
    }, [timeline]);

    return (
        <Text
            anchor={{
                x: 0.5,
                y: 0,
            }}
            x={400}
            y={450 * 0.8 - 16}
            ref={textRef}
            text={text}
            style={
                new PIXI.TextStyle({
                    align: "center",
                    fontFamily: "Helvetica, sans-serif",
                    fontSize: 32,
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
                    wordWrapWidth: 800,
                    lineHeight: 34,
                })
            }
        ></Text>
    );
};

export default memo(Caption);
