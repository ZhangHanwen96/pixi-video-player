import React, { FC } from "react";
import mockCaption from "./mockCaption";
import EventEmitter from "eventemitter3";
import * as PIXI from "pixi.js";
import { useCreation } from "ahooks";
import { clamp } from "lodash-es";
import testsVideo from "./assets/test-video2.mp4";

interface TimeLineContollerOptions {
    totalDuration: number;
    onCaptionChange: (caption?: string) => void;
}

export interface EVENT_UPDATE {
    elapsedTime: number;
    remaningTime: number;
    totalDuration: number;
    progress: number;
}

interface Context {
    timeline?: TimeLineContoller;
    app?: PIXI.Application;
}

export const timeLineCtx = React.createContext<{
    timeline?: TimeLineContoller;
    app?: PIXI.Application;
}>(null as unknown as Context);

export class TimeLineContoller extends EventEmitter {
    #totalDuration = 0;
    #remaningTime = 0;
    #elapsedTime = 0;
    currentCaption?: { start: number; end: number; text: string } | null = null;
    #startTime: number = 0;
    #rafId: null | number = null;
    constructor(
        protected options: TimeLineContollerOptions,
        protected app: PIXI.Application
    ) {
        super();
        this.#totalDuration = options.totalDuration;
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

        // console.log(currentTime, "currentTime");

        this.#startTime = Date.now() - currentTime;

        if (this.paused || !this.isPlaying) {
            this.animate();
        } else if (this.completed) {
            this.animate();
        }
    }

    stop() {
        console.log("stop");
        if (this.#rafId !== null) {
            console.log(
                "%cstop",
                "color: red; font-size: 20px; font-weight: bold;"
            );
            cancelAnimationFrame(this.#rafId);

            this.#rafId = null;

            console.log("this.#rafId", this.#rafId);

            this.#remaningTime = Math.max(
                this.#totalDuration - (Date.now() - this.#startTime),
                0
            );
            this.#elapsedTime = Math.max(0, Date.now() - this.#startTime);
            console.log(this.#remaningTime, "this.#remaningTime");
            this.emit("pause");
            this.emit("common-update");
        }
    }

    private update() {
        // step 1: update caption
        const currentCaption = mockCaption.find((caption) => {
            return (
                this.#elapsedTime >= caption.start * 1000 &&
                this.#elapsedTime <= caption.end * 1000
            );
        });
        if (this.currentCaption !== currentCaption) {
            this.currentCaption = currentCaption || null;
            this.options.onCaptionChange(this.currentCaption?.text);
        }

        this.emit("update", {
            elapsedTime: this.#elapsedTime,
            remaningTime: this.#remaningTime,
            totalDuration: this.#totalDuration,
            progress: clamp(this.#elapsedTime / this.#totalDuration, 0, 1),
        });

        this.emit("common-update");
    }

    private animate() {
        const currentTime = Date.now();

        const delta = currentTime - this.#startTime;

        this.#elapsedTime = clamp(delta, 0, this.#totalDuration);

        this.#remaningTime = clamp(
            this.#totalDuration - delta,
            0,
            this.#totalDuration
        );

        if (this.#elapsedTime === this.#totalDuration) {
            this.app.ticker.stop();
            this.emit("complete");
            this.emit("common-update");
        } else {
            this.update();
            this.app.ticker.update(this.#elapsedTime);
            this.#rafId = requestAnimationFrame(this.animate.bind(this));
        }
    }

    start() {
        if (this.#rafId === null) {
            console.log(
                "%cstart",
                "color: rgb(157, 255, 0); font-size: 12px; font-weight: bold;"
            );
            this.#startTime = Date.now();
            this.animate();
            this.emit("start");
        }
    }

    get isPlaying() {
        return this.#rafId !== null;
    }

    get paused() {
        return !this.isPlaying && this.#remaningTime > 0;
    }

    get completed() {
        return this.#totalDuration === this.#elapsedTime;
    }

    resume() {
        console.log("resume", this.#rafId, this.#remaningTime);
        if (this.paused) {
            console.log(
                "%cresume",
                "color: red; font-size: 20px; font-weight: bold;"
            );
            console.log("resume");
            this.#startTime = Date.now() - this.#elapsedTime;
            this.animate();
            this.emit("resume");
        }
    }
}

let $timeline: TimeLineContoller;

export const TimeLineProvider: FC<{
    app?: PIXI.Application;
    children: React.ReactNode;
}> = ({ children, app }) => {
    const timeline = useCreation(() => {
        if (!app) return undefined;

        app.stop();
        if ($timeline) return $timeline;
        $timeline = new TimeLineContoller(
            {
                totalDuration: 13_176,
                onCaptionChange: (caption) => {
                    // console.log(caption);
                },
            },
            app
        );
        return $timeline;
    }, [app]);

    return (
        <timeLineCtx.Provider
            value={{
                timeline,
                app,
            }}
        >
            {children}
        </timeLineCtx.Provider>
    );
};
