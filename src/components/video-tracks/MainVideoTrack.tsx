import { $on, $ons } from "@/event-utils";
import { VideoTrack, VMMLTemplateV4 } from "@/interface/vmml";
import { useTimelineStore } from "@/store";
import { Container, Sprite, withFilters } from "@pixi/react";
import {
    useCreation,
    useDeepCompareEffect,
    useMemoizedFn,
    useMount,
    useUpdateEffect,
} from "ahooks";
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
import { EVENT_UPDATE } from "@/Timeline";
import { useTezignPlayerStore } from "@/store/teizng-player";
import { clamp, difference, uniqBy, uniqWith } from "lodash-es";
import preloadUtils, { waitForLoadedMetadata2 } from "@/preload";
import { easeIn } from "@/util";
import { mergeRefs } from "@mantine/hooks";

interface Props {
    containerRef?: React.Ref<PIXI.Container<DisplayObject>>;
    spriteRef?: React.Ref<PIXI.Sprite>;
    mainTrack: VideoTrack;
    vmml: VMMLTemplateV4;
    stageRect: any;
}

type VideoMeta = VideoTrack["clips"][number];

const Filters = withFilters(Container, {
    blur: PIXI.BlurFilter,
    // adjust: AdjustmentFilter,
});

const videoCache = new Map<string, HTMLVideoElement>();

const MAX_PRELOAD = 3;

