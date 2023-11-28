/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as PIXI from "pixi.js";
import {
    useCreation,
    useDeepCompareEffect,
    useMemoizedFn,
    useMount,
    usePrevious,
} from "ahooks";
import testMp3 from "./assets/test.mp3";
import "./App.css";
import { Stage, Container, Sprite, withFilters, useApp } from "@pixi/react";
import {
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
    FC,
    useLayoutEffect,
} from "react";
import { calculatRectByObjectFit, calculateScale } from "./util";
import { Caption } from "./Caption";
import TimeControl from "./TimeControl";
import testsVideo from "./assets/test-video2.mp4";
import { EVENT_UPDATE } from "./Timeline";
import mockVideo from "./mockVideo";
import { flushSync } from "react-dom";
import { useTimelineStore } from "./store";
import SoundTrack from "./SoundTrack";

const withPromise = () => {
    let $resolve: (value: unknown) => void;
    let $reject: (value: unknown) => void;
    const promise = new Promise((resolve, reject) => {
        $resolve = resolve;
        $reject = reject;
    });
    return {
        promise,
        resolve: $resolve,
        reject: $reject,
    };
};

const playEmptyVideo = () => {
    const { promise, resolve } = withPromise();
    const video = document.createElement("video");
    video.src = testsVideo;
    video.load();
    video.hidden = true;
    video.muted = true;
    video.style.position = "fixed";
    video.style.top = "-1000px";
    video.style.left = "-1000px";
    video.style.zIndex = "-1000px";
    document.body.appendChild(video);
    video.autoplay = false;
    video.muted = true;

    const button = document.createElement("button");
    button.innerText = "play";
    button.style.position = "fixed";
    button.style.top = "-1000px";
    button.style.left = "-1000px";
    button.style.zIndex = "-1000px";
    document.body.appendChild(button);
    button.onclick = () => {
        console.log(11111);
        video.volume = 0;
        video.muted = true;
        video.play();
        setTimeout(() => {
            video.pause();
            video.src = "";
            video.load();
            resolve(true);
        }, 1000);
    };

    let handler = () => {};
    video.addEventListener(
        "timeupdate",
        // @ts-ignore
        (handler = (e) => {
            console.log(video.currentTime);
            if (video.currentTime > 1) {
                video.pause();
                video.src = "";
                video.load();
                resolve(true);
                video.removeEventListener("timeupdate", handler);
            }
        })
    );

    video.addEventListener("canplay", () => {
        button.click();
    });

    return promise;
};

const waitForCanPlay = (videoUrl: string) => {
    const { promise, resolve, reject } = withPromise();
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = videoUrl;
    video.addEventListener("canplay", () => {
        resolve(video);
    });
    video.load();
    video.onerror = reject;
    return promise;
};

const a = import.meta.glob(["./assets/*.mp4"], {
    eager: true,
});

// @ts-ignore
const videoUrls = Object.entries(a).map(([key, value]) => {
    // @ts-ignore
    return value.default;
});

console.log(videoUrls);

const SetUp = () => {
    const app = useApp();
    app.stop();
    useEffect(() => {
        useTimelineStore.getState().setApp(app);
    }, [app]);
    return null;
};

const Filters = withFilters(Container, {
    blur: PIXI.BlurFilter,
    // adjust: AdjustmentFilter,
});

/**
 *
 * @param currentTime in milli seconds
 */
const seekVideo = (currentTime: number) => {
    const found = mockVideo.find(({ inPoint, duration }) => {
        const endPoint = inPoint + duration;
        return currentTime >= inPoint / 1000 && currentTime <= endPoint / 1000;
    });
    if (!found) {
        throw new Error("Invalid time");
    }

    return found;
};

