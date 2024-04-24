import {
	AudioTrack,
	CaptionTrack,
	VMMLTemplateV4,
	VideoTrack,
} from "@/interface/vmml";
import MainVideoTrack from "../video-tracks/VideoTrack";
import { Stage, useApp } from "@pixi/react";
import {
	CSSProperties,
	FC,
	useDeferredValue,
	useEffect,
	useMemo,
	useTransition,
} from "react";
import { useTimelineStore } from "@/store";

import SoundTrackNew from "../audio-track/new";
import * as PIXI from "pixi.js";
import TimeControlV2 from "@/components/Controller/index-2";
import { calculatRectByObjectFit } from "@/util";
import { useTezignPlayerStore } from "@/store/teizng-player";
import { useEventListener, useSize, useUnmount } from "ahooks";
import CaptionTrackComponent from "../caption-track";
import VideoPoster from "@/VideoPoster";
import { FloatButton, Spin, message } from "antd";
import { usePoster } from "./usePoster";
import { BasicTarget } from "ahooks/lib/utils/domTarget";
import CaptionEditor from "../caption-editor";
import { useDelayLoading } from "@/hooks/useDelayLoading";
import styles from "./index.module.css";
import classNames from "classnames";
import { defaults } from "lodash-es";

const SetUpHook: FC<{
	duration: number;
}> = ({ duration }) => {
	const app = useApp();

	useEffect(() => {
		useTimelineStore.getState().setApp(app, duration);
	}, [app, duration]);

	useUnmount(() => {
		const timeline = useTimelineStore.getState().timeline;
		if (timeline) {
			timeline.stop();
		}
	});

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
	poster?: {
		url: string;
		objectFit?: CSSProperties["objectFit"];
	};
	backgroundColor?: string;
	preloadStategy?: {
		duration?: number;
		numberOfFutureClips?: number;
	};
};

export const TezignPlayer: FC<TezignPlayerProps> = ({
	vmml,
	height: pHeight,
	width: pWidth,
	container,
	poster: _poster,
	backgroundColor = "#000000f3",
}) => {
	if (!vmml) {
		throw new Error("No vmml found");
	}

	const {
		containerRect: { height, width },
		setRect,
	} = useTezignPlayerStore();
	const showCaptionEditor = useTezignPlayerStore.use.showCaptionEditor(true);

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

	useUnmount(() => {
		useTimelineStore.getState().togglePoster(true);
	});

	useEffect(() => {
		if (document.fullscreenElement) return;
		if (!pRect?.height || !pRect?.width) {
			return;
		}
		setRect(pRect.width, pRect.height);
	}, [pRect]);

	/**
	 * transform the stage rect to fit the outer html element container
	 */
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

	// const sourceUrl = useDeferredValue(
	// 	videoTracks[0]?.clips[0].videoClip?.sourceUrl,
	// );

	// const { poster } = usePoster(_poster?.url ? undefined : sourceUrl);

	// const mergedPoster = useMemo(() => {
	// 	return defaults({}, _poster, { url: poster, objectFit: "cover" });
	// }, [_poster, poster]);

	const seekLoading = useTezignPlayerStore.use.seekLoading();

	// improve UX, normally seekLoading wouldn't last longer than 250ms
	const isLoading = useDelayLoading({
		loading: seekLoading,
		delay: 250,
	});

	const renderPoster = () => {
		if (_poster?.url) {
			return (
				<VideoPoster
					className={styles["aniamte-fadein"]}
					style={{
						objectFit: _poster?.objectFit ?? "cover",
					}}
					url={_poster.url}
				/>
			);
		}
		return null;
	};

	if (!videoTracks.length) {
		throw new Error("No video track found");
	}

	return (
		<>
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
						backgroundColor,
					}}
					className={classNames(
						"group/container flex items-center justify-center overflow-hidden relative",
						styles["bg-rect-pattern"],
					)}
					id="player-container"
				>
					{/* <ScreenShot /> */}
					{
						<Stage
							onClick={() => {
								window.alert("stage clicked");
							}}
							width={useDeferredValue(transformedRect.width)}
							height={useDeferredValue(transformedRect.height)}
							options={{
								resolution: window.devicePixelRatio || 1,
								autoStart: false,
							}}
						>
							<SetUpHook duration={duration} />
							{videoTracks.map((track) => (
								<MainVideoTrack
									mainTrack={track as VideoTrack}
									stageRect={transformedRect}
								/>
							))}
							{captionTrack && (
								<CaptionTrackComponent
									stageRect={transformedRect}
									captionTrack={captionTrack as CaptionTrack}
								/>
							)}
							{audioTrack && (
								<SoundTrackNew
									audioTrack={audioTrack as AudioTrack}
								/>
							)}
						</Stage>
					}
					{renderPoster()}
					<TimeControlV2 />
					{isLoading && (
						<div className="absolute z-[9999] inset-0 bg-black/50 flex items-center justify-center">
							<Spin
								className="text-teal-500"
								spinning
								tip={"加载中..."}
								size="large"
							/>
						</div>
					)}
				</div>
			</div>
			{captionTrack && (
				<CaptionEditor
					onClose={() => {
						useTezignPlayerStore.setState({
							showCaptionEditor: false,
						});
					}}
					open={showCaptionEditor}
					captionTrack={captionTrack as CaptionTrack}
				/>
			)}
		</>
	);
};
