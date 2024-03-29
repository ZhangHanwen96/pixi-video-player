/* eslint-disable react-refresh/only-export-components */
import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { Container, Graphics, Text } from "@pixi/react";
import * as PIXI from "pixi.js";
import { EVENT_UPDATE, TimelineEventTypes } from "@/Timeline";
import { useTimelineStore } from "@/store";
import { $on } from "@/event-utils";
import { CaptionTrack } from "@/interface/vmml";
import { argb2Rgba } from "./utils";
import { StageRect } from "@/interface/app";
import { useDeepCompareEffect } from "ahooks";
import EventEmitter from "eventemitter3";

interface CaptionTrackProps {
	stageRect: StageRect;
	captionTrack: CaptionTrack;
}

export const Caption: FC<CaptionTrackProps> = ({ stageRect, captionTrack }) => {
	const { timeline } = useTimelineStore();

	const textRef = useRef<PIXI.Text | null>(null);
	const graphicsRef = useRef<PIXI.Graphics | null>(null);
	const captionClipRef = useRef<CaptionTrack["clips"][number]>();

	const timerRef = useRef<any>();

	useDeepCompareEffect(() => {
		if (!timeline) {
			clearTimeout(timerRef.current);
			captionClipRef.current = undefined;
			textRef.current!.text = "";
			graphicsRef.current?.clear();
			return;
		}

		return $on(
			"update",
			(event: EVENT_UPDATE) => {
				if (!textRef.current) return;
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
					textRef.current.text = text;

					clearTimeout(timerRef.current);
					if (!text) {
						return graphicsRef.current?.clear();
					}

					timerRef.current = setTimeout(() => {
						if (!graphicsRef.current) {
							return;
						}
						graphicsRef.current.clear();

						if (!captionClipRef.current || !textRef.current) {
							return;
						}

						const bgColor =
							captionClipRef.current.textClip.backgroundColor;
						if (!bgColor) return;

						const bound = textRef.current.getBounds();
						graphicsRef.current.beginFill(argb2Rgba(bgColor), 1);
						graphicsRef.current.drawRoundedRect(
							bound.x - 10,
							bound.y - 10,
							bound.width + 20,
							bound.height + 20,
							5,
						);
					});
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
		: "#ffffff";
	const strokeColor = captionClipRef.current?.textClip.strokeColor
		? argb2Rgba(captionClipRef.current?.textClip.strokeColor)
		: "#000000";
	const strokeWidth = captionClipRef.current?.textClip.strokeWidth ?? 3;
	const italic = captionClipRef.current?.textClip.italic;
	const bold = captionClipRef.current?.textClip.bold;
	const letterSpacing = captionClipRef.current?.textClip.letterSpacing ?? 0;

	const customStyles = {
		fontSize,
		fontFamily,
		fill: textColor,
		stroke: strokeColor,
		strokeThickness: strokeWidth,
		fontStyle: italic ? "italic" : "normal",
		fontWeight: bold ? "bold" : "normal",
		letterSpacing,
	} satisfies Partial<PIXI.ITextStyle>;

	return (
		<Container>
			{/* background */}
			<Graphics ref={graphicsRef} zIndex={100} />
			<Text
				anchor={{
					x: 0.5,
					y: 0,
				}}
				x={stageRect.width * centerX}
				scale={stageRect.scale}
				y={stageRect.height * centerY}
				ref={textRef}
				// text={text}
				zIndex={100}
				style={
					new PIXI.TextStyle({
						align: "center",
						// dropShadow: true,
						// dropShadowColor: "#ccced2",
						// dropShadowBlur: 4,
						// dropShadowAngle: Math.PI / 6,
						// dropShadowDistance: 6,
						// breakWords: true,
						// TODO:
						// textBaseline: "top",
						// padding: 30,
						wordWrap: true,
						lineJoin: "round",
						whiteSpace: "pre",
						breakWords: true,
						wordWrapWidth:
							(stageRect.width / stageRect.scale) * 0.85,
						...customStyles,
					})
				}
				resolution={window.devicePixelRatio || 1}
			/>
		</Container>
	);
};

export default memo(Caption);
