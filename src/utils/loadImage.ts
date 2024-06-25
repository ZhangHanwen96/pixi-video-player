import { withPromise } from "./withPromise";

export const loadImage = async (url: string) => {
	const img = new Image();
	const { promise, reject, resolve } = withPromise<HTMLImageElement>();
	img.onload = () => resolve(img);
	img.onerror = reject;

	img.crossOrigin = "anonymous";
	img.src = url;
	return promise;
};
