/* eslint-disable @typescript-eslint/ban-ts-comment */
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import * as PIXI from "pixi.js";
import { createSelectors } from "./createSelectors";
import { TimeLineContoller } from "../Timeline";
import { shallow } from "zustand/shallow";

interface State {
	timeline?: TimeLineContoller;
	app?: PIXI.Application;
	pausedByController: boolean;
	showPoster: boolean;
}

interface Actions {
	setApp: (app: PIXI.Application, duration: number) => void;
	setTimeline: (timeline: TimeLineContoller) => void;
	togglePoster: (show?: boolean) => void;
	reset: () => void;
}

let $timeline: TimeLineContoller | undefined;

const defaultState: Partial<State> = {
	timeline: undefined,
	app: undefined,
	pausedByController: false,
	showPoster: true,
};

export const timelineStore = create(
	subscribeWithSelector<State & Actions>((set, get) => {
		return {
			...defaultState,
			setApp(app, duration) {
				const createTimeline = () => {
					if (!app) return undefined;
					app.stop();
					$timeline = new TimeLineContoller(
						{
							totalDuration: duration,
							onCaptionChange: (caption) => {
								// console.log(caption);
							},
						},
						app,
					);

					return $timeline;
				};
				const timeline = createTimeline();
				set(() => ({ app, timeline }));
			},
			setTimeline(timeline) {
				set(() => ({ timeline }));
			},
			togglePoster(show) {
				if (typeof show === "boolean") {
					set(() => ({ showPoster: show }));
				} else {
					set((state) => ({ showPoster: !state.showPoster }));
				}
			},
			reset: () => {
				set(defaultState);
			},
		};
	}),
);

export const useTimelineStore = createSelectors(timelineStore);
