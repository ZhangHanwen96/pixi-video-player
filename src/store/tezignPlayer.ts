/* eslint-disable @typescript-eslint/ban-ts-comment */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createSelectors } from "./createSelectors";
import { VMMLTemplateV4 } from "@/interface/vmml";

interface State {
	vmml?: VMMLTemplateV4;
	containerRect: {
		width: number;
		height: number;
	};
	loading: boolean;
	seekLoading: boolean;
	showCaptionEditor: boolean;
}

interface Actions {
	setVmml: (vmml: VMMLTemplateV4) => void;
	requestFullScreen: () => void;
	exitFullScreen: () => void;

	setRect: (width: number, height: number) => void;

	finishPreloading: () => void;
	startPreloading: () => void;
	startSeekLoading: () => void;
	finishSeekLoading: () => void;
	reset: () => void;
}

const defaultState: State = {
	vmml: undefined,
	showCaptionEditor: false,
	loading: false,
	seekLoading: false,
	containerRect: {
		width: 800,
		height: 450,
	},
};

export const tezignPlayerStore = create(
	subscribeWithSelector<State & Actions>((set, get) => {
		return {
			...defaultState,
			reset: () => {
				set(() => defaultState);
			},
			setVmml(vmml) {
				set(() => ({ vmml }));
			},

			startSeekLoading: () => {
				set(() => ({ seekLoading: true }));
			},
			finishSeekLoading: () => {
				set(() => ({ seekLoading: false }));
			},

			setRect(width, height) {
				set(() => ({
					containerRect: {
						width,
						height,
					},
				}));
			},
			requestFullScreen: () => {
				const container = document.getElementById(
					"tz-player-container",
				);
				if (!container) return;
				// @ts-ignore
				if (container.requestFullscreen) {
					container.requestFullscreen();
					// @ts-ignore
				} else if (container.mozRequestFullScreen) {
					// @ts-ignore
					container.mozRequestFullScreen();
					// @ts-ignore
				} else if (container.webkitRequestFullscreen) {
					// @ts-ignore
					container.webkitRequestFullscreen();
					// @ts-ignore
				} else if (container.msRequestFullscreen) {
					// @ts-ignore
					container.msRequestFullscreen();
				}
			},
			exitFullScreen: () => {
				if (document.exitFullscreen) {
					document.exitFullscreen();
					// @ts-ignore
				} else if (document.mozCancelFullScreen) {
					// @ts-ignore
					document.mozCancelFullScreen();
					// @ts-ignore
				} else if (document.webkitExitFullscreen) {
					// @ts-ignore
					document.webkitExitFullscreen();
					// @ts-ignore
				} else if (document.msExitFullscreen) {
					// @ts-ignore
					document.msExitFullscreen();
				}
			},
			startPreloading: () => {
				// set(() => ({
				//     loading: true,
				// }));
				// useTimelineStore.getState().timeline?.stop();
			},
			finishPreloading: () => {
				// set(() => ({
				//     loading: false,
				// }));
				// useTimelineStore.getState().timeline?.resume();
			},
		};
	}),
);

export const useTezignPlayerStore = createSelectors(tezignPlayerStore);
