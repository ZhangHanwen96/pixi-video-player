export type TransitionCode =
	| "crossfadein"
	| "crossfadeout"
	| "slide_in"
	| "slide_out"
	| "scale_in"
	| "scale_out";

export type TransitionParam = {
	transitionCode: TransitionCode;
	duration: number;
};
