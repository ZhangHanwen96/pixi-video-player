import { TimelineEventTypes } from "@/Timeline";
import { applyTransition, isInTransition } from "@/animation";
import { easings } from "@/easing";
import { $on, $ons } from "@/event-utils";
import { VideoTrack } from "@/interface/vmml";
import preloadUtils, {
	waitForCanPlay2,
	waitForLoadedMetadata2,
} from "@/preload";
import { useTimelineStore } from "@/store";
import { loadImage } from "@/utils/loadImage";
import { withTimeLog } from "@/utils/withTimeLog";
import { mergeRefs } from "@mantine/hooks";
import { GlitchFilter } from "@pixi/filter-glitch";
import { RadialBlurFilter } from "@pixi/filter-radial-blur";
import { Container, Sprite, withFilters } from "@pixi/react";
import {
	useDeepCompareEffect,
	useMemoizedFn,
	useUnmount,
	useUpdateEffect,
} from "ahooks";
import EventEmitter from "eventemitter3";
import { isInteger, isNumber, set } from "lodash-es";
import * as PIXI from "pixi.js";
import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
import { hooks } from "../Controller/hooks";
import { seekVideo } from "./utils";

const graphics = new PIXI.Graphics();
graphics.beginFill(0xffffff);
graphics.drawRect(0, 0, 300, 400);
graphics.endFill();

const circleGraphicsMask = new PIXI.Graphics();

