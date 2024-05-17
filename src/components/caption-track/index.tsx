import { EVENT_UPDATE, TimelineEventTypes } from "@/Timeline";
import { $on } from "@/event-utils";
import useLoadFont from "@/hooks/useLoadFont";
import { StageRect } from "@/interface/app";
import { CaptionTrack, Font, TextClip210 } from "@/interface/vmml";
import { useTimelineStore } from "@/store";
import { useForceUpdate } from "@mantine/hooks";
import { Container, Graphics, Text } from "@pixi/react";
import { useDeepCompareEffect } from "ahooks";
import EventEmitter from "eventemitter3";
import { uniqBy } from "lodash-es";
import * as PIXI from "pixi.js";
/* eslint-disable react-refresh/only-export-components */
import {
	FC,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { argb2Rgba } from "./utils";

interface CaptionTrackProps {
	stageRect: StageRect;
	captionTrack: CaptionTrack;
}

export const Caption: FC<CaptionTrackProps> = ({ stageRect, captionTrack }) => {
	const timeline = useTimelineStore.use.timeline?.();

	const textRef = useRef<PIXI.Text | null>(null);
	const graphicsRef = useRef<PIXI.Graphics | null>(null);
	const captionClipRef = useRef<CaptionTrack["clips"][number]>();
	const forceUpdate = useForceUpdate();

	const timerRef = useRef<any>();

	const fonts = useMemo(() => {
		const clips210 = captionTrack.clips.filter(({ type }) => type === 210);
		const fonts = clips210.map(
			({ textClip }) => (textClip as TextClip210).fonts,
		);
		if (Array.isArray(fonts)) {
			const flatFonts = fonts.flat() as Font[];
			const dedupedFonts = uniqBy(flatFonts, "fontFamily");
			return dedupedFonts;
		}
		return [];
	}, [captionTrack.clips]);

	useLoadFont({
		fonts: [
			{
				fontFamily: "customFont",
				fontSourceUrl:
					"https://static-common.tezign.com/fonts/xinyi.ttf",
			},
		],
	});

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

					forceUpdate();

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
		//  TODO: fontsize <-> size
		fontSize: fontSize,
		fontFamily,
		fill: textColor,
		stroke: strokeColor,
		// TODO:
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
							// TODO: how much padding?
							(stageRect.width / stageRect.scale) * 0.75,
						...customStyles,
					})
				}
				resolution={window.devicePixelRatio || 1}
			/>
		</Container>
	);
};

export default memo(Caption);
