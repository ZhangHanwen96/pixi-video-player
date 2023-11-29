import React, { FC, useContext } from "react";
// import mockCaption from "./mockCaption";
import EventEmitter from "eventemitter3";
import * as PIXI from "pixi.js";
import { useCreation } from "ahooks";
import { clamp } from "lodash-es";
import testsVideo from "./assets/test-video2.mp4";

import { captionTrack } from "./mock/captionTrack";

const mockCaption = captionTrack?.clips.map((clip) => {
    return {
        start: clip.inPoint / 1_000,
        end: (clip.inPoint + clip.duration) / 1_000,
        text: clip.textClip.textContent,
    };
});

const FPS_60 = 60;
const FPS_30 = 30;
const FPS_24 = 24;

/**
 * max 60fpx min 20fps
 */
const FRAME_RATE = {
    60: clamp(60 / FPS_60, 1, 3),
    30: clamp(60 / FPS_30, 1, 3),
    24: clamp(60 / FPS_24, 1, 3),
};

let count = 0;
// const raf = function (callback) {
//     const currTime = new Date().getTime();
//     const timeToCall = Math.max(0, 16 - (currTime - lastTime));
//     const id = window.setTimeout(function () {
//         callback(currTime + timeToCall);
//     }, timeToCall);
//     lastTime = currTime + timeToCall;
//     return id;
// };

// const cancelRaf = function (id) {
//     clearTimeout(id);
// };

interface TimeLineContollerOptions {
    totalDuration: number;
    onCaptionChange: (caption?: string) => void;
}

export interface EVENT_UPDATE {
    elapsedTime: number;
    remaningTime: number;
    totalDuration: number;
    progress: number;
    caption: { start: number; end: number; text: string } | null;
}

export class TimeLineContoller extends EventEmitter {
    #totalDuration = 0;
    #remaningTime = 0;
    #elapsedTime = 0;
    currentCaption?: { start: number; end: number; text: string } | null = null;
    #startTime: number = 0;
    #rafId: null | number = null;

    #speed = 2;

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

        console.log("%c seek", "color: green; font-size: 30px;");

        // console.log(currentTime, "currentTime");

        this.#startTime = Date.now() - currentTime;

        if (this.paused || !this.isPlaying) {
            this.animate();
        } else if (this.completed) {
            this.animate();
        }
        this.emit("seek", currentTime);
    }

    set speed(speed: number) {
        this.#speed = speed;
        this.emit("speed", speed);
    }

    get speed() {
        return this.#speed;
    }

    stop() {
        if (this.#rafId !== null) {
            this.emit("pause");

            console.log(
                "%cstop",
                "color: red; font-size: 20px; font-weight: bold;"
            );
            cancelAnimationFrame(this.#rafId);

            this.#rafId = null;
            this.emit("common-update");
        }
    }

    private update() {
        // step 1: update caption
        const currentCaption = mockCaption.find((caption) => {
            return (
                this.#elapsedTime >= caption.start &&
                this.#elapsedTime <= caption.end
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
            caption: this.currentCaption,
        });

        this.emit("common-update");
    }

    private animate() {
        const currentTime = Date.now();

        const timeDelta = (currentTime - this.#startTime) * this.#speed;

        this.#elapsedTime = clamp(timeDelta, 0, this.#totalDuration);

        this.#remaningTime = clamp(
            this.#totalDuration - this.#elapsedTime,
            0,
            this.#totalDuration
        );

        if (this.#elapsedTime === this.#totalDuration) {
            this.app.ticker.stop();
            this.emit("complete");
            this.emit("common-update");
        } else {
            this.#rafId = requestAnimationFrame(this.animate.bind(this));

            if (count % FRAME_RATE["30"] === 0) {
                if (count > 1_000_000) {
                    count = 0;
                }
                console.log("update");
                this.app.ticker.update(this.#elapsedTime);
                // updat at last to ensure the rafId is the latest
            }
            this.update();
            count++;
        }
    }

    start() {
        if (this.#rafId === null) {
            console.log(
                "%cstart",
                "color: rgb(157, 255, 0); font-size: 30px; font-weight: bold;"
            );
            this.#startTime = Date.now();
            this.animate();
            this.emit("start");
            this.emit("common-update");
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
        if (this.paused) {
            console.log(
                "%cresume",
                "color: red; font-size: 30px; font-weight: bold;"
            );
            this.#startTime = Date.now() - this.#elapsedTime / this.#speed;
            this.animate();
            this.emit("resume");
            this.emit("common-update");
        }
    }
}
