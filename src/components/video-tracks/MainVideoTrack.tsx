import { $on, $ons } from "@/event-utils";
import { VideoTrack, VMMLTemplateV4 } from "@/interface/vmml";
import { useTimelineStore } from "@/store";
import { Container, Sprite, withFilters, Graphics } from "@pixi/react";
import { useDeepCompareEffect, useMemoizedFn, useUpdateEffect } from "ahooks";
import { DisplayObject } from "pixi.js";
import * as PIXI from "pixi.js";
import EventEmitter from "eventemitter3";
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
import {
	EVENT_UPDATE,
	EVENT_SEEK,
	TimeLineContoller,
	TimelineEventTypes,
} from "@/Timeline";
import { useTezignPlayerStore } from "@/store/teizng-player";
import { isInteger, isNumber } from "lodash-es";
import preloadUtils, {
	waitForCanPlay2,
	waitForCanPlay3,
	waitForLoadedMetadata2,
} from "@/preload";
import { mergeRefs } from "@mantine/hooks";
import { easings } from "@/easing";
import { applyTransition } from "@/animation";
import { hooks } from "../Controller/hooks";
import { withPromise } from "@/utils/withPromise";
import { sleep } from "@/utils/delay";
import { withTimeLog } from "@/utils/withTimeLog";
import { loadImage } from "@/utils/loadImage";

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
const imageCache = new Map<string, HTMLImageElement>();

const MAX_PRELOAD = 3;

const getCacheId = (url: string, clipId: string) => {
	return `${url}-${clipId}`;
};

