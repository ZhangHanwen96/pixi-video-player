import { extractFrame } from "@/utils/extractVideoFrame";
import { useEffect, useState } from "react";

export const usePoster = (url?: string) => {
	const [poster, setPoster] = useState("");
	useEffect(() => {
		if (!url) return;
		let dirty = false;

		const generatePoster = async () => {
			const src = await extractFrame(url, 3);
			if (dirty) return;
			setPoster(src);
		};

		generatePoster();
		return () => {
			dirty = true;
		};
	}, [url]);

	return [poster, setPoster] as const;
};
