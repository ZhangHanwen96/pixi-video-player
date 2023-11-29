/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as PIXI from "pixi.js";
import {
    useCreation,
    useDeepCompareEffect,
    useMemoizedFn,
    useMount,
    usePrevious,
} from "ahooks";
import { Spin } from "antd";
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
import { difference } from "lodash-es";
import { withPromise } from "./utils/withPromise";
import { $on } from "./event-utils";

let lastRequestPauseTime = 0;

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

class CacheManager {
    #cache: Map<string, { metadata?: Record<string, any>; clipId: string[] }> =
        new Map();

    constructor() {}

    get(url: string) {
        return this.#cache.get(url);
    }

    setMetadata(url: string, metadata: Record<string, any>) {
        const found = this.#cache.get(url);
        if (found) {
            found.metadata = metadata;
        } else {
            this.#cache.set(url, {
                metadata,
                clipId: [],
            });
        }
    }

    setCachedClipId(url: string, clipId: string) {
        const found = this.#cache.get(url);
        if (found) {
            found.clipId.push(clipId);
        } else {
            this.#cache.set(url, {
                metadata: undefined,
                clipId: [clipId],
            });
        }
    }

    checkByClipId(url: string, clipId: string) {
        const found = this.#cache.get(url);
        if (!found) return false;
        return found.clipId.includes(clipId);
    }

    getMetadata(url: string) {
        const found = this.#cache.get(url);
        if (!found) return undefined;
        return found.metadata;
    }
}

const cacheManager = new CacheManager();

