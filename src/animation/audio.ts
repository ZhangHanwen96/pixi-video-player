import { EasingFunction, easings, interpolate } from "@/easing";
import { AudioTransitionCode } from "@/interface/animation";
import { AudioTrack } from "@/interface/vmml";
import { clamp } from "lodash-es";

const transitionCodeMap: Record<
	AudioTransitionCode,
	{
		type: "intro" | "outro";
		default: {
			easings: EasingFunction;
			range: [number, number];
		};
	}
> = {
	fade_in: {
		type: "intro",
		default: {
			easings: easings.linear,
			range: [0, 1],
		},
	},
	fade_out: {
		type: "outro",
		default: {
			easings: easings.linear,
			range: [1, 0],
		},
	},
};

const ms = 1_000;

export const applyAudioTransition = ({
	transitionCode,
	clip,
	elapsedTime,
	easing,
	duration,
}: {
	transitionCode: AudioTransitionCode;
	clip: AudioTrack["clips"][number];
	elapsedTime: number;
	easing?: EasingFunction;
	duration: number;
}) => {
	const transition = transitionCodeMap[transitionCode];
	let transitionInpoint: number;
	let transitionOutpoint: number;

	let outputMin: number;
	let outputMax: number;
	if (transition.type === "intro") {
		outputMin = transition.default.range[0];
		outputMax = clip.audioClip.volume || transition.default.range[1];
		transitionOutpoint = clip.inPoint / ms + duration;
		transitionInpoint = clip.inPoint / ms;
	} else {
		outputMin = clip.audioClip.volume || transition.default.range[0];
		outputMax = transition.default.range[1];
		transitionOutpoint = (clip.inPoint + clip.duration) / ms;
		transitionInpoint = transitionOutpoint - duration;
	}

	const input = clamp(elapsedTime, transitionInpoint, transitionOutpoint);

	return interpolate(
		input,
		transitionInpoint,
		transitionOutpoint,
		// @ts-ignore
		outputMin,
		// @ts-ignore
		outputMax,
		easing || (transition.default.easings as EasingFunction),
	);
};