interface Props {
	mainTrack: VideoTrack;
	stageRect: {
		x: number;
		y: number;
		width: number;
		height: number;
		scale: number;
	};
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
const defaultGlitch = {
	enabled: false,
	slices: 5,
	blue: {
		x: 0,
		y: 0,
	},
	green: {
		x: 0,
		y: 0,
	},
	red: {
		x: 0,
		y: 0,
	},
};

const defaultRadialBlur = {
	center: {
		x: 0,
		y: 0,
	},
	radius: 200,
	angle: 0,
	enabled: false,
};

type Trasnform = typeof defaultTransform;

type VideoMeta = VideoTrack["clips"][number];

const Filters = withFilters(Container, {
	blur: PIXI.BlurFilter,
	// glitch: GlitchFilter,
	// radialBlur: RadialBlurFilter,
	// adjust: AdjustmentFilter,
});

const videoCache = new Map<string, HTMLVideoElement>();
const imageCache = new Map<string, HTMLImageElement>();

const MAX_PRELOAD = 4;

const getCacheId = (url: string, clipId: string) => {
	return `${url}-${clipId}`;
};

const initialRectMeta = {
	x: 0,
	y: 0,
	height: 0,
	width: 0,
	scale: {
		x: 1,
		y: 1,
	},
	extra: {
		x: 0,
		y: 0,
	},
};

const MainVideoTrack = forwardRef<PIXI.Container, Props>((props, ref) => {
	const { mainTrack, stageRect, containerRef, spriteRef } = props;

	const compId = useId();
	const clipIds = mainTrack.clips.map((c) => c.id);
	const timeline = useTimelineStore.use.timeline?.(true);
	const requestLoadId = useRef(0);

	const [rectMeta, setRectMeta] = useState(initialRectMeta);

	const rectMetaRef = useRef(rectMeta);
	rectMetaRef.current = rectMeta;

	const [videoMeta, setVideoMeta] = useState<VideoMeta>();
	const videoMetaRef = useRef<VideoMeta | null>();

	const [mask, setMask] = useState<PIXI.Graphics>();
	const maskRef = useRef(mask);

	const resetMask = useMemoizedFn(() => {
		setMask(undefined);
	});

	const changeVideoCurrentTime = useMemoizedFn((currentTime: number) => {
		if (!video) return;
		video.currentTime = currentTime;
	});

	const pauseCurrentVideo = useMemoizedFn(() => {
		if (!video) return;
		video.pause();
	});

	useUnmount(() => {
		for (const video of videoCache.values()) {
			video.pause();
			video.src = "";
			video.load();
		}
		videoCache.clear();
	});

	/** initial video preload */
	useDeepCompareEffect(() => {
		const preloadClips = mainTrack.clips.slice(0, MAX_PRELOAD);

		console.log("%cpreload partialClip", "color: green; font-size: 28px;");
		console.log(preloadClips);
		console.log("total clips", mainTrack.clips.length);

		for (const clip of preloadClips) {
			const { videoClip } = clip;
			if (videoClip.mimeType.startsWith("image")) continue;
			const load = async () => {
				const cacheId = getCacheId(videoClip.sourceUrl, clip.id);
				if (videoCache.has(cacheId)) {
					const video = videoCache.get(cacheId)!;

					// seeking current videoClip start time
					video.currentTime = clip.start / 1_000_000;
					return;
				}

				const video = preloadUtils.createVideo("auto");
				video.muted = false;
				video.volume = videoClip.volume ?? 0;

				videoCache.set(cacheId, video);
				// ! wait before setting currentTime
				await waitForLoadedMetadata2(video, videoClip.sourceUrl);

				console.log("%cloadedmetadata", "color: green;");

				video.currentTime = clip.start / 1_000_000;
			};
			load();
		}

		// return () => {};
	}, clipIds);

	const createVideoSync = useCallback(
		(metaData: VideoMeta, currentTime?: number) => {
			// TODO: preload options:
			// 1. numbers of clip
			// 2. duration of clips

			const preloadNext = (num = 3) => {
				let cachedDuration = 0;
				const clipIndex = mainTrack.clips.findIndex(
					(c) => c.id === metaData.id,
				);
				let nextClipIndex = clipIndex + 1;
				let cacheCount = num;
				let nextClip = mainTrack.clips[nextClipIndex];
				// cache next 2 video
				while (
					nextClip &&
					(cacheCount > 0 || cachedDuration < 15_000_000)
				) {
					if (
						videoCache.has(
							getCacheId(
								nextClip.videoClip.sourceUrl,
								nextClip.id,
							),
						)
					) {
						nextClipIndex++;
						cachedDuration += nextClip.duration;
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
					cachedDuration += nextClip.duration;
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
				);
				if (!cachedVideo) {
					throw new Error("No cached video found");
				}
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
		const { dimension: videoDimension } = videoClip;
		/** pre-calculated -> object-fit: contain */
		const scaleX = videoClip.posParam.scaleX ?? 1;
		const scaleY = videoClip.posParam.scaleY ?? 1;
		const centerX = videoClip.posParam.centerX ?? 0.5;
		const centerY = videoClip.posParam.centerY ?? 0.5;

		flushSync(() => {
			const ajustedScale = {
				x: scaleX * stageRect.scale,
				y: scaleY * stageRect.scale,
			};

			const adjustedDimension = {
				width: videoDimension.width * ajustedScale.x,
				height: videoDimension.height * ajustedScale.y,
			};

			const meta = {
				height: videoDimension.height,
				width: videoDimension.width,
				scale: {
					...ajustedScale,
				},
				x:
					(stageRect.width - videoDimension.width * ajustedScale.x) /
					2,
				y:
					(stageRect.height -
						videoDimension.height * ajustedScale.y) /
					2,
				extra: {
					x:
						centerX -
						0.5 +
						(1 - adjustedDimension.width / stageRect.width) / 2,
					y:
						centerY -
						0.5 +
						(1 - adjustedDimension.height / stageRect.height) / 2,
				},
			};

			console.log(centerX, centerY, meta);

			setRectMeta(meta);
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
						img.crossOrigin = "anonymous";
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

	// useEffect(() => {
	// 	if (video && timeline) {
	// 		video.onwaiting = () => {
	// 			console.log("onwaiting -----------------");
	// 			useTezignPlayerStore.getState().startSeekLoading();
	// 			timeline.stop();
	// 		};
	// 		video.onplaying = () => {
	// 			useTezignPlayerStore.getState().finishSeekLoading();
	// 			timeline.resume();
	// 		};
	// 	}
	// }, [video, timeline]);

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

	const _reset = useCallback(() => {
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
		const cacheId = getCacheId(clip.videoClip.sourceUrl, clip.id);
		const video = videoCache.get(cacheId);
		if (video) {
			await preloadUtils.waitForCanPlay3(video, currentTime);
			return;
		}

		const newVideo = await preloadUtils.waitForCanPlay(
			clip.videoClip.sourceUrl,
			currentTime,
		);
		newVideo.volume = clip.videoClip.volume ?? 1;
		videoCache.set(cacheId, newVideo);
	};

	useEffect(() => {
		let videoMeta: VideoMeta | undefined;
		let id = 0;
		let currentId = id;
		const unsubCallbacks: Array<() => void> = [];
		unsubCallbacks.push(
			hooks.beforeEach(({ name, context }) => {
				if (name === "seek") {
					currentId = context.currentId = ++id;
				}
			}),
		);
		unsubCallbacks.push(
			hooks.hook("seek", async ({ currentTime }) => {
				videoMeta = seekVideo(currentTime, mainTrack);
				if (!videoMeta) {
					_reset();
					return;
				}

				console.log("in seek", videoMeta);
				const isDiff = videoMeta.id !== videoMetaRef.current?.id;
				if (!isDiff) {
					return;
				}

				pauseCurrentVideo();

				const isImage =
					videoMeta.videoClip.mimeType.startsWith("image");
				if (isImage) {
					if (!imageCache.has(videoMeta.videoClip.sourceUrl)) {
						const img = await withTimeLog(
							async () =>
								loadImage(videoMeta!.videoClip.sourceUrl),
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
			}),
		);
		unsubCallbacks.push(
			hooks.afterEach(async ({ name, args, context }) => {
				if (name !== "seek" || !videoMeta) return;
				if (currentId !== context.currentId) return;
				const { currentTime } = args[0];
				const isDiff = videoMeta.id !== videoMetaRef.current?.id;

				videoMetaRef.current = videoMeta;
				const start =
					currentTime * 1_000 - videoMeta.inPoint + videoMeta.start;
				const isImage =
					videoMeta.videoClip.mimeType.startsWith("image");

				if (isImage) {
					syncRectMeta(videoMeta);
					flushSync(() => {
						setVideoMeta(videoMeta);
						setVideo(undefined);
						setImage(
							imageCache.get(videoMeta!.videoClip.sourceUrl),
						);
					});
					return;
				}

				console.log(
					`%cseek applied: ${start / 1000000}`,
					"color: blue; font-size: 24px;",
				);
				if (!isDiff) {
					changeVideoCurrentTime(start / 1_000_000);
					console.log("same video", start / 1000000);
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
			}),
		);
		return () => {
			hooks.removeAllHooks();
		};
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
							_reset();
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
							pauseCurrentVideo();

							// reset transform
							setTransform(defaultTransform);
							// reset mask
							resetMask();
							// reset glitch
							resetGlitch();
						} else if (videoMeta.videoClip?.transitionParam) {
							/** animation | transform */
							const tp = videoMeta.videoClip.transitionParam;

							const newTransform = getDefaultTransform();

							const rectMeta = rectMetaRef.current;

							switch (tp.transitionCode) {
								// case "radial_blur_in": {
								// 	const value = applyTransition({
								// 		clip: videoMeta,
								// 		elapsedTime: event.elapsedTime,
								// 		outputMin: 0,
								// 		outputMax: 1,
								// 		transitionParam: tp,
								// 	});
								// 	console.log("radial_blur_in", value);
								// 	const angle = (1 - value) * -180;
								// 	const cx =
								// 		rectMeta.x +
								// 		(rectMeta.width * rectMeta.scale.x) / 2;
								// 	const cy =
								// 		rectMeta.y +
								// 		(rectMeta.height * rectMeta.scale.y) /
								// 			2;
								// 	const radius = Math.sqrt(
								// 		rectMeta.width ** 2 +
								// 			rectMeta.height ** 2,
								// 	);
								// 	const params = {
								// 		center: {
								// 			x: rectMeta.x,
								// 			y: rectMeta.y,
								// 		},
								// 		radius: 100,
								// 		angle: 180,
								// 		kernelSize: 15,
								// 		enabled: true,
								// 	};
								// 	setRadialBlurParams(params);
								// 	break;
								// }

								case "glitch": {
									const isIn = isInTransition(
										videoMeta,
										tp,
										event.elapsedTime,
									);
									if (isIn) {
										const isOn = Math.random() > 0.5;
										const getRandomDir = () =>
											Math.random() > 0.5 ? 1 : -1;
										const getRand = (
											from: number,
											to: number,
										) =>
											Math.random() * (to - from) +
											from * getRandomDir();

										if (!glitchAppliedTime.current) {
											glitchAppliedTime.current =
												performance.now();

											setGlitchParams({
												enabled: isOn,
												slices:
													Math.round(
														Math.random() * 10,
													) + 2,
												blue: {
													x:
														Math.random() *
														50 *
														getRandomDir(),
													y:
														Math.random() *
														50 *
														getRandomDir(),
												},
												green: {
													x:
														getRand(0, 10) *
														getRandomDir(),
													y:
														getRand(0, 10) *
														getRandomDir(),
												},
												red: {
													x:
														getRand(0, 10) *
														getRandomDir(),
													y:
														getRand(0, 10) *
														getRandomDir(),
												},
											});
										} else if (
											performance.now() -
												glitchAppliedTime.current >
											48
										) {
											glitchAppliedTime.current =
												performance.now();
											setGlitchParams({
												enabled: isOn,
												slices:
													Math.round(
														Math.random() * 10,
													) + 2,
												blue: {
													x:
														getRand(0, 10) *
														getRandomDir(),
													y:
														getRand(0, 10) *
														getRandomDir(),
												},
												green: {
													x:
														getRand(0, 10) *
														getRandomDir(),
													y:
														getRand(0, 10) *
														getRandomDir(),
												},
												red: {
													x:
														getRand(0, 10) *
														getRandomDir(),
													y:
														getRand(0, 10) *
														getRandomDir(),
												},
											});
										}
									} else {
										resetGlitch();
									}
									break;
								}
								case "circle_in": {
									if (
										maskRef.current !== circleGraphicsMask
									) {
										setMask(circleGraphicsMask);
									}
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMax: 1,
										outputMin: 0,
										transitionParam: tp,
									});

									circleGraphicsMask.clear();
									const radius = Math.sqrt(
										rectMeta.width ** 2 +
											rectMeta.height ** 2,
									);
									const startRadius = 0;
									const cx =
										rectMeta.x +
										(rectMeta.width * rectMeta.scale.x) / 2;
									const cy =
										rectMeta.y +
										(rectMeta.height * rectMeta.scale.y) /
											2;
									circleGraphicsMask.pivot.set(cx, cy);
									circleGraphicsMask.beginFill(0xffffff);
									circleGraphicsMask.drawCircle(
										cx,
										cy,
										startRadius + value * radius,
									);
									circleGraphicsMask.endFill();
									break;
								}
								case "circle_out": {
									if (
										maskRef.current !== circleGraphicsMask
									) {
										setMask(circleGraphicsMask);
									}
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMin: 1,
										outputMax: 0,
										transitionParam: tp,
									});
									circleGraphicsMask.clear();
									const radius = Math.sqrt(
										rectMeta.width ** 2 +
											rectMeta.height ** 2,
									);
									const startRadius = 50;
									const cx =
										rectMeta.x +
										(rectMeta.width * rectMeta.scale.x) / 2;
									const cy =
										rectMeta.y +
										(rectMeta.height * rectMeta.scale.y) /
											2;
									circleGraphicsMask.pivot.set(cx, cy);
									circleGraphicsMask.beginFill(0xffffff);
									circleGraphicsMask.drawCircle(
										cx,
										cy,
										value * radius,
									);
									circleGraphicsMask.endFill();
									break;
								}
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
									const rectMeta = rectMetaRef.current;
									const right =
										rectMeta.x +
										rectMeta.width * rectMeta.scale.x;
									// slide_in
									const offsetDistanceIn = right;
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMin: -offsetDistanceIn,
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
									const rectMeta = rectMetaRef.current;
									const left = rectMeta.x;
									// slide_out
									const width = stageRect.width;
									const offsetDistanceOut = width - left;
									const value = applyTransition({
										clip: videoMeta,
										elapsedTime: event.elapsedTime,
										outputMin: 0,
										outputMax: offsetDistanceOut,
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

	const [glitchParams, setGlitchParams] = useState(defaultGlitch);
	const glitchAppliedTime = useRef<number>();
	const resetGlitch = useMemoizedFn(() => {
		if (glitchParams === defaultGlitch) return;
		setGlitchParams(defaultGlitch);
	});

	const [radialBlurParams, setRadialBlurParams] = useState(defaultRadialBlur);
	const resetRadialBlur = useMemoizedFn(() => {
		if (radialBlurParams === defaultRadialBlur) return;
		setRadialBlurParams(radialBlurParams);
	});

	const clipId = videoMeta?.id || "";

	const containerKey = clipId ? `${clipId}-${compId}` : compId;
	const spriteKey = clipId
		? `${clipId}-${compId}-sprite`
		: `${compId}-sprite`;

	const innerContainerRef = useRef<PIXI.Container>(null);
	const innerSpriteRef = useRef<PIXI.Sprite>(null);

	const cContainerRef = mergeRefs(containerRef, innerContainerRef);
	const cSpriteRef = mergeRefs(spriteRef, innerSpriteRef);

	const flipX = 1;
	const flipY = 1;

	console.log(stageRect);
	console.log(
		{
			x: rectMeta.extra.x * stageRect.width,
			y: rectMeta.extra.y * stageRect.height,
		},
		"extra",
	);
	if (video) {
		return (
			<Filters
				ref={cContainerRef}
				// HACK: I maybe only have a title bit idea why this works 🥹
				key={`${containerKey}_video`}
				// position related
				// x={
				// 	rectMeta.x +
				// 	(rectMeta.width * rectMeta.scale.x) / 2 +
				// 	transform.translate.x
				// }
				// y={
				// 	rectMeta.y +
				// 	(rectMeta.height * rectMeta.scale.y) / 2 +
				// 	transform.translate.y
				// }
				// pivot={{
				// 	x: rectMeta.width / 2,
				// 	y: rectMeta.height / 2,
				// }}
				// scale={{
				// 	x: rectMeta.scale.x * transform.scale.x * flipX,
				// 	y: rectMeta.scale.y * transform.scale.y * flipY,
				// }}

				pivot={{
					x: -rectMeta.extra.x * stageRect.width,
					y: -rectMeta.extra.y * stageRect.height,
				}}
				// angle={transform.degree}
				blur={filterParams}
				alpha={transform.alpha}
				// mask={mask}
				// glitch={{
				// 	fillMode: GlitchFilter.LOOP,
				// 	seed: 0.3,
				// 	...glitchParams,
				// }}
				// radialBlur={{
				// 	...radialBlurParams,
				// }}
			>
				<Sprite
					key={spriteKey}
					height={
						isNumber(rectMeta.height)
							? rectMeta.height * rectMeta.scale.y
							: video?.videoHeight ?? 0
					}
					width={
						isNumber(rectMeta.width)
							? rectMeta.width * rectMeta.scale.x
							: video?.videoWidth ?? 0
					}
					ref={cSpriteRef}
					video={video}
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
				key={`${containerKey}_image`}
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
				// angle={transform.degree}
				scale={{
					x: rectMeta.scale.x * transform.scale.x * flipX,
					y: rectMeta.scale.y * transform.scale.y * flipY,
				}}
				pivot={{
					x: rectMeta.width / 2,
					y: rectMeta.height / 2,
				}}
				blur={filterParams}
				alpha={transform.alpha}
				mask={mask}
				// x={rectMeta.extra.x * stageRect.width}
				// y={rectMeta.extra.y * stageRect.height}
				// scale={{
				// 	x: rectMeta.scale.x * transform.scale.x * flipX,
				// 	y: rectMeta.scale.y * transform.scale.y * flipY,
				// }}
				angle={90}
			>
				<Sprite
					// anchor={0.5}
					// x={rectMeta.width / 2}
					// y={rectMeta.height / 2}
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

export default memo(MainVideoTrack);
