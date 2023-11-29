import { withPromise } from "../utils/withPromise";

export type VideoPreload = "auto" | "metadata" | "none";

const createPreloadLink = (url: string) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.crossOrigin = "anonymous";
    link.href = url;

    return link;
};

const preloadWithLink = (url: string) => {
    const link = createPreloadLink(url);
    document.head.appendChild(link);
    return link;
};

const removePreloadLink = (url: string) => {
    const preloadLink = document.querySelector(
        `link[href="${url}"][rel="preload"][as="video"]`
    );
    if (preloadLink) {
        preloadLink.remove();
        return true;
    }
    return false;
};

const createVideo = (preload: VideoPreload = "auto") => {
    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = false;
    video.preload = preload;
    video.style.display = "none";
    return video;
};

const hardCancelVideoLoad = (video: HTMLVideoElement) => {
    video.pause();
    video.src = "";
    video.load();
};

const waitForLoadedMetadata = (url: string) => {
    const { promise, reject, resolve } = withPromise<HTMLVideoElement>();
    const video = createVideo("auto");

    video.addEventListener("loadedmetadata", function handler() {
        resolve(video);
        video.removeEventListener("loadedmetadata", handler);
    });

    video.addEventListener("error", function handler() {
        reject(video);
        video.removeEventListener("error", handler);
    });

    video.src = url;

    return promise;
};

const waitForCanPlay = (url: string, currentTime: number = 0) => {
    const { promise, reject, resolve } = withPromise<HTMLVideoElement>();
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.autoplay = false;

    setTimeout(() => {
        reject(new Error("timeout"));
    }, 6_000);

    // step 1
    video.addEventListener("loadedmetadata", function handler() {
        // final step 3
        const onCanPlay = () => {
            resolve(video);
            video.removeEventListener("canplay", onCanPlay);
        };

        // step 2
        const onSeeked = () => {
            if (video.readyState >= 4) {
                resolve(video);
            } else {
                video.addEventListener("canplay", onCanPlay);
            }

            video.removeEventListener("seeked", onSeeked);
        };

        video.addEventListener("seeked", onSeeked);

        video.currentTime = currentTime;
    });

    video.addEventListener("error", function handler() {
        reject(video);
        video.removeEventListener("error", handler);
    });

    video.src = url;

    return promise;
};

const preloadUtils = {
    preloadWithLink,
    removePreloadLink,
    createVideo,
    hardCancelVideoLoad,
    waitForLoadedMetadata,
    waitForCanPlay,
};

export default preloadUtils;
export { preloadUtils };
