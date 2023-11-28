import React, { useContext, useEffect, useRef, useState } from "react";
import { useApp, Text, Container } from "@pixi/react";
import mockCaption from "./mockCaption";
import * as PIXI from "pixi.js";
import { useCreation } from "ahooks";
import { EVENT_UPDATE } from "./Timeline";
import { useTimelineStore } from "./store";

export const Caption = () => {
    const { timeline } = useTimelineStore();

    const textRef = useRef<PIXI.Text | null>(null);

    const captionRef = useRef("");

    useEffect(() => {
        if (!textRef.current || !timeline) return;

        textRef.current.text = timeline.caption?.text ?? "";

        let handler: any;
        timeline?.on(
            "update",
            (handler = (event: EVENT_UPDATE) => {
                if (captionRef.current !== event.caption?.text) {
                    textRef.current!.text = event.caption?.text ?? "";
                    // textRef.current!.updateText(true);
                    console.log(event.caption?.text, "caption");
                }
            })
        );

        return () => {
            timeline?.off("captionChange", handler);
        };
    }, [timeline]);

    return (
        <Text
            anchor={{
                x: 0.5,
                y: 0,
            }}
            x={400}
            y={480}
            ref={textRef}
            text={""}
            style={
                new PIXI.TextStyle({
                    align: "center",
                    // fontFamily:
                    //     '"Source Sans Pro", Helvetica, sans-serif',
                    fontSize: 24,
                    // fontWeight: "400",
                    fill: "#cc0d0d", // gradient
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
        // </Container>
    );
};

export default Caption;
