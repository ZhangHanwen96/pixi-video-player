import { EasingFunction, interpolate } from "@/easing";
import { TransitionCode, TransitionParam } from "@/interface/animation";
import { easings } from "@react-spring/web";
import { VideoTrack } from "@/interface/vmml";
import { clamp } from "lodash-es";

// const a = createInterpolator({
//     easing: easings.
// } as InterpolatorConfig<number>)

const transitionCodeMap: Record<
	TransitionCode,
	{
		type: "intro" | "outro";
		default: unknown;
	}
> = {
	crossfadein: {
		type: "intro",
		default: {
			easings: easings.easeInSine,
		},
	},
	crossfadeout: {
		type: "outro",
		default: {
			easings: easings.easeOutSine,
		},
	},
	slide_in: {
		type: "intro",
		default: {
			easings: easings.easeInSine,
		},
	},
	slide_out: {
		type: "outro",
		default: {
			easings: easings.easeOutSine,
		},
	},
	scale_in: {
		type: "intro",
		default: {
			easings: easings.easeInSine,
		},
	},
	scale_out: {
		type: "outro",
		default: {
			easings: easings.easeOutSine,
		},
	},
	circle_in: {
		type: "intro",
		default: {
			easings: easings.easeInSine,
		},
	},
	circle_out: {
		type: "outro",
		default: {
			easings: easings.easeOutSine,
		},
	},
	glitch: {
		type: "outro",
		default: {
			easings: easings.easeInSine,
		},
	},
	radial_blur_in: {
		type: "intro",
		default: {
			easings: easings.easeInSine,
		},
	},
	radial_blur_out: {
		type: "outro",
		default: {
			easings: easings.easeOutSine,
		},
	},
};

const ms = 1_000;

export const isInTransition = (
	clip: VideoTrack["clips"][number],
	transitionParam: TransitionParam,
	elapsedTime: number,
) => {
	const duration = transitionParam.duration / ms;
	const transition = transitionCodeMap[transitionParam.transitionCode];

	let transitionInpoint: number;
	let transitionOutpoint: number;

	if (transition.type === "outro") {
		transitionOutpoint = (clip.inPoint + clip.duration) / ms;
		transitionInpoint = transitionOutpoint - duration;
	} else {
		transitionOutpoint = clip.inPoint / ms + duration;
		transitionInpoint = clip.inPoint / ms;
	}
	return (
		transitionInpoint <= elapsedTime && transitionOutpoint >= elapsedTime
	);
};

export const applyTransition = (options: {
	outputMin: number;
	outputMax: number;
	easing?: EasingFunction;
	clip: VideoTrack["clips"][number];
	transitionParam: TransitionParam;
	elapsedTime: number;
}) => {
	const transition =
		transitionCodeMap[options.transitionParam.transitionCode];

	let transitionInpoint: number;
	let transitionOutpoint: number;

	const { clip, transitionParam, elapsedTime } = options;
	const duration = transitionParam.duration / ms;

	if (transition.type === "intro") {
		transitionOutpoint = clip.inPoint / ms + duration;
		transitionInpoint = clip.inPoint / ms;
	} else {
		transitionOutpoint = (clip.inPoint + clip.duration) / ms;
		transitionInpoint = transitionOutpoint - duration;
	}

	const input = clamp(elapsedTime, transitionInpoint, transitionOutpoint);

	return interpolate(
		input,
		transitionInpoint,
		transitionOutpoint,
		options.outputMin,
		options.outputMax,
		options.easing || (transition.default.easings as EasingFunction),
	);
};
