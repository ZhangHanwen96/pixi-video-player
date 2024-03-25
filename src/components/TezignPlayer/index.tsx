import { AudioTrack, VMMLTemplateV4, VideoTrack } from "@/interface/vmml";
import MainVideoTrack from "../video-tracks/VideoTrack";
import { Stage, useApp } from "@pixi/react";
import { FC, useDeferredValue, useEffect, useMemo, useTransition } from "react";
import { useTimelineStore } from "@/store";

import SoundTrackNew from "../audio-track/new";
import * as PIXI from "pixi.js";
import TimeControlV2 from "@/components/Controller/index-2";
import { calculatRectByObjectFit } from "@/util";
import { useTezignPlayerStore } from "@/store/teizng-player";
import { useEventListener, useSize } from "ahooks";
import CaptionTrack from "../caption-track";
import VideoPoster from "@/VideoPoster";
import { FloatButton, Spin, message } from "antd";
import { usePoster } from "./usePoster";
import { BasicTarget } from "ahooks/lib/utils/domTarget";

const SetUp: FC<{
	duration: number;
}> = ({ duration }) => {
	const app = useApp();
	useEffect(() => {
		useTimelineStore.getState().setApp(app, duration);
	}, [app, duration]);

	return null;
};

const ScreenShot = () => {
	const timeline = useTimelineStore.use.timeline?.(true);

	return (
		<FloatButton
			onClick={async () => {
				if (!timeline || !timeline.app.view.toBlob) {
					message.error("something went wrong...");
					return;
				}
				const { stage, screen } = timeline.app;
				const visibleArea = new PIXI.Rectangle(
					screen.x,
					screen.y,
					screen.width,
					screen.height,
				);
				const url = await timeline.app.renderer.extract.base64(
					stage,
					"image/png",
					1,
					visibleArea,
				);

				const a = document.createElement("a");
				a.href = url;
				a.download = "screen-shot.png";
				a.click();
				a.remove();
			}}
			style={{
				top: 24,
				right: 24,
			}}
		/>
	);
};

type TezignPlayerProps = {
	vmml: VMMLTemplateV4;
	width?: number;
	height?: number;
	container?: BasicTarget;
};

export const TezignPlayer: FC<TezignPlayerProps> = ({
	vmml,
	height: pHeight,
	width: pWidth,
	container,
}) => {
	if (!vmml) {
		throw new Error("No vmml found");
	}

	const {
		containerRect: { height, width },
		setRect,
	} = useTezignPlayerStore();

	const autoTrackSize = typeof container !== "undefined";
	const maybeContainerSize = useSize(container);

	const pRect = useMemo(() => {
		if (autoTrackSize) {
			return maybeContainerSize;
		}
		return {
			width: pWidth,
			height: pHeight,
		};
	}, [container, pWidth, pHeight, maybeContainerSize]);

	useEffect(() => {
		if (document.fullscreenElement) return;
		if (!pRect?.height || !pRect?.width) {
			return;
		}
		setRect(pRect.width, pRect.height);
	}, [pRect]);

	const transformedRect = useMemo(() => {
		const rect = calculatRectByObjectFit(
			{
				containerRect: { width, height },
				sourceRect: vmml.dimension,
			},
			"contain",
		);
		return rect;
	}, [vmml, height, width]);

	const audioTrack = vmml.tracks.find((t) => t.type === 3);
	const captionTrack = vmml.tracks.find((t) => t.type === 2);

	const videoTracks = useMemo(() => {
		return vmml.tracks
			.filter(({ type }) => type === 0 || type === 1)
			.sort((a, b) => a.type - b.type);
	}, [vmml]);

	const duration = useMemo(() => {
		const mainTrack = videoTracks[0];
		if (!mainTrack?.clips.length) return 0;
		const lastClip = mainTrack.clips[mainTrack.clips.length - 1];
		return (lastClip.inPoint + lastClip.duration) / 1_000;
	}, [videoTracks]);

	useEventListener(
		"fullscreenchange",
		() => {
			if (!document.fullscreenElement) {
				useTezignPlayerStore
					.getState()
					.setRect(
						pRect?.width ?? window.innerWidth / 2,
						pRect?.height ?? window.innerHeight / 2,
					);
			} else {
				useTezignPlayerStore
					.getState()
					.setRect(window.outerWidth, window.outerHeight);
			}
		},
		{
			target: document.querySelector("#player-container"),
		},
	);

	const sourceUrl = useDeferredValue(
		videoTracks[0]?.clips[0].videoClip?.sourceUrl,
	);
	const [poster] = usePoster(sourceUrl);

	const seekLoading = useTezignPlayerStore.use.seekLoading();

	if (!videoTracks.length) {
		throw new Error("No video track found");
	}

	return (
		<div
			style={{
				display: "flex",
				position: "relative",
			}}
		>
			<div
				style={{
					width,
					height,
					backgroundColor: "#313131",
				}}
				className="group/container flex items-center justify-center overflow-hidden relative"
				id="player-container"
			>
				<ScreenShot />
				{
					<Stage
						width={useDeferredValue(transformedRect.width)}
						height={useDeferredValue(transformedRect.height)}
						options={{
							resolution: window.devicePixelRatio || 1,
							autoStart: false,
						}}
					>
						<SetUp duration={duration} />
						{videoTracks.map((track) => (
							<MainVideoTrack
								mainTrack={track as VideoTrack}
								stageRect={transformedRect}
							/>
						))}
						{captionTrack && (
							<CaptionTrack
								stageRect={transformedRect}
								captionTrack={captionTrack as any}
							/>
						)}
						{audioTrack && (
							<SoundTrackNew
								audioTrack={audioTrack as AudioTrack}
							/>
						)}
					</Stage>
				}

				{poster && <VideoPoster url={poster} />}
				<TimeControlV2 />
				{seekLoading && (
					<div className="absolute z-[9999] inset-0 bg-black/50 flex items-center justify-center">
						<Spin spinning tip={"加载中..."} size="large" />
					</div>
				)}
			</div>
		</div>
	);
};
