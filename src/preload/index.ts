import { withPromise } from "../utils/withPromise";

export type VideoPreload = "auto" | "metadata" | "none";

const createPreloadLink = (url: string) => {
	const link = document.createElement("link");
	link.rel = "preload";
	link.as = "fetch";
	// link.crossOrigin = "anonymous";
	link.href = url;

	return link;
};

/**
 *
 * @param url
 * @returns HTMLLinkElement
 */
const preloadWithLink = (url: string) => {
	const preloadLink = document.querySelector(
		`link[href="${url}"][rel="preload"][as="fetch"]`,
	);
	if (preloadLink) return preloadLink;
	const link = createPreloadLink(url);
	document.head.appendChild(link);
	return link;
};

const removePreloadLink = (url: string) => {
	const preloadLink = document.querySelector(
		`link[href="${url}"][rel="preload"][as="fetch"]`,
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
	video.crossOrigin = "anonymous";
	video.autoplay = false;
	video.preload = preload;
	// video.style.display = "none";
	return video;
};

const hardCancelVideoLoad = (video: HTMLVideoElement) => {
	video.pause();
	video.src = "";
	video.load();
};

const waitForLoadedMetadata = (
	url: string,
	preload: VideoPreload = "auto",
): Promise<HTMLVideoElement> => {
	const { promise, reject, resolve } = withPromise<HTMLVideoElement>();
	const video = createVideo(preload);

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

export const waitForLoadedMetadata2 = (
	video: HTMLVideoElement,
	url: string,
): Promise<HTMLVideoElement> => {
	const { promise, reject, resolve } = withPromise<HTMLVideoElement>();

	video.addEventListener("loadedmetadata", function handler() {
		resolve(video);
		video.removeEventListener("loadedmetadata", handler);
	});

	video.addEventListener("error", function handler() {
		reject(video);
		video.removeEventListener("error", handler);
	});

	video.src = url;
	video.load();

	return promise;
};

const waitForCanPlay = (url: string, currentTime = 0) => {
	const { promise, reject, resolve } = withPromise<HTMLVideoElement>();
	const video = document.createElement("video");
	video.crossOrigin = "anonymous";
	video.muted = false;
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

export const waitForCanPlay2 = (video: HTMLVideoElement) => {
	const { promise, resolve } = withPromise<HTMLVideoElement>();
	video.addEventListener("canplay", function handler() {
		resolve(video);
		video.removeEventListener("canplay", handler);
	});

	return promise;
};

export const waitForCanPlay3 = (
	video: HTMLVideoElement,
	currentTime: number,
) => {
	const { promise, resolve } = withPromise<HTMLVideoElement>();

	const onCanPlay = () => {
		resolve(video);
		video.removeEventListener("canplay", onCanPlay);
	};

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
	return promise;
};

const preloadUtils = {
	preloadWithLink,
	removePreloadLink,
	createVideo,
	hardCancelVideoLoad,
	waitForLoadedMetadata,
	waitForCanPlay,
	waitForLoadedMetadata2,
	waitForCanPlay2,
	waitForCanPlay3,
};

export default preloadUtils;
export { preloadUtils };
