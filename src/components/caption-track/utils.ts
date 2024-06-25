import { CaptionTrack, Clip, TextClip, TextClip210 } from "@/interface/vmml";
import { CSSProperties } from "react";

export const argb2Rgba = (argb: string) => {
	const a = argb.slice(1, 3);

	return `#${argb.slice(3)}${a}`;
};
// -webkit-text-stroke: {{stroke-width}}px transparent;
// background: linear-gradient(90deg, {{stroke-color}}, {{stroke-color}}, {{stroke-color}}, {{stroke-color}}, {{stroke-color}}, {{stroke-color}}, {{stroke-color}}) left top / 100% 100% text;
const getTextStrokeStyle = (strokeColor: string, strokeWitdth: number) => {
	return {
		WebkitTextStroke: `${strokeWitdth}px transparent`,
		strokeWidth: strokeWitdth,
		stroke: "transparent",
		background: `linear-gradient(90deg, ${strokeColor}, ${strokeColor}, ${strokeColor}, ${strokeColor}, ${strokeColor}, ${strokeColor}, ${strokeColor}) left top / 100% 100% text`,
	} as CSSProperties;
};

export const mergeWithDefaultStyles = (
	captionClip: Clip & { textClip: TextClip },
	resolveFontFamily?: (url: string) => string | undefined,
) => {
	const fontSize = captionClip.textClip.dimension?.height ?? 24;
	const fontFamily =
		resolveFontFamily && captionClip.textClip.fontSourceUrl
			? resolveFontFamily(captionClip.textClip.fontSourceUrl)
			: captionClip.textClip.fontFamily || "Arial, Helvetica, sans-serif";
	const textColor = captionClip.textClip.textColor
		? argb2Rgba(captionClip.textClip.textColor)
		: undefined;
	const strokeColor = captionClip.textClip.strokeColor
		? argb2Rgba(captionClip.textClip.strokeColor)
		: undefined;
	const strokeWidth = captionClip.textClip.strokeWidth;
	const italic = captionClip.textClip.italic;
	const bold = captionClip.textClip.bold;
	const letterSpacing = captionClip.textClip.letterSpacing;
	const backgroundColor = captionClip.textClip.backgroundColor
		? argb2Rgba(captionClip.textClip.backgroundColor)
		: undefined;

	const customStyles = {
		fontSize,
		fontFamily,
		color: textColor,
		// stroke
		// stroke: "black",
		// strokeWidth: 1,
		// WebkitTextStrokeColor: "black",
		// WebkitTextStrokeWidth: 1,
		// WebkitTextFillColor: "white",
		fontStyle: italic ? "italic" : "normal",
		fontWeight: bold ? "bold" : "normal",
		letterSpacing,
		backgroundColor,
	} satisfies Partial<CSSProperties>;

	let strokeStyle: CSSProperties | undefined;
	if (typeof strokeColor === "string" && typeof strokeWidth === "number") {
		strokeStyle = getTextStrokeStyle(strokeColor, strokeWidth);
	}

	return {
		style: customStyles,
		strokeStyle,
	};
};
