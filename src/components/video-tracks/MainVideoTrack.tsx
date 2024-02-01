import { $on, $ons } from "@/event-utils";
import { VideoTrack, VMMLTemplateV4 } from "@/interface/vmml";
import { useTimelineStore } from "@/store";
import { Container, Sprite, withFilters, Graphics } from "@pixi/react";
import { useDeepCompareEffect, useMemoizedFn, useUpdateEffect } from "ahooks";
import { DisplayObject } from "pixi.js";
import * as PIXI from "pixi.js";
import React, {
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { seekVideo } from "./utils";
import { flushSync } from "react-dom";
import { EVENT_UPDATE, EVENT_SEEK } from "@/Timeline";
import { useTezignPlayerStore } from "@/store/teizng-player";
import {
	clamp,
	cloneDeep,
	difference,
	isInteger,
	isNumber,
	uniqBy,
	uniqWith,
} from "lodash-es";
import preloadUtils, {
	waitForCanPlay2,
	waitForLoadedMetadata2,
} from "@/preload";

import { mergeRefs } from "@mantine/hooks";
import { easings } from "@/easing";
import { applyTransition } from "@/animation";

const graphics = new PIXI.Graphics();
graphics.beginFill(0xffffff);
graphics.drawRect(0, 0, 300, 400);
graphics.endFill();

interface Props {
	containerRef?: React.Ref<PIXI.Container<DisplayObject>>;
	spriteRef?: React.Ref<PIXI.Sprite>;
	mainTrack: VideoTrack;
	vmml: VMMLTemplateV4;
	stageRect: any;
}

const getDefaultTransform = () => {
	return {
		scale: {
			x: 1,
			y: 1,
			z: 1,
		},
		alpha: 1,
		translate: {
			x: 0,
			y: 0,
			z: 0,
		},
		degree: 0,
	};
};

const defaultTransform = getDefaultTransform();

type Trasnform = typeof defaultTransform;

type VideoMeta = VideoTrack["clips"][number];

const Filters = withFilters(Container, {
	blur: PIXI.BlurFilter,
	// adjust: AdjustmentFilter,
});

const videoCache = new Map<string, HTMLVideoElement>();

const MAX_PRELOAD = 3;

const { startPreloading, finishPreloading } = useTezignPlayerStore.getState();

const MainVideoTrack = forwardRef<PIXI.Container, Props>((props, ref) => {
	const { containerRef, spriteRef, mainTrack, stageRect } = props;
	const getCacheId = (url: string, clipId: string) => {
		return `${url}-${clipId}`;
	};
	const compId = useId();
	const clipIds = mainTrack.clips.map((c) => c.id);
	const timeline = useTimelineStore.use.timeline?.();
	const requestLoadId = useRef(0);

	const [rectMeta, setRectMeta] = useState({
		x: 0,
		y: 0,
		height: 0,
		width: 0,
		scale: {
			x: 1,
			y: 1,
		},
	});

	const rectMetaRef = useRef(rectMeta);
	rectMetaRef.current = rectMeta;

	// const videoMeta = useCreation(() => {
	//     const videoFound = seekVideo(0, mainTrack);

	//     if (!videoFound) {
	//         throw new Error("video not found");
	//     }
	//     return videoFound;
	// }, []);
	const [videoMeta, setVideoMeta] = useState<VideoMeta>();
	const videoMetaRef = useRef<VideoMeta | null>();

	useDeepCompareEffect(() => {
		const preloadClips = mainTrack.clips.slice(0, MAX_PRELOAD);

		console.log("%cpreload partialClip", "color: green; font-size: 28px;");
		console.log(preloadClips);
		console.log("total clips", mainTrack.clips.length);

		for (const clip of preloadClips) {
			const { videoClip } = clip;
			const load = async () => {
				if (videoCache.has(getCacheId(videoClip.sourceUrl, clip.id))) {
					const video = videoCache.get(
						getCacheId(videoClip.sourceUrl, clip.id),
					)!;
					// prepare for future
					video.currentTime = clip.start / 1_000_000;
					return;
				}

				const video = preloadUtils.createVideo("none");
				videoCache.set(getCacheId(videoClip.sourceUrl, clip.id), video);
				// !wait before setting currentTime
				await waitForLoadedMetadata2(video, videoClip.sourceUrl);

				console.log("%cloadedmetadata", "color: green;");

				video.currentTime = clip.start / 1_000_000;
			};
			load();
		}
	}, [...clipIds]);

	const createVideoSync = useCallback(
		(
			metaData: VideoMeta,
			{
				fromDiffSet,
				currentTime,
			}: {
				fromDiffSet?: boolean;
				currentTime?: number;
			} = {
				fromDiffSet: false,
			},
		) => {
			const preloadNext = () => {
				const clipIndex = mainTrack.clips.findIndex(
					(c) => c.id === metaData.id,
				);
				let nextClipIndex = clipIndex + 1;
				let cacheCount = 2;
				let nextClip = mainTrack.clips[nextClipIndex];
				// cache next 2 video
				while (nextClip && cacheCount > 0) {
					if (
						videoCache.has(
							getCacheId(
								nextClip.videoClip.sourceUrl,
								nextClip.id,
							),
						)
					) {
						nextClipIndex++;
						nextClip = mainTrack.clips[nextClipIndex];
						continue;
					}
					console.log(
						"%cpreload nextClip",
						"color: green; font-size: 28px;",
					);
					const video = preloadUtils.createVideo("metadata");
					videoCache.set(
						getCacheId(nextClip.videoClip.sourceUrl, nextClip.id),
						video,
					);
					const _nextClip = nextClip;
					// do not await
					waitForLoadedMetadata2(
						video,
						_nextClip.videoClip.sourceUrl,
					).then(() => {
						console.log("%cloadedmetadata", "color: green;");
						console.log(_nextClip);
						video.currentTime = isInteger(currentTime)
							? (currentTime as number)
							: _nextClip.start / 1_000_000;
					});
					nextClipIndex++;
					cacheCount--;
					nextClip = mainTrack.clips[nextClipIndex];
				}
			};

			if (
				videoCache.has(
					getCacheId(metaData.videoClip.sourceUrl, metaData.id),
				)
			) {
				console.log("%ccache hit", "color: green; font-size: 28px;");
				console.log(metaData.id);
				const cachedVideo = videoCache.get(
					getCacheId(metaData.videoClip.sourceUrl, metaData.id),
				)!;
				cachedVideo.currentTime = metaData.start / 1_000_000;
				if (fromDiffSet) {
					preloadNext();
				}

				return {
					fromCache: true,
					video: cachedVideo,
				};
			}

			const video = document.createElement("video");
			video.crossOrigin = "anonymous";
			video.volume = 0;

			video.addEventListener("loadedmetadata", function handler() {
				// cacheManager.setMetadata(metaData.videoClip.sourceUrl, {
				//     width: video.videoWidth,
				//     height: video.videoHeight,
				// });
				preloadNext();

				console.log("%cloadedmetadata", "color: green;");

				const vHeight = video.videoHeight;
				const vWidth = video.videoWidth;

				// TODO: sync rect
				// syncRect(vWidth, vHeight);

				video.currentTime = metaData.start / 1_000_000;

				video.removeEventListener("loadedmetadata", handler);
			});

			return {
				video: video,
			};
		},
		[],
	);

	const syncRectMeta = useMemoizedFn((videoMeta: VideoMeta) => {
		const videoClip = videoMeta.videoClip;
		const { dimension } = videoClip;
		const scaleX = videoClip.posParam.scaleX ?? 1;
		const scaleY = videoClip.posParam.scaleY ?? 1;
		flushSync(() => {
			setRectMeta({
				height: dimension.height,
				width: dimension.width,
				scale: {
					x: scaleX * stageRect.scale,
					y: scaleY * stageRect.scale,
				},
				x:
					(stageRect.width -
						dimension.width * scaleX * stageRect.scale) /
					2,
				y:
					(stageRect.height -
						dimension.height * scaleY * stageRect.scale) /
					2,
			});
		});
	});

	useUpdateEffect(() => {
		if (!videoMetaRef.current) return;
		syncRectMeta(videoMetaRef.current);
	}, [stageRect]);

	const diffSetVideoMeta = useMemoizedFn(
		(videoMeta: VideoMeta, currentTime?: number) => {
			if (videoMeta?.id === videoMetaRef.current?.id) return false;
			videoMetaRef.current = videoMeta;

			const imageMimeType =
				videoMeta.videoClip.mimeType.startsWith("image");

			console.log("%cSetVideoWithDiff", "color: blue;");

			const currentLoadId = ++requestLoadId.current;

			const cleanUp = () => {
				// prevVideo.pause();
				// prevVideo.src = "";
				// prevVideo.load();
			};

			// TODO: loading stauts
			const loadVideo = async () => {
				if (currentLoadId === requestLoadId.current) {
					const { video, fromCache } = createVideoSync(videoMeta, {
						fromDiffSet: true,
						currentTime,
					});

					if (!fromCache) {
						video.src = videoMeta.videoClip.sourceUrl;
						video.load();
					}

					// !canPlay
					if (video.readyState < 4) {
						startPreloading();
						await waitForCanPlay2(video);
						finishPreloading();
					}

					// TODO: check can play
					syncRectMeta(videoMeta);
					flushSync(() => {
						setVideoMeta(videoMeta);
						setVideo(video);
						video.play();
					});

					setTimeout(() => {
						cleanUp();
					});
				}
			};

			if (imageMimeType) {
				syncRectMeta(videoMeta);
				flushSync(() => {
					setImage(videoMeta.videoClip.sourceUrl);
					setVideo(undefined);
					setVideoMeta(videoMeta);
				});
			} else {
				loadVideo();
			}

			return true;
		},
	);

	const [transform, setTransform] = useState<Trasnform>(defaultTransform);
	const transformRef = useRef<Trasnform>(transform);
	transformRef.current = transform;

	const [video, setVideo] = useState<HTMLVideoElement>();
	const [image, setImage] = useState<string>();

	useEffect(() => {
		return $ons(
			[
				{
					event: "complete",
					handler: () => {
						if (video && !video.paused) {
							video.pause();
						}
					},
				},
				{
					event: "pause",
					handler: () => {
						if (video && !video.paused) {
							video.pause();
						}
					},
				},
				{
					event: "resume",
					handler: () => {
						if (video?.paused) {
							video.play();
						}
					},
				},
			],
			timeline,
		);
	}, [video, timeline]);

	const changeVideoCurrentTime = useMemoizedFn((currentTime: number) => {
		if (!video) return;
		video.currentTime = currentTime;
	});

	useEffect(() => {
		return $ons(
			[
				{
					event: "seek",
					handler(event: EVENT_SEEK) {
						const videoMeta = seekVideo(
							event.elapsedTime,
							mainTrack,
						);
						if (videoMeta) {
							const isDiff =
								videoMeta.id !== videoMetaRef.current?.id;
							if (!isDiff) {
								const start =
									event.elapsedTime * 1_000 -
									videoMeta.inPoint +
									videoMeta.start;
								changeVideoCurrentTime(start / 1_000_000);
							}
						}
					},
				},
				{
					event: "update",
					handler: (event: EVENT_UPDATE) => {
						if (useTimelineStore.getState().showPoster) {
							useTimelineStore.getState().togglePoster();
						}
						const videoMeta = seekVideo(
							event.elapsedTime,
							mainTrack,
						);

						if (!videoMeta) {
							setVideoMeta(undefined);
							setVideo(undefined);
							setImage(undefined);
							setTransform(defaultTransform);
							videoMetaRef.current = undefined;
							return;
						}

						const realStart =
							event.elapsedTime * 1_000 -
							videoMeta.inPoint +
							videoMeta.start;
						const isDiffApplied = diffSetVideoMeta(
							videoMeta,
							realStart / 1_000_000,
						);
						if (isDiffApplied) {
							setTransform(defaultTransform);
						} else if (videoMeta.videoClip?.transitionParam) {
							const tp = videoMeta.videoClip.transitionParam;

							const newTransform = getDefaultTransform();

							switch (tp.transitionCode) {
								case "crossfadein": {
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMax: 1,
										outputMin: 0,
										transitionParam: tp,
									});
									newTransform.alpha = value;
									break;
								}
								case "crossfadeout": {
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMin: 1,
										outputMax: 0,
										transitionParam: tp,
									});
									newTransform.alpha = value;
									break;
								}
								case "slide_in": {
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMin:
											-rectMetaRef.current.width *
											rectMetaRef.current.scale.x,
										outputMax: 0,
										transitionParam: tp,
									});

									newTransform.translate.x = value;
									break;
								}
								case "scale_in": {
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMin: 0.4,
										outputMax: 1,
										transitionParam: tp,
									});

									newTransform.scale.x = value;
									newTransform.scale.y = value;

									break;
								}
								case "scale_out": {
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMin: 1,
										outputMax: 0.3,
										transitionParam: tp,
										easing: easings.easeOutBounce,
									});

									newTransform.scale.x = value;
									newTransform.scale.y = value;
									break;
								}
								case "slide_out": {
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMin: 0,
										outputMax:
											rectMetaRef.current.width *
											rectMetaRef.current.scale.x,
										transitionParam: tp,
									});
									newTransform.translate.x = value;
									break;
								}
								default:
							}
							setTransform(newTransform);
						}
					},
				},
			],
			timeline,
		);
	}, [timeline, mainTrack]);

	useEffect(() => {
		if (!video) return;

		video.playbackRate = timeline?.speed || 1;

		return $on(
			"speed",
			(speed: number) => {
				if (video) {
					video.playbackRate = speed;
				}
			},
			timeline,
		);
	}, [timeline, video]);

	const clipId = videoMetaRef.current?.id;

	const filterParams = useMemo(() => {
		let blur = 0;
		if (videoMeta?.videoClip.filterParam) {
			blur = 20;
		}
		return {
			blur,
			quality: 10,
			resolution: devicePixelRatio || 1,
		};
	}, [videoMeta?.videoClip.filterParam]);

	const containerKey = clipId ? `${clipId}-${compId}` : compId;
	const spriteKey = clipId
		? `${clipId}-${compId}-sprite`
		: `${compId}-sprite}`;

	const innerContainerRef = useRef<PIXI.Container>(null);
	const innerSpriteRef = useRef<PIXI.Sprite>(null);

	const cContainerRef = mergeRefs(containerRef, innerContainerRef);
	const cSpriteRef = mergeRefs(spriteRef, innerSpriteRef);

	// useMount(() => {
	//     if (!innerSpriteRef.current) return;
	//     innerSpriteRef.current.texture.update();
	//     setTimeout(() => {
	//         innerSpriteRef.current.texture.update();
	//     }, 100);
	// });

	const flipX = 1;
	const flipY = 1;

	if (video) {
		return (
			<Filters
				ref={cContainerRef}
				// anchor={0.5}
				// HACK: I maybe only have a title bit idea why this works 🥹
				key={containerKey}
				x={
					rectMeta.x +
					(rectMeta.width * rectMeta.scale.x) / 2 +
					transform.translate.x
				}
				y={
					rectMeta.y +
					(rectMeta.height * rectMeta.scale.y) / 2 +
					transform.translate.y
				}
				angle={transform.degree}
				scale={{
					x: rectMeta.scale.x * transform.scale.x * flipX,
					y: rectMeta.scale.y * transform.scale.y * flipY,
				}}
				blur={filterParams}
				alpha={transform.alpha}
				pivot={{
					x: rectMeta.width / 2,
					y: rectMeta.height / 2,
				}}
				// mask={graphics}
			>
				<Sprite
					key={spriteKey}
					ref={cSpriteRef}
					video={video}
					height={
						isNumber(rectMeta.height)
							? rectMeta.height
							: video?.videoHeight || 0
					}
					width={
						isNumber(rectMeta.width)
							? rectMeta.width
							: video?.videoWidth || 0
					}
				/>
			</Filters>
		);
	}

	if (image) {
		return (
			<Filters
				ref={cContainerRef}
				// anchor={0.5}
				// HACK: I maybe only have a title bit idea why this works 🥹
				key={containerKey}
				x={
					rectMeta.x +
					(rectMeta.width * rectMeta.scale.x) / 2 +
					transform.translate.x
				}
				y={
					rectMeta.y +
					(rectMeta.height * rectMeta.scale.y) / 2 +
					transform.translate.y
				}
				angle={transform.degree}
				scale={{
					x: rectMeta.scale.x * transform.scale.x * flipX,
					y: rectMeta.scale.y * transform.scale.y * flipY,
				}}
				blur={filterParams}
				alpha={transform.alpha}
				pivot={{
					x: rectMeta.width / 2,
					y: rectMeta.height / 2,
				}}
			>
				<Sprite
					key={spriteKey}
					ref={cSpriteRef}
					image={image}
					height={isNumber(rectMeta.height) ? rectMeta.height : 0}
					width={isNumber(rectMeta.width) ? rectMeta.width : 0}
				/>
			</Filters>
		);
	}

	return null;
});
export default MainVideoTrack;