const MainVideoTrack = forwardRef<PIXI.Container, Props>((props, ref) => {
    const { containerRef, spriteRef, mainTrack, stageRect } = props;
    const getCacheId = (url: string, clipId: string) => {
        return url + "-" + clipId;
    };
    const compId = useId();

    // const allUrls = mainTrack.clips.map((c) => c.videoClip.sourceUrl);
    const clipIds = mainTrack.clips.map((c) => c.id);

    useDeepCompareEffect(() => {
        // const partialClip = uniqWith(mainTrack.clips, (a, b) => {
        //     return a.videoClip.sourceUrl === b.videoClip.sourceUrl;
        // });

        const preloadClips = mainTrack.clips.slice(0, MAX_PRELOAD);

        console.log("%cpreload partialClip", "color: green; font-size: 28px;");
        console.log(preloadClips);
        console.log("total clips", mainTrack.clips.length);

        for (const clip of preloadClips) {
            const { videoClip } = clip;
            const load = async () => {
                if (videoCache.has(getCacheId(videoClip.sourceUrl, clip.id))) {
                    const video = videoCache.get(
                        getCacheId(videoClip.sourceUrl, clip.id)
                    )!;
                    // prepare for future
                    video.currentTime = clip.start / 1_000_000;
                    return;
                }

                const video = preloadUtils.createVideo("none");
                videoCache.set(getCacheId(videoClip.sourceUrl, clip.id), video);
                await waitForLoadedMetadata2(video, videoClip.sourceUrl);
                console.log("%cloadedmetadata", "color: green;");
                video.currentTime = clip.start / 1_000_000;
            };
            load();
        }
    }, [...clipIds]);

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

    const videoMeta = useCreation(() => {
        const videoFound = seekVideo(0, mainTrack);

        if (!videoFound) {
            throw new Error("video not found");
        }
        return videoFound;
    }, []);

    const videoMetaRef = useRef<VideoMeta | null>(videoMeta);

    const createVideoSync = useCallback(
        (metaData: VideoMeta, fromDiffSet = false) => {
            const preloadNext = () => {
                const clipIndex = mainTrack.clips.findIndex(
                    (c) => c.id === metaData.id
                );
                let nextClipIndex = clipIndex + 1;
                let cacheCount = 2;
                let nextClip = mainTrack.clips[nextClipIndex];
                // cache max next 2 video
                while (nextClip && cacheCount > 0) {
                    if (
                        videoCache.has(
                            getCacheId(
                                nextClip.videoClip.sourceUrl,
                                nextClip.id
                            )
                        )
                    ) {
                        nextClipIndex++;
                        nextClip = mainTrack.clips[nextClipIndex];
                        continue;
                    }
                    console.log(
                        "%cpreload nextClip",
                        "color: green; font-size: 28px;"
                    );
                    const video = preloadUtils.createVideo("metadata");
                    videoCache.set(
                        getCacheId(nextClip.videoClip.sourceUrl, nextClip.id),
                        video
                    );
                    waitForLoadedMetadata2(
                        video,
                        nextClip.videoClip.sourceUrl
                    ).then(() => {
                        console.log("%cloadedmetadata", "color: green;");
                        video.currentTime = nextClip.start / 1_000_000;
                    });
                    nextClipIndex++;
                    cacheCount--;
                    nextClip = mainTrack.clips[nextClipIndex];
                }
            };

            if (
                videoCache.has(
                    getCacheId(metaData.videoClip.sourceUrl, metaData.id)
                )
            ) {
                console.log("%ccache hit", "color: green; font-size: 28px;");
                console.log(metaData.id);
                const cachedVideo = videoCache.get(
                    getCacheId(metaData.videoClip.sourceUrl, metaData.id)
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
        []
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

    const diffSetVideoMeta = useMemoizedFn((videoMeta: VideoMeta) => {
        if (videoMeta?.id === videoMetaRef.current?.id) return;
        videoMetaRef.current = videoMeta;

        console.log("%csetVideoWithDiff", "color: blue;");

        const currentLoadId = ++requestLoadId.current;

        const cleanUp = () => {
            // prevVideo.pause();
            // prevVideo.src = "";
            // prevVideo.load();
        };

        const load = async () => {
            if (currentLoadId === requestLoadId.current) {
                const { video, fromCache } = createVideoSync(videoMeta, true);

                if (!fromCache) {
                    video.src = videoMeta.videoClip.sourceUrl;
                    video.load();
                }

                flushSync(() => {
                    setVideo(video);
                    video.play();
                });
                syncRectMeta(videoMeta);

                setTimeout(() => {
                    cleanUp();
                });
            }
        };

        load();
    });

    const [transform, setTransform] = useState(1);

    const { video: __video, fromCache } = useCreation(() => {
        return createVideoSync(videoMeta);
    }, []);

    const [video, setVideo] = useState<HTMLVideoElement>(__video);

    useEffect(() => {
        return $on(
            "start",
            () => {
                if (useTimelineStore.getState().showPoster) {
                    useTimelineStore.getState().togglePoster();
                }
                if (video && videoMeta) {
                    syncRectMeta(videoMeta);
                    if (!fromCache) {
                        // video.muted = true;
                        video.src = videoMeta.videoClip.sourceUrl;
                        video.load();
                        video.currentTime = videoMeta.start / 1_000_000;
                    }
                }
            },
            timeline
        );
    }, [video, timeline]);

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
                        if (video && video.paused) {
                            video.play();
                        }
                    },
                },
            ],
            timeline
        );
    }, [video, timeline]);

    useEffect(() => {
        return $on(
            "update",
            (event: EVENT_UPDATE) => {
                const videoMeta = seekVideo(event.elapsedTime, mainTrack);

                if (videoMeta) {
                    diffSetVideoMeta(videoMeta);

                    // const duration = 2_000;
                    // const value = easeIn(
                    //     0.8,
                    //     1,
                    //     duration,
                    //     clamp(
                    //         event.elapsedTime - videoMeta.inPoint / 1_000,
                    //         0,
                    //         duration
                    //     )
                    // );

                    // setTransform(value);
                }
            },
            timeline
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
            timeline
        );
    }, [timeline, video]);

    const clipId = videoMetaRef.current?.id;

    const filterParams = useMemo(() => {
        let blur = 0;
        if (videoMeta.videoClip.filterParam) {
            blur = 20;
        }
        return {
            blur,
            quality: 10,
            resolution: devicePixelRatio || 1,
        };
    }, [videoMeta.videoClip.filterParam]);

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

    return (
        <Filters
            ref={cContainerRef}
            // anchor={0.5}
            // HACK: I maybe only have a title bit idea why this works 🥹
            key={containerKey}
            x={rectMeta.x + (rectMeta.width * rectMeta.scale.x) / 2}
            y={rectMeta.y + (rectMeta.height * rectMeta.scale.y) / 2}
            scale={{
                x: rectMeta.scale.x,
                y: rectMeta.scale.y,
            }}
            blur={filterParams}
            // alpha={transform}
            pivot={{
                x: rectMeta.width / 2,
                y: rectMeta.height / 2,
            }}
        >
            <Sprite
                key={spriteKey}
                ref={cSpriteRef}
                video={video}
                height={rectMeta.height || video.videoHeight}
                width={rectMeta.width || video.videoWidth}
            />
        </Filters>
    );
});
export default MainVideoTrack;
