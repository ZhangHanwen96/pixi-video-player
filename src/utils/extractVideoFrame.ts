import { withPromise } from "./withPromise";

export const extractFrame = async (url: string, frame: number) => {
	const { promise, resolve } = withPromise<string>();
	const video = document.createElement("video");
	video.crossOrigin = "anonymous";
	video.hidden = true;
	video.style.display = "none";
	const canvas = document.createElement("canvas");
	canvas.style.display = "none";
	const context = canvas.getContext("2d")!;
	video.addEventListener("loadeddata", function () {
		// Set the canvas size to match the video
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		// Seek to just about the second frame
		video.currentTime = frame / 30;
	});

	video.addEventListener("seeked", function () {
		// Draw the video frame to the canvas
		context.drawImage(video, 0, 0, canvas.width, canvas.height);

		// Convert the canvas to an image format
		resolve(canvas.toDataURL("image/png"));
	});

	video.src = url;
	video.load();

	return promise;
};
