import EventEmitter from "eventemitter3";
import * as PIXI from "pixi.js";
import { clamp } from "lodash-es";

import { captionTrack } from "./mock/captionTrack";
import { useTimelineStore } from "./store";

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
export const FRAME_RATE = {
	60: clamp(60 / FPS_60, 1, 3),
	30: clamp(60 / FPS_30, 1, 3),
	24: clamp(60 / FPS_24, 1, 3),
};

let frameCount = 0;

let lastStartTime = 0;

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
export interface EVENT_SEEK {
	elapsedTime: number;
}

export class TimeLineContoller extends EventEmitter {
	#totalDuration = 0;
	#remaningTime = 0;
	#elapsedTime = 0;
	currentCaption?: { start: number; end: number; text: string } | null = null;
	// #startTime: number = 0;
	#speed = 1;
	#FPS = 60;
	#audioVolume = 1;

	#animationCallbacks: (() => void)[] = [];

	#rafId: null | number = null;

	constructor(
		protected options: TimeLineContollerOptions,
		protected app: PIXI.Application,
	) {
		super();
		this.#totalDuration = options.totalDuration;
	}

	get timeMetadata() {
		return {
			totalDuration: this.#totalDuration,
			remaningTime: this.#remaningTime,
			elapsedTime: this.#elapsedTime,
		};
	}

	get caption() {
		return this.currentCaption;
	}

	set audioVolume(volume: number) {
		this.#audioVolume = volume;
		this.emit("audio-volume", volume);
	}
	get audioVolume() {
		return this.#audioVolume;
	}

	/**
	 *
	 * @param currentTime in milli seconds
	 */
	seek(currentTime: number, type?: "control") {
		if (currentTime < 0 || currentTime > this.#totalDuration) {
			throw new Error("Invalid time");
		}

		console.log(`%cSeek ${currentTime}`, "color: green; font-size: 28px;");

		this.#elapsedTime = currentTime;
		this.#remaningTime = clamp(
			this.#totalDuration - this.#elapsedTime,
			0,
			this.#totalDuration,
		);

		lastStartTime = Date.now();
		// if (type === "control" && !this.isPlaying) {
		// 	// this.emit("seek", currentTime);
		// 	// this.emit("seek", {
		// 	// 	elapsedTime: this.#elapsedTime,
		// 	// });
		// 	const stop = this.stop.bind(this);
		// 	let _frames = 30;
		// 	this.on("interal_animation", function animation() {
		// 		_frames--;
		// 		if (_frames === 0) {
		// 			stop();
		// 		}
		// 	});

		// 	this.animate();
		// 	return;
		// }

		if (this.paused || !this.isPlaying) {
			if (this.paused) {
				this.resume();
			} else {
				this.start();
			}
			// this.animate();
		} else if (this.completed) {
			this.animate();
		}

		// TODO: useful??? maybe remove laster
		this.emit("seek", {
			elapsedTime: this.#elapsedTime,
		});
	}

	stop() {
		if (this.#rafId !== null) {
			this.emit("pause");

			console.log(
				"%cstop",
				"color: red; font-size: 20px; font-weight: bold;",
			);
			cancelAnimationFrame(this.#rafId);

			this.app.ticker.stop();

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

	private calibrateTime() {
		const currentTime = Date.now();
		const _delta = currentTime - lastStartTime;

		lastStartTime = currentTime;

		const _deltaWithSpeed = _delta * this.#speed;
		this.#elapsedTime += _deltaWithSpeed;

		this.#elapsedTime = clamp(this.#elapsedTime, 0, this.#totalDuration);

		this.#remaningTime = clamp(
			this.#totalDuration - this.#elapsedTime,
			0,
			this.#totalDuration,
		);
	}

	private animate() {
		this.#rafId && cancelAnimationFrame(this.#rafId);

		this.calibrateTime();

		if (this.#elapsedTime === this.#totalDuration) {
			this.app.ticker.stop();

			this.#rafId = null;

			this.emit("complete");
			this.emit("common-update");
		} else {
			this.#rafId = requestAnimationFrame(this.animate.bind(this));

			const frameRateDivider = clamp(60 / this.#FPS, 1, 3);
			if (frameCount % frameRateDivider === 0) {
				if (frameCount > 1_000_000) {
					frameCount = 0;
				}
				this.app.ticker.update(this.#elapsedTime);
			}
			// updat at last to ensure the rafId is the latest
			this.update();
			frameCount++;
		}

		this.emit("interal_animation");
	}

	start() {
		if (this.#rafId === null) {
			console.log(
				"%cstart",
				"color: rgb(157, 255, 0); font-size: 30px; font-weight: bold;",
			);

			lastStartTime = Date.now();
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

	set speed(speed: number) {
		// this.#startTime = Date.now() - this.#elapsedTime / this.#speed;
		this.#speed = speed;
		this.emit("speed", speed);
	}

	get speed() {
		return this.#speed;
	}

	get FPS() {
		return this.#FPS;
	}

	set FPS(fps: number) {
		this.#FPS = fps;
	}

	resume() {
		if (this.paused) {
			console.log(
				"%cresume",
				"color: red; font-size: 30px; font-weight: bold;",
			);
			lastStartTime = Date.now();

			this.animate();
			this.emit("resume");
			this.emit("common-update");
		}
	}
}