const MainVideoTrack = forwardRef<PIXI.Container, Props>((props, ref) => {
	const { containerRef, spriteRef, mainTrack, stageRect } = props;

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

	const [videoMeta, setVideoMeta] = useState<VideoMeta>();
	const videoMetaRef = useRef<VideoMeta | null>();

	const changeVideoCurrentTime = useMemoizedFn((currentTime: number) => {
		if (!video) return;
		video.currentTime = currentTime;
	});

	const pauseCurrentVideo = useMemoizedFn(() => {
		if (!video) return;
		video.pause();
	});

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

				const video = preloadUtils.createVideo("auto");
				video.muted = false;
				video.volume = videoClip.volume ?? 0;

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
		(metaData: VideoMeta, currentTime?: number) => {
			const preloadNext = (num = 2) => {
				const clipIndex = mainTrack.clips.findIndex(
					(c) => c.id === metaData.id,
				);
				let nextClipIndex = clipIndex + 1;
				let cacheCount = num;
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
					video.muted = false;
					video.volume = nextClip.videoClip.volume ?? 0;

					videoCache.set(
						getCacheId(nextClip.videoClip.sourceUrl, nextClip.id),
						video,
					);
					const clip = nextClip;
					// do not await
					waitForLoadedMetadata2(
						video,
						clip.videoClip.sourceUrl,
					).then(() => {
						console.log("%cloadedmetadata", "color: green;");
						console.log(clip);
						video.currentTime = clip.start / 1_000_000;
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
				console.log("%cCache Hit", "color: green; font-size: 24px;");
				console.log(metaData.id);
				const cachedVideo = videoCache.get(
					getCacheId(metaData.videoClip.sourceUrl, metaData.id),
				)!;
				cachedVideo.currentTime = isInteger(currentTime)
					? (currentTime as number)
					: metaData.start / 1_000_000;

				preloadNext();

				return {
					fromCache: true,
					video: cachedVideo,
				};
			}

			console.log(
				"%cCache Miss",
				"color: red; font-size: 24px; font-weight: bold;",
			);
			const video = document.createElement("video");
			video.crossOrigin = "anonymous";
			video.volume = metaData.videoClip.volume ?? 1;

			video.addEventListener("loadedmetadata", function handler() {
				preloadNext();

				console.log("%cloadedmetadata", "color: green;");

				video.currentTime = isInteger(currentTime)
					? (currentTime as number)
					: metaData.start / 1_000_000;

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

			const loadVideo = async () => {
				const { video, fromCache } = createVideoSync(
					videoMeta,
					currentTime,
				);

				if (!fromCache) {
					video.src = videoMeta.videoClip.sourceUrl;
					video.load();
				}

				// !canPlay
				if (video.readyState < 4) {
					await withTimeLog(
						() => waitForCanPlay2(video),
						"[diffSetVideoMeta] wait for can play",
					);
				}
				if (currentLoadId !== requestLoadId.current) {
					return;
				}

				syncRectMeta(videoMeta);
				flushSync(() => {
					setVideoMeta(videoMeta);
					setVideo(video);
					video.volume = videoMeta.videoClip.volume ?? 1;
					video.play();
				});
			};

			if (imageMimeType) {
				syncRectMeta(videoMeta);
				flushSync(() => {
					let img = imageCache.get(videoMeta.videoClip.sourceUrl);
					if (!img) {
						img = new Image();
						img.src = videoMeta.videoClip.sourceUrl;
					}
					setImage(img);
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
	const [image, setImage] = useState<HTMLImageElement>();

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
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [video, timeline]);

	const __reset = useCallback(() => {
		pauseCurrentVideo();
		setVideoMeta(undefined);
		setVideo(undefined);
		setImage(undefined);
		setTransform(defaultTransform);
		videoMetaRef.current = undefined;
	}, []);

	const waitForCachePlayable = async (
		clip: VideoMeta,
		currentTime: number,
	) => {
		const video = videoCache.get(
			getCacheId(clip.videoClip.sourceUrl, clip.id),
		);
		if (video) {
			await preloadUtils.waitForCanPlay3(video, currentTime);
			return;
		}

		const newVideo = await preloadUtils.waitForCanPlay(
			clip.videoClip.sourceUrl,
			currentTime,
		);
		newVideo.volume = clip.videoClip.volume ?? 1;
		videoCache.set(getCacheId(clip.videoClip.sourceUrl, clip.id), newVideo);
	};

	useEffect(() => {
		let videoMeta: VideoMeta | undefined;
		let id = 0;
		let currentId = id;
		hooks.beforeEach(({ name, context }) => {
			if (name === "seek") {
				currentId = context.currentId = ++id;
			}
		});
		hooks.hook("seek", async ({ currentTime }) => {
			videoMeta = seekVideo(currentTime, mainTrack);
			if (!videoMeta) {
				__reset();
				return;
			}
			const isDiff = videoMeta.id !== videoMetaRef.current?.id;

			if (!isDiff) {
				return;
			}

			pauseCurrentVideo();

			const isImage = videoMeta.videoClip.mimeType.startsWith("image");
			if (isImage) {
				if (!imageCache.has(videoMeta.videoClip.sourceUrl)) {
					const img = await withTimeLog(
						async () => loadImage(videoMeta!.videoClip.sourceUrl),
						"Load Image",
					);
					imageCache.set(videoMeta.videoClip.sourceUrl, img);
				}
				return;
			}
			const start =
				currentTime * 1_000 - videoMeta.inPoint + videoMeta.start;

			await withTimeLog(
				() => waitForCachePlayable(videoMeta!, start / 1_000_000),
				"[seek video] wait for can play",
			);
		});
		hooks.afterEach(async ({ name, args, context }) => {
			if (name !== "seek" || !videoMeta) return;
			if (currentId !== context.currentId) return;
			const { currentTime } = args[0];
			const isDiff = videoMeta.id !== videoMetaRef.current?.id;

			videoMetaRef.current = videoMeta;
			const start =
				currentTime * 1_000 - videoMeta.inPoint + videoMeta.start;
			const isImage = videoMeta.videoClip.mimeType.startsWith("image");

			if (isImage) {
				syncRectMeta(videoMeta);
				flushSync(() => {
					setVideoMeta(videoMeta);
					setVideo(undefined);
					setImage(imageCache.get(videoMeta!.videoClip.sourceUrl));
				});
				return;
			}

			console.log(
				`%cseek applied: ${start / 1000000}`,
				"color: blue; font-size: 24px;",
			);
			if (!isDiff) {
				changeVideoCurrentTime(start / 1_000_000);
				return;
			}

			const cachedVideo = videoCache.get(
				getCacheId(videoMeta.videoClip.sourceUrl, videoMeta.id),
			);
			if (!cachedVideo) throw new Error("No cached video found");
			// cachedVideo.currentTime = start / 1_000_000;

			syncRectMeta(videoMeta);
			flushSync(() => {
				setVideoMeta(videoMeta);
				setVideo(cachedVideo);
				cachedVideo.volume = videoMeta!.videoClip.volume ?? 1;
				cachedVideo.play();
				// cachedVideo.autoplay = true;
			});
		});
	}, []);

	useEffect(() => {
		return $ons(
			[
				{
					event: "update",
					handler: (event) => {
						if (useTimelineStore.getState().showPoster) {
							useTimelineStore.getState().togglePoster();
						}
						const videoMeta = seekVideo(
							event.elapsedTime,
							mainTrack,
						);

						if (!videoMeta) {
							__reset();
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

						// TODO: calculate transform based on videoMeta
						if (isDiffApplied) {
							pauseCurrentVideo();
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
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline, mainTrack]);

	useEffect(() => {
		if (!video) return;

		video.playbackRate = timeline?.speed ?? 1;

		return $on(
			"speed",
			(speed: number) => {
				if (video) {
					video.playbackRate = speed;
				}
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline, video]);

	const clipId = videoMeta?.id || "";

	const filterParams = useMemo(() => {
		let blur = 0;
		if (videoMeta?.videoClip.filterParam) {
			blur = 20;
		}
		return {
			blur,
			quality: 10,
			resolution: devicePixelRatio ?? 1,
		};
	}, [videoMeta?.videoClip.filterParam]);

	const containerKey = clipId ? `${clipId}-${compId}` : compId;
	const spriteKey = clipId
		? `${clipId}-${compId}-sprite`
		: `${compId}-sprite`;

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
							: video?.videoHeight ?? 0
					}
					width={
						isNumber(rectMeta.width)
							? rectMeta.width
							: video?.videoWidth ?? 0
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
					key={`${spriteKey}`}
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
