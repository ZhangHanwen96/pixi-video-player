import { EVENT_UPDATE, TimelineEventTypes } from "@/Timeline";
import { $on } from "@/event-utils";
import useLoadFont from "@/hooks/useLoadFont";
import { StageRect } from "@/interface/app";
import {
	CaptionTrack,
	Clip,
	Font,
	TextClip,
	TextClip210,
} from "@/interface/vmml";
import { useTimelineStore } from "@/store";
import { useForceUpdate } from "@mantine/hooks";
import { useDeepCompareEffect } from "ahooks";
import EventEmitter from "eventemitter3";
import { uniqBy } from "lodash-es";
import * as PIXI from "pixi.js";
/* eslint-disable react-refresh/only-export-components */
import {
	CSSProperties,
	FC,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import TextClip210Component from "./text-clip_210";
import { argb2Rgba, mergeWithDefaultStyles } from "./utils";

interface CaptionTrackProps {
	stageRect: StageRect;
	captionTrack: CaptionTrack;
}

export const Caption: FC<CaptionTrackProps> = ({ stageRect, captionTrack }) => {
	const timeline = useTimelineStore.use.timeline?.();

	const textRef = useRef<string>("");
	const captionClipRef = useRef<CaptionTrack["clips"][number]>();
	const forceUpdate = useForceUpdate();

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
		fonts,
	});

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

	if (!textRef.current) {
		return null;
	}

	if (captionClipRef.current?.type === 210) {
		return (
			<TextClip210Component
				clip={captionClipRef.current as any}
				stageRect={stageRect}
			/>
		);
	}

	return (
		<TextClipComponent
			clip={captionClipRef.current as unknown as any}
			stageRect={stageRect}
		/>
	);
};

function TextClipComponent({
	clip,
	stageRect,
}: {
	stageRect: StageRect;
	clip: Clip & { textClip: TextClip };
}) {
	const customStyles = mergeWithDefaultStyles(clip);
	/** properties */
	const centerY = clip.textClip.posParam.centerY ?? 0.5;
	const centerX = clip.textClip.posParam.centerX ?? 0.5;
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
					<span>{clip.textClip.textContent}</span>
				</div>
			</div>
		</div>
	);
}

export default memo(Caption);
