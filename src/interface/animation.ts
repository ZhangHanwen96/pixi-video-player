export type TransitionCode =
	| "crossfadein"
	| "crossfadeout"
	| "slide_in"
	| "slide_out"
	| "scale_in"
	| "scale_out"
	| "circle_in"
	| "circle_out";

export type TransitionParam = {
	transitionCode: TransitionCode;
	duration: number;
};

export type AudioTransitionCode = "fade_in" | "fade_out";
