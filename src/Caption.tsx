import React, { useState } from "react";
import { useApp, Text, Container } from "@pixi/react";
import mockCaption from "./mockCaption";
import * as PIXI from "pixi.js";
import { useCreation } from "ahooks";

interface TimeLineContollerOptions {
    totalDuration: number;
    onCaptionChange: (caption?: string) => void;
}

export class TimeLineContoller {
    #totalDuration = 0;
    #remaningTime = 0;
    #elapsedTime = 0;
    currentCaption?: { start: number; end: number; text: string } | null = null;
    constructor(
        protected options: TimeLineContollerOptions,
        protected app: PIXI.Application
    ) {
        this.#totalDuration = options.totalDuration;
        this.app.ticker.add(() => {
            this.#elapsedTime += app.ticker.elapsedMS;
            this.#remaningTime = this.#totalDuration - this.#elapsedTime;
            if (this.#remaningTime <= 0) {
                this.stop();
            }

            const currentCaption = mockCaption.find((caption) => {
                return (
                    this.#elapsedTime >= caption.start * 1000 &&
                    this.#elapsedTime <= caption.end * 1000
                );
            });
            if (this.currentCaption !== currentCaption) {
                this.currentCaption = currentCaption || null;
                options.onCaptionChange(this.currentCaption?.text);
            }
        });
    }

    get caption() {
        return this.currentCaption;
    }

    /**
     *
     * @param currentTime in milli seconds
     */
    seek(currentTime: number) {
        if (currentTime < 0 || currentTime > this.#totalDuration) {
            throw new Error("Invalid time");
        }
        this.app.ticker.update(currentTime);
    }

    stop() {
        this.app.ticker.stop();
    }

    start() {
        if (!this.app.ticker.started) {
            this.app.ticker.start();
        }
    }

    resume() {
        if (!this.app.ticker.started) {
            this.app.ticker.start();
        }
    }
}

export const Caption = () => {
    const app = useApp();

    const ref = React.useRef<PIXI.Text>(null);
    const [captionText, setCaption] = useState("");

    useCreation(() => {
        const controller = new TimeLineContoller(
            {
                totalDuration: 45_000,
                onCaptionChange: (caption) => {
                    setCaption(caption || "");
                },
            },
            app
        );
        return controller;
    }, []);

    return (
        <Container width={800} height={150} anchor={0.5} y={650}>
            <Text
                x={400}
                y={450}
                ref={ref}
                text={captionText}
                style={
                    new PIXI.TextStyle({
                        align: "center",
                        // fontFamily:
                        //     '"Source Sans Pro", Helvetica, sans-serif',
                        fontSize: 20,
                        // fontWeight: "400",
                        fill: "#eeeeee", // gradient
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
                    })
                }
            ></Text>
        </Container>
    );
};

export default Caption;