export const QSPlayer: FC<{ setApp: any }> = ({ setApp }) => {
    const { timeline } = useTimelineStore();
    const [wrapperRect, setWrapperRect] = useState({
        x: 0,
        y: 0,
        height: 0,
        width: 0,
    });

    const timeLineRef = useRef(timeline);
    timeLineRef.current = timeline;

    const wrapperRef = useRef<PIXI.Sprite>(null);
    const innerRef = useRef<PIXI.Sprite>(null);

    const [innerRect, setInnerRect] = useState({
        x: 0,
        y: 0,
        height: 0,
        width: 0,
    });

    useDeepCompareEffect(() => {
        console.log("wrapperRect: ", wrapperRect);
        console.log("innerRect: ", innerRect);
    }, [wrapperRect, innerRect]);

    const createVideo = useCallback((metaData: any) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.volume = 0;
        video.addEventListener("loadedmetadata", () => {
            console.log("loadedmetadata");

            const vHeight = video.videoHeight;
            const vWidth = video.videoWidth;
            console.log("video rect: ", vHeight, vWidth);
            flushSync(() => {
                const { x, y, height, width } = calculatRectByObjectFit(
                    {
                        containerRect: {
                            height: 600,
                            width: 800,
                        },
                        sourceRect: {
                            width: vWidth,
                            height: vHeight,
                        },
                    },
                    "cover"
                );
                setWrapperRect({ x, y, height, width });

                const rect2 = calculatRectByObjectFit(
                    {
                        containerRect: {
                            height: 600,
                            width: 800,
                        },
                        sourceRect: {
                            width: vWidth,
                            height: vHeight,
                        },
                    },
                    "contain"
                );

                setInnerRect({
                    x: rect2.x,
                    y: rect2.y,
                    width: rect2.width,
                    height: rect2.height,
                });

                if (wrapperRef.current && innerRef.current) {
                    wrapperRef.current.width = width;
                    wrapperRef.current.height = height;
                    wrapperRef.current.x = x;
                    wrapperRef.current.y = y;
                    innerRef.current.width = rect2.width;
                    innerRef.current.height = rect2.height;
                    innerRef.current.x = rect2.x;
                    innerRef.current.y = rect2.y;
                }
            });
            video.currentTime = metaData.start / 1_000_000;
        });
        return video;
    }, []);

    const initialized = useRef(false);
    const initialized2 = useRef(false);

    const videoMeta = useCreation(() => {
        if (initialized.current) return undefined;

        const videoFound = seekVideo(0);
        if (!videoFound) {
            throw new Error("video not found");
        }
        return videoFound;
    }, []);

    const videoMetaRef = useRef(videoMeta);

    useMount(() => {
        // playEmptyVideo();
    });

    // const video = useCreation(() => {
    //     const videoElement = createVideo();
    //     if (!videoMeta) return videoElement;

    //     videoElement.src = videoMeta.videoClip.sourceUrl;
    //     videoElement.autoplay = false;
    //     videoElement.muted = true;
    //     videoElement.currentTime = videoMeta.start / 1_000_000;

    //     return videoElement;
    // }, []);

    const [video, setVideo] = useState<HTMLVideoElement>(() => {
        if (!videoMeta) {
            initialized2.current = true;
            return;
        }
        if (initialized2.current) return;

        initialized2.current = true;

        const videoElement = createVideo(videoMeta);
        return videoElement;

        videoElement.autoplay = false;
        videoElement.muted = false;
        videoElement.src = videoMeta.videoClip.sourceUrl;
        // videoElement.currentTime = videoMeta.start / 1_000_000;
        videoElement.load();

        return videoElement;
    });
    // const currentLoadIdRef = useRef(0);

    const [loadingState, setLoadingState] = useState({
        loading: false,
        url: "",
    });

    const allUrls = mockVideo.map((m) => m.videoClip.sourceUrl);
    const allUrlsRef = useRef(allUrls);

    // useDeepCompareEffect(() => {
    //     const diff = difference(allUrlsRef.current, allUrls);
    //     allUrlsRef.current = allUrls;
    //     if (diff.length) {
    //         PIXI.Assets.unload(diff);
    //     }

    //     PIXI.Assets.backgroundLoad(allUrls);
    // }, [allUrls]);

    const loadUtils = useRef({
        beforeLoad: (url: string) => {
            setLoadingState(() => ({
                loading: true,
                url,
            }));

            // timeLineRef.current?.stop();
        },
        doneLoading: (url: string) => {
            setLoadingState((pre) => ({
                ...pre,
                loading: false,
            }));
            // timeLineRef.current?.resume();
        },
    });

    // const setVideoWithDiff = useMemoizedFn(
    //     (videoMeta: typeof videoMetaRef.current) => {
    //         if (videoMeta?.id === videoMetaRef.current?.id) return;
    //         // if(isEqualWith(videoMeta, videoMetaRef.current, (a, b) => {
    //         //     return a?.inPoint === b?.inPoint && a?.duration === b?.duration && a?.videoClip.sourceUrl === b?.videoClip.sourceUrl;
    //         // }))
    //         videoMetaRef.current = videoMeta;
    //         // setVideoMeta(meta);
    //         // console.log("setVideoWithDiff, id: ", meta.id);

    //         if (!videoMeta) return;
    //         const currentLoadId = ++currentLoadIdRef.current;

    //         const lastVideo = video;

    //         const load = async () => {
    //             const cacheHit = PIXI.Assets.cache.get(
    //                 videoMeta.videoClip.sourceUrl
    //             );
    //             if (cacheHit) {
    //                 const videoElement = createVideo();
    //                 videoElement.src = videoMeta.videoClip.sourceUrl;
    //                 videoElement.autoplay = false;
    //                 videoElement.muted = true;
    //                 // videoElement.currentTime = videoMeta.start / 1_000_000;
    //                 setTimeout(() => {
    //                     if (lastVideo) {
    //                         lastVideo.src = "";
    //                         lastVideo.load();
    //                     }
    //                 });
    //                 flushSync(() => {
    //                     setVideo(videoElement);
    //                 });
    //             }

    //             loadUtils.beforeLoad(videoMeta.videoClip.sourceUrl);

    //             await PIXI.Assets.load(videoMeta.videoClip.sourceUrl);

    //             if (currentLoadId === currentLoadIdRef.current) {
    //                 loadUtils.beforeLoad(videoMeta.videoClip.sourceUrl);
    //                 const videoElement = createVideo();
    //                 videoElement.src = videoMeta.videoClip.sourceUrl;
    //                 videoElement.autoplay = false;
    //                 videoElement.muted = true;
    //                 // videoElement.currentTime = videoMeta.start / 1_000_000;
    //                 setTimeout(() => {
    //                     if (lastVideo) {
    //                         lastVideo.src = "";
    //                         lastVideo.load();
    //                     }
    //                 });
    //                 flushSync(() => {
    //                     setVideo(videoElement);
    //                 });
    //             }
    //         };

    //         load();
    //     }
    // );

    const loadIdRef = useRef(0);

    const setVideoWithDiff = useMemoizedFn((videoMeta) => {
        if (videoMeta?.id === videoMetaRef.current?.id) return;
        videoMetaRef.current = videoMeta;

        console.log("setVideoWithDiff, id: ", videoMeta.id);

        const currentLoadId = ++loadIdRef.current;

        const prevVideo = video;

        const cleanUp = () => {
            prevVideo.pause();
            prevVideo.src = "";
            prevVideo.load();
        };

        const load = async () => {
            const cacheHit = PIXI.Assets.cache.get(
                videoMeta.videoClip.sourceUrl
            );

            if (cacheHit) {
                console.log("cache hit");
                const videoElement = createVideo(videoMeta);
                videoElement.src = videoMeta.videoClip.sourceUrl;
                videoElement.load();

                video.currentTime = videoMeta.start / 1_000_000;

                setTimeout(() => {
                    cleanUp();
                    prevVideo.remove();
                });

                flushSync(() => {
                    setVideo(videoElement);
                });

                loadUtils.current.doneLoading(videoMeta.videoClip.sourceUrl);
            } else {
                console.log("cache missing");
                loadUtils.current.beforeLoad(videoMeta.videoClip.sourceUrl);
                // await PIXI.Assets.load(videoMeta.videoClip.sourceUrl);
                // await waitForCanPlay(videoMeta.videoClip.sourceUrl);

                if (currentLoadId === loadIdRef.current) {
                    const videoElement = createVideo(videoMeta);
                    videoElement.src = videoMeta.videoClip.sourceUrl;
                    // videoElement.currentTime = videoMeta.start / 1_000_000;
                    videoElement.load();
                    video.currentTime = videoMeta.start / 1_000_000;

                    setTimeout(() => {
                        cleanUp();
                        prevVideo.remove();
                    });

                    flushSync(() => {
                        setVideo(videoElement);
                    });

                    loadUtils.current.doneLoading(
                        videoMeta.videoClip.sourceUrl
                    );
                }
            }
        };

        load();

        return;

        prevVideo.pause();
        prevVideo.src = "";
        prevVideo.load();

        videoMetaRef.current = videoMeta;

        const videoElement = createVideo();
        videoElement.src = videoMeta.videoClip.sourceUrl;
        // videoElement.currentTime = videoMeta.start / 1_000_000;
        videoElement.load();

        flushSync(() => {
            setVideo(videoElement);
        });

        setTimeout(() => {
            prevVideo.remove();
        });
    });

    useEffect(() => {
        let handler;
        timeline?.once(
            "start",
            (handler = () => {
                if (video && videoMeta) {
                    console.log("start video");
                    video.src = videoMeta.videoClip.sourceUrl;
                    // video.autoplay = true;
                    video.muted = false;
                    video.load();

                    video.currentTime = videoMeta.start / 1_000_000;
                }
            })
        );
        return () => {
            timeline?.off("start", handler);
        };
    }, [video, timeline]);

    useEffect(() => {
        let handler = () => {};
        timeline?.addListener(
            "complete",
            (handler = () => {
                if (video && !video.paused) {
                    video.pause();
                }
            })
        );
        return () => {
            timeline?.off("start", handler);
        };
    }, [video, timeline]);

    useEffect(() => {
        let handler = () => {};
        timeline?.on(
            "pause",
            (handler = () => {
                if (video && !video.paused) {
                    video.pause();
                }
            })
        );
        return () => {
            timeline?.off("pause", handler);
        };
    }, [video, timeline]);

    useEffect(() => {
        let handler = () => {};
        timeline?.on(
            "resume",
            (handler = () => {
                if (video && video.paused) {
                    video.play();
                }
            })
        );
        return () => {
            timeline?.off("resume", handler);
        };
    }, [video, timeline]);

    // useEffect(() => {
    //     if (!videoMeta) return;
    //     const currentLoadId = ++currentLoadIdRef.current;

    //     const lastVideo = video;

    //     const load = async () => {
    //         const cacheHit = PIXI.Assets.cache.get(
    //             videoMeta.videoClip.sourceUrl
    //         );
    //         if (cacheHit) {
    //             const videoElement = createVideo();
    //             videoElement.src = videoMeta.videoClip.sourceUrl;
    //             videoElement.autoplay = false;
    //             videoElement.muted = true;
    //             videoElement.currentTime = videoMeta.start / 1_000_000;
    //             setTimeout(() => {
    //                 lastVideo?.remove();
    //             });
    //             flushSync(() => {
    //                 setVideo(videoElement);
    //             });
    //         }

    //         loadUtils.beforeLoad(videoMeta.videoClip.sourceUrl);

    //         await PIXI.Assets.load(videoMeta.videoClip.sourceUrl);

    //         loadUtils.beforeLoad(videoMeta.videoClip.sourceUrl);

    //         if (currentLoadId === currentLoadIdRef.current) {
    //             const videoElement = createVideo();
    //             videoElement.src = videoMeta.videoClip.sourceUrl;
    //             videoElement.autoplay = false;
    //             videoElement.muted = true;
    //             videoElement.currentTime = videoMeta.start / 1_000_000;
    //             setTimeout(() => {
    //                 lastVideo?.remove();
    //             });
    //             flushSync(() => {
    //                 setVideo(videoElement);
    //             });
    //         }
    //     };

    //     load();
    // }, [videoMeta?.id]);

    // const video = useMemo(() => {
    //     if (!videoMeta) return null;

    //     const lastVideo = lastVideoRef.current;
    //     if (lastVideo) {
    //         lastVideo.src = "";
    //         lastVideo.load();
    //         lastVideo.remove();
    //     }

    //     const videoElement = createVideo();
    //     lastVideoRef.current = videoElement;
    //     videoElement.src = videoMeta.videoClip.sourceUrl;
    //     videoElement.autoplay = false;
    //     videoElement.muted = true;
    //     videoElement.currentTime = videoMeta.start / 1_000_000;
    //     setTimeout(() => {
    //         lastVideo?.remove();
    //     }, 30);
    //     // videoElement.currentTime = videoMeta.inPoint / 1_000_000;
    //     return videoElement;
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [videoMeta?.id]);

    // useLayoutEffect(() => {
    //     if (video && video?.muted) {
    //         video.muted = false;
    //     }
    // });

    useEffect(() => {
        if (!timeline) return;
        let handler = () => {};
        timeline.addListener(
            "update",
            (handler = (event: EVENT_UPDATE) => {
                const video = seekVideo(event.elapsedTime);
                if (video) setVideoWithDiff(video);
            })
        );
        return () => {
            timeline.removeListener("update", handler);
        };
    }, [timeline]);

    console.log("id", videoMetaRef.current?.id);

    return (
        <div
            style={{
                display: "flex",
                position: "relative",
            }}
        >
            {!!video && (
                <Stage width={800} height={600}>
                    <SetUp setApp={setApp} />
                    {/* <Container ref={ref} anchor={0.5}> */}
                    <Filters
                        anchor={0.5}
                        blur={{
                            blur: 20,
                            quality: 10,
                            resolution: devicePixelRatio || 1,
                        }}
                        key={
                            videoMetaRef.current?.id
                                ? videoMetaRef.current?.id + "1"
                                : undefined
                        }
                    >
                        <Sprite
                            ref={wrapperRef}
                            video={video}
                            {...wrapperRect}
                            alpha={0.7}
                        />
                    </Filters>
                    {/* </Container> */}
                    <Container
                        anchor={0.5}
                        key={
                            videoMetaRef.current?.id
                                ? videoMetaRef.current?.id + "2"
                                : undefined
                        }
                    >
                        <Sprite
                            // anchor={0}
                            ref={innerRef}
                            video={video}
                            {...innerRect}
                        />
                    </Container>

                    <Caption />
                    <SoundTrack url={testMp3} />
                    {/* <TestComp /> */}
                </Stage>
            )}
            {loadingState.loading && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        zIndex: 100,
                    }}
                >
                    loading...
                </div>
            )}
            <TimeControl />
        </div>
    );
};
