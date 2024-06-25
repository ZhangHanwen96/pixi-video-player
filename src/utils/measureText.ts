import * as PIXI from "pixi.js";

export const measureTextMetrics = (style: PIXI.TextStyle) => {
	return PIXI.TextMetrics.measureText("Your text", style);
};