const waitForMetadataLoad = (videoUrl: string) => {
    const { promise, resolve, reject } = withPromise();
    const video = document.createElement("video");
    video.addEventListener("loadedmetadata", function loadedHandler() {
        cacheManager.setMetadata(videoUrl, {
            width: video.videoWidth,
            height: video.videoHeight,
        });
        resolve(video);
        video.removeEventListener("loadedmetadata", loadedHandler);
    });
    video.addEventListener("error", function errorHandler(e) {
        reject(e.error);
        video.removeEventListener("error", errorHandler);
    });
    video.autoplay = false;
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.src = videoUrl;

    video.load();

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

    useEffect(() => {
        useTimelineStore.getState().setApp(app);
        app.stop();
        app.ticker.stop();
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

    const loadIdRef = useRef(0);

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

    const createVideoSync = useCallback((metaData: any, metadata = true) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.volume = 0;
        if (!metadata) return video;
        video.addEventListener("loadedmetadata", function handler() {
            cacheManager.setMetadata(metaData.videoClip.sourceUrl, {
                width: video.videoWidth,
                height: video.videoHeight,
            });
            console.log("%cloadedmetadata", "color: green;");
            const vHeight = video.videoHeight;
            const vWidth = video.videoWidth;
            console.log("video rect: ", vHeight, vWidth);
            syncRect(vWidth, vHeight);
            video.currentTime = metaData.start / 1_000_000;
            video.removeEventListener("loadedmetadata", handler);
        });
        return video;
    }, []);

    const syncRect = useMemoizedFn((vWidth: number, vHeight: number) => {
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
    });

    const createVideoAndWaitForPlay = useCallback((metaData: any) => {
        const { promise, reject, resolve } = withPromise();
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.volume = 0;
        video.autoplay = false;

        video.addEventListener("loadedmetadata", function handler() {
            video.removeEventListener("loadedmetadata", handler);

            cacheManager.setMetadata(metaData.videoClip.sourceUrl, {
                width: video.videoWidth,
                height: video.videoHeight,
            });

            console.log("%cloadedmetadata", "color: green;");

            const vHeight = video.videoHeight;
            const vWidth = video.videoWidth;

            syncRect(vWidth, vHeight);

            const onCanPlay = () => {
                console.log("Video is playable at this time. onCanPlay");

                cacheManager.setCachedClipId(
                    metaData.videoClip.sourceUrl,
                    metaData.id
                );
                resolve(video);
                console.log("resolve");
                video.removeEventListener("canplay", onCanPlay);
            };

            const onSeeked = () => {
                if (video.readyState >= 4) {
                    console.log("Video is playable at this time. onSeeked");
                    resolve(video);
                } else {
                    console.log("Video is not yet playable, waiting for data.");
                    video.addEventListener("canplay", onCanPlay);
                }

                video.removeEventListener("seeked", onSeeked);
            };

            video.addEventListener("seeked", onSeeked);

            video.currentTime = metaData.start / 1_000_000;
        });
        video.addEventListener("error", function handler(e) {
            reject(e.error);
            console.error(e.error);
            video.removeEventListener("error", handler);
        });

        video.src = metaData.videoClip.sourceUrl;

        video.load();

        return promise;
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

    const [video, setVideo] = useState<HTMLVideoElement>(() => {
        if (!videoMeta) {
            initialized2.current = true;
            return;
        }
        if (initialized2.current) return;

        initialized2.current = true;

        const videoElement = createVideoSync(videoMeta);
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

    const timerRef = useRef<any>(null);

    const loadUtils = useRef({
        beforeLoad: (url: string) => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            lastRequestPauseTime = Date.now();

            timeLineRef.current?.stop();

            // TODO: refactor loading logic
            timerRef.current = setTimeout(() => {
                setLoadingState(() => ({
                    loading: true,
                    url,
                }));
                timerRef.current = null;
            }, 200);
        },
        doneLoading: (url: string) => {
            if (!useTimelineStore.getState().pausedByController) {
                timeLineRef.current?.resume();
            }

            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            } else {
                setLoadingState((pre) => ({
                    ...pre,
                    loading: false,
                }));
            }
        },
    });

    const setVideoWithDiff = useMemoizedFn((videoMeta) => {
        if (videoMeta?.id === videoMetaRef.current?.id) return;
        videoMetaRef.current = videoMeta;

        console.log("%csetVideoWithDiff, id: ", "color: blue;");
        console.log(videoMeta.id);

        const currentLoadId = ++loadIdRef.current;

        const prevVideo = video;

        const cleanUp = () => {
            // prevVideo.pause();
            // prevVideo.src = "";
            // prevVideo.load();
        };

        const load = async () => {
            const cacheHit = PIXI.Assets.cache.get(
                videoMeta.videoClip.sourceUrl
            );

            if (cacheHit) {
                console.log("cache hit");
                const videoElement = createVideoSync(videoMeta);
                videoElement.src = videoMeta.videoClip.sourceUrl;
                videoElement.load();

                setTimeout(() => {
                    cleanUp();
                    // prevVideo.remove();
                });

                flushSync(() => {
                    setVideo(videoElement);
                });

                loadUtils.current.doneLoading(videoMeta.videoClip.sourceUrl);
            } else {
                console.log(
                    "%ccache missing",
                    "color: green; font-size: 30px;"
                );
                loadUtils.current.beforeLoad(videoMeta.videoClip.sourceUrl);
                // await PIXI.Assets.load(videoMeta.videoClip.sourceUrl);
                if (!cacheManager.getMetadata(videoMeta.videoClip.sourceUrl)) {
                    await waitForMetadataLoad(videoMeta.videoClip.sourceUrl);
                }

                const delay = (ms: number) => {
                    return new Promise((resolve) => {
                        setTimeout(resolve, ms);
                    });
                };
                // await delay();

                if (currentLoadId === loadIdRef.current) {
                    console.log("same id");

                    let metadataHit = false;
                    if (
                        cacheManager.getMetadata(videoMeta.videoClip.sourceUrl)
                    ) {
                        metadataHit = true;
                        const { width, height } = cacheManager.getMetadata(
                            videoMeta.videoClip.sourceUrl
                        );
                        syncRect(width, height);
                    }

                    let videoElement: HTMLVideoElement;
                    if (
                        cacheManager.checkByClipId(
                            videoMeta.videoClip.sourceUrl,
                            videoMeta.id
                        )
                    ) {
                        videoElement = createVideoSync(videoMeta, !metadataHit);
                        videoElement.src = videoMeta.videoClip.sourceUrl;
                        videoElement.load();
                    } else {
                        videoElement = (await createVideoAndWaitForPlay(
                            videoMeta
                        )) as HTMLVideoElement;
                    }

                    const elapsedDuration = Date.now() - lastRequestPauseTime;
                    if (elapsedDuration < 16 * 16 && elapsedDuration > 16 * 4) {
                        await delay(16 * 16 - elapsedDuration);
                    }

                    console.log("videoElement", videoElement);

                    // videoElement.src = videoMeta.videoClip.sourceUrl;
                    // // videoElement.currentTime = videoMeta.start / 1_000_000;
                    // videoElement.load();

                    setTimeout(() => {
                        cleanUp();
                        // prevVideo.remove();
                    });

                    flushSync(() => {
                        setVideo(videoElement);
                        loadUtils.current.doneLoading(
                            videoMeta.videoClip.sourceUrl
                        );
                    });

                    // loadUtils.current.doneLoading(
                    //     videoMeta.videoClip.sourceUrl
                    // );
                }
            }
        };

        load();

        return;

        prevVideo.pause();
        prevVideo.src = "";
        prevVideo.load();

        videoMetaRef.current = videoMeta;

        const videoElement = createVideoSync();
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
            timeline?.off("complete", handler);
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

    useEffect(() => {
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

    return (
        <div
            style={{
                display: "flex",
                position: "relative",
            }}
        >
            {!!video && (
                <Stage width={800} height={600}>
                    <SetUp />
                    <Filters
                        anchor={0.5}
                        blur={{
                            blur: 20,
                            quality: 10,
                            resolution: devicePixelRatio || 1,
                        }}
                    >
                        <Sprite
                            key={video.src}
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
                            key={video.src}
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
                        background: "rgb(223 223 223 / 24%)",
                    }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <Spin spinning={true} size="large"></Spin>
                </div>
            )}
            <TimeControl />
        </div>
    );
};
