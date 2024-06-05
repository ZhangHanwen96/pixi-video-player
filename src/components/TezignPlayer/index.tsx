import {
	AudioTrack,
	CaptionTrack,
	VMMLTemplateV4,
	VideoTrack,
} from "@/interface/vmml";
import { useTimelineStore } from "@/store";
import { Stage, useApp } from "@pixi/react";
import {
	CSSProperties,
	FC,
	ReactNode,
	useDeferredValue,
	useEffect,
	useMemo,
} from "react";
import MainVideoTrack from "../video-tracks/VideoTrack";

import VideoPoster from "@/VideoPoster";
import TimeControlV2 from "@/components/Controller/index-2";
import { useDelayLoading } from "@/hooks/useDelayLoading";
import { tezignPlayerStore, useTezignPlayerStore } from "@/store/tezignPlayer";
import { calculatRectByObjectFit } from "@/util";
import { useEventListener, useSize, useUnmount } from "ahooks";
import { BasicTarget } from "ahooks/lib/utils/domTarget";
import { FloatButton, Spin, message } from "antd";
import classNames from "classnames";
import SoundTrackNew from "../audio-track/new";
import CaptionEditor from "../caption-editor";
import CaptionTrackComponent from "../caption-track";
import CaptionTrackComponentDom from "../caption-track/dom";
import "./index.css";

const SetUpHook: FC<{
	duration: number;
}> = ({ duration }) => {
	const app = useApp();

	useEffect(() => {
		useTimelineStore.getState().setApp(app, duration);
	}, [app, duration]);

	// useUnmount(() => {
	// 	const timeline = useTimelineStore.getState().timeline;
	// 	if (timeline) {
	// 		timeline.stop();
	// 	}
	// });

	return null;
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
	spinner?: React.ReactNode | React.ComponentType;
	//
	features: Array<
		"audioTrack" | "controller-options" | "captionTrack" | "poster"
	>;
	resolveFontFamily?: (url: string) => string | undefined;
};

export const TezignPlayer: FC<TezignPlayerProps> = ({
	vmml,
	height: pHeight,
	width: pWidth,
	container,
	poster: _poster,
	backgroundColor = "#000000f3",
	spinner: Spinner,
	features,
	resolveFontFamily,
}) => {
	if (!vmml) {
		throw new Error("No vmml found");
	}

	useEffect(() => {
		tezignPlayerStore.getState().setVmml(vmml);
	}, [vmml]);

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
			target: document.querySelector("#tz-player-container"),
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
	// const isLoading = useDelayLoading({
	// 	loading: seekLoading,
	// 	delay: 250,
	// });

	const renderPoster = () => {
		if (!features.includes("poster")) return null;
		if (_poster?.url) {
			return (
				<VideoPoster
					className={"aniamte-fadein"}
					style={{
						objectFit: _poster?.objectFit ?? "cover",
					}}
					url={_poster.url}
				/>
			);
		}
		return null;
	};

	const renderSpinner = () => {
		if (!seekLoading || !Spinner) return null;
		const spinner = typeof Spinner === "function" ? <Spinner /> : Spinner;
		return <div className="absolute z-[9999] inset-0">{spinner}</div>;
	};

	useUnmount(() => {
		const timeline = useTimelineStore.getState().timeline;
		if (timeline) {
			timeline.stop();
		}
		useTimelineStore.getState().reset();
		tezignPlayerStore.getState().reset();
	});

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
						"bg-rect-pattern",
					)}
					id="tz-player-container"
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
							{captionTrack &&
								features.includes("captionTrack") && (
									<CaptionTrackComponent
										resolveFontFamily={resolveFontFamily}
										stageRect={transformedRect}
										captionTrack={
											captionTrack as CaptionTrack
										}
									/>
								)}
							{audioTrack && features.includes("audioTrack") && (
								<SoundTrackNew
									audioTrack={audioTrack as AudioTrack}
								/>
							)}
						</Stage>
					}
					{/* {captionTrack && features.includes("captionTrack") && (
						<CaptionTrackComponentDom
							stageRect={transformedRect}
							captionTrack={captionTrack as CaptionTrack}
						/>
					)} */}
					{renderPoster()}
					<TimeControlV2
						featureOn={features.includes("controller-options")}
					/>
					{renderSpinner()}
				</div>
			</div>
			{captionTrack && features.includes("captionTrack") && (
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
