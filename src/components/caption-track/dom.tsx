import { EVENT_UPDATE, TimelineEventTypes } from "@/Timeline";
import { $on } from "@/event-utils";
import { StageRect } from "@/interface/app";
import { CaptionTrack } from "@/interface/vmml";
import { useTimelineStore } from "@/store";
import { useForceUpdate } from "@mantine/hooks";
import { useDeepCompareEffect } from "ahooks";
import EventEmitter from "eventemitter3";
import * as PIXI from "pixi.js";
/* eslint-disable react-refresh/only-export-components */
import {
	CSSProperties,
	FC,
	memo,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import TextClip210 from "./text-clip_210";
import { argb2Rgba } from "./utils";

interface CaptionTrackProps {
	stageRect: StageRect;
	captionTrack: CaptionTrack;
}

export const Caption: FC<CaptionTrackProps> = ({ stageRect, captionTrack }) => {
	const timeline = useTimelineStore.use.timeline?.();

	const textRef = useRef<string>("");
	const captionClipRef = useRef<CaptionTrack["clips"][number]>();
	const forceUpdate = useForceUpdate();

	useDeepCompareEffect(() => {
		if (!timeline) {
			captionClipRef.current = undefined;
			textRef.current = "";
			return;
		}

		return $on(
			"update",
			(event: EVENT_UPDATE) => {
				const currentCaption = captionTrack.clips.find((clip) => {
					const start = clip.inPoint / 1_000;
					const end = (clip.inPoint + clip.duration) / 1_000;
					return (
						event.elapsedTime >= start &&
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						event.elapsedTime <= end
					);
				});

				if (captionClipRef.current?.id !== currentCaption?.id) {
					captionClipRef.current = currentCaption;
					const text =
						captionClipRef.current?.textClip.textContent ?? "";
					textRef.current = text;

					forceUpdate();
				}
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline, ...captionTrack.clips.map((c) => c.id)]);

	/** properties */
	const centerY = captionClipRef.current?.textClip.posParam.centerY ?? 0.5;
	const centerX = captionClipRef.current?.textClip.posParam.centerX ?? 0.5;
	const fontSize = captionClipRef.current?.textClip.dimension?.height ?? 24;

	const fontFamily =
		captionClipRef.current?.textClip.fontFamily ||
		"Arial, Helvetica, sans-serif";
	const textColor = captionClipRef.current?.textClip.textColor
		? argb2Rgba(captionClipRef.current?.textClip.textColor)
		: undefined;
	const strokeColor = captionClipRef.current?.textClip.strokeColor
		? argb2Rgba(captionClipRef.current?.textClip.strokeColor)
		: undefined;
	const strokeWidth = captionClipRef.current?.textClip.strokeWidth;
	const italic = captionClipRef.current?.textClip.italic;
	const bold = captionClipRef.current?.textClip.bold;
	const letterSpacing = captionClipRef.current?.textClip.letterSpacing;
	const backgroundColor = captionClipRef.current?.textClip.backgroundColor
		? argb2Rgba(captionClipRef.current?.textClip.backgroundColor)
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

	if (!textRef.current) {
		return null;
	}
	if (captionClipRef.current?.type === 210) {
		return (
			<TextClip210
				clip={captionClipRef.current as any}
				stageRect={stageRect}
			/>
		);
	}

	return (
		// stage size container
		<div
			style={{
				pointerEvents: "none",
				position: "absolute",
				top: 0,
				left: `calc(${stageRect.x || 0}px)`,
				width: stageRect.width,
				height: stageRect.height,
				zIndex: 99,
			}}
		>
			{/* position container */}
			<div
				style={{
					transform: "translate(-50%, 0%)",
					left: `${centerX * 100}%`,
					top: `${centerY * 100}%`,
					position: "absolute",
					...customStyles,
					width: "80%",
				}}
			>
				{/* adjust scale container */}
				<div
					style={{
						width: `calc(100% / ${stageRect.scale})`,
						transform: `scale(${stageRect.scale})`,
						transformOrigin: "left top",
					}}
				>
					<span>{textRef.current}</span>
				</div>
			</div>
		</div>
	);
};

export default memo(Caption);
