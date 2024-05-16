import { sleep } from "./delay";
import { withPromise } from "./withPromise";

export const extractFrame = async (url: string, frame: number) => {
	const { promise, resolve, reject } = withPromise<string>();
	const video = document.createElement("video");
	video.crossOrigin = "anonymous";
	video.hidden = true;
	video.style.display = "none";
	const canvas = document.createElement("canvas");
	canvas.style.display = "none";
	const context = canvas.getContext("2d")!;
	setTimeout(() => {
		reject(new Error("Extract Frame Timeout"));
	}, 3000);
	video.addEventListener("loadeddata", () => {
		// Set the canvas size to match the video
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		// Seek to just about the second frame
		video.currentTime = frame / 30;
	});

	const draw = () => {
		context.drawImage(video, 0, 0, canvas.width, canvas.height);

		video.remove();
		// Convert the canvas to an image format
		resolve(canvas.toDataURL("image/png"));
	};

	const onCanPlay = () => {
		draw();
	};

	video.addEventListener("seeked", async () => {
		// Draw the video frame to the canvas
		if (video.readyState >= 4) {
			draw();
		} else {
			video.addEventListener("canplay", onCanPlay);
		}
	});

	video.src = url;
	video.load();

	return promise;
};
