import { CaptionTrack, Clip, TextClip, TextClip210 } from "@/interface/vmml";
import { CSSProperties } from "react";

export const argb2Rgba = (argb: string) => {
	const a = argb.slice(1, 3);

	return `#${argb.slice(3)}${a}`;
};

export const mergeWithDefaultStyles = (
	captionClip: Clip & { textClip: TextClip },
) => {
	const fontSize = captionClip.textClip.dimension?.height ?? 24;
	const fontFamily =
		captionClip.textClip.fontFamily || "Arial, Helvetica, sans-serif";
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
		//  TODO: fontsize <-> size
		fontSize,
		fontFamily,
		color: textColor,
		stroke: strokeColor,
		strokeWidth,
		WebkitTextStrokeColor: strokeColor,
		WebkitTextStrokeWidth: strokeWidth,
		WebkitTextFillColor: strokeColor ? textColor : undefined,
		fontStyle: italic ? "italic" : "normal",
		fontWeight: bold ? "bold" : "normal",
		letterSpacing,
		backgroundColor,
	} satisfies Partial<CSSProperties>;

	return customStyles;
};
