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

console.log(mockCaption, "mockCaption");

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
        this.emit("seek", currentTime);
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

            // this.#remaningTime = Math.max(
            //     this.#totalDuration - (Date.now() - this.#startTime),
            //     0
            // );

            // this.#elapsedTime = Math.max(0, Date.now() - this.#startTime);
            console.log(this.#remaningTime, "this.#remaningTime");
            this.emit("pause");
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
