import { AudioTrack, VMMLTemplateV4, VideoTrack } from "@/interface/vmml";
import MainVideoTrack from "../video-tracks/MainVideoTrack";
import { Stage, useApp } from "@pixi/react";
import { FC, useEffect, useMemo, useState } from "react";
import { useTimelineStore } from "@/store";
// import CaptionTrack from "@/CaptionTrack";
import SoundTrack from "../audio-track";
import SoundTrackNew from "../audio-track/new";
import TimeControlV2 from "@/components/Controller/index-2";
import { calculatRectByObjectFit } from "@/util";
import { useTezignPlayerStore } from "@/store/teizng-player";
import { useEventListener, useMount } from "ahooks";
import CaptionTrack from "../caption-track";
import VideoPoster from "@/VideoPoster";
import { extractFrame } from "@/utils/extractVideoFrame";
import { Spin } from "antd";

const SetUp: FC<{
	duration: number;
}> = ({ duration }) => {
	const app = useApp();

	useEffect(() => {
		useTimelineStore.getState().setApp(app, duration);
	}, [app, duration]);

	return null;
};

interface TezignPlayerProps {
	vmml: VMMLTemplateV4;
	containerRect: { width: number; height: number };
}

export const TezignPlayer: FC<TezignPlayerProps> = ({
	vmml,
	containerRect: containerRectFromProps,
}) => {
	const {
		containerRect: { height, width },
		setRect,
	} = useTezignPlayerStore();

	useEffect(() => {
		if (document.fullscreenElement) return;
		setRect(containerRectFromProps.width, containerRectFromProps.height);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [containerRectFromProps.height, containerRectFromProps.width]);

	const transformedRect = useMemo(() => {
		const rect = calculatRectByObjectFit(
			{
				containerRect: { width, height },
				sourceRect: vmml.dimension,
			},
			"contain",
		);
		return rect;
	}, [vmml.dimension, height, width]);

	// TODO: main and sub got reversed
	const mainTrack = vmml.tracks.find((t) => t.type === 1);
	const audioTrack = vmml.tracks.find((t) => t.type === 3);
	const subTrack = vmml.tracks.find((t) => t.type === 0);
	const captionTrack = vmml.tracks.find((t) => t.type === 2);

	const duration = useMemo(() => {
		if (!mainTrack?.clips.length) return 0;
		const lastClip = mainTrack.clips[mainTrack.clips.length - 1];
		return (lastClip.inPoint + lastClip.duration) / 1_000;
		let duration = 0;
		for (const track of vmml.tracks) {
			const lastClip = track.clips[track.clips.length - 1];
			if (lastClip) {
				duration = Math.max(
					duration,
					(lastClip.inPoint + lastClip.duration) / 1_000,
				);
			}
		}
		return duration;
	}, [vmml.tracks]);

	useEventListener(
		"fullscreenchange",
		() => {
			if (!document.fullscreenElement) {
				useTezignPlayerStore
					.getState()
					.setRect(
						containerRectFromProps.width,
						containerRectFromProps.height,
					);
			} else {
				useTezignPlayerStore
					.getState()
					.setRect(window.innerWidth, window.outerWidth);
			}
		},
		{
			target: document.querySelector("#player-container"),
		},
	);

	const [poster, setPoster] = useState("");

	useEffect(() => {
		const load = async () => {
			const url = mainTrack?.clips[0].videoClip?.sourceUrl;
			if (url) {
				const src = await extractFrame(url, 3);
				setPoster(src);
			}
		};

		load();
	}, [mainTrack?.clips[0].videoClip?.sourceUrl]);

	const seekLoading = useTezignPlayerStore.use.seekLoading();

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
				{!!mainTrack && (
					<Stage
						width={transformedRect.width}
						height={transformedRect.height}
						options={{
							resolution: window.devicePixelRatio || 1,
							autoStart: false,
							// antialias: true,
							// backgroundAlpha: 0,
						}}
					>
						<SetUp duration={duration} />
						<MainVideoTrack
							mainTrack={subTrack as VideoTrack}
							stageRect={transformedRect}
							vmml={vmml}
						/>
						<MainVideoTrack
							mainTrack={mainTrack as VideoTrack}
							stageRect={transformedRect}
							vmml={vmml}
						/>

						<CaptionTrack
							stageRect={transformedRect}
							captionTrack={captionTrack as any}
						/>
						{audioTrack && (
							<SoundTrackNew
								audioTrack={audioTrack as AudioTrack}
							/>
						)}
					</Stage>
				)}

				{poster && <VideoPoster url={poster} />}
				<TimeControlV2 />
				{seekLoading && (
					<div className="absolute z-[9999] inset-0 bg-black/20 flex items-center justify-center">
						<Spin spinning size="large" />
					</div>
				)}
			</div>
		</div>
	);
};
