import { extractFrame } from "@/utils/extractVideoFrame";
import { useEffect, useState } from "react";

export const usePoster = (url: string | undefined, frame = 3) => {
	const [poster, setPoster] = useState<string>();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!url) {
			setPoster(undefined);
		}
		let dirty = false;

		const generatePoster = async () => {
			const src = await extractFrame(url as string, frame);
			if (dirty) return;
			setPoster(src);
		};

		setLoading(true);
		(async () => {
			try {
				await generatePoster();
			} finally {
				if (dirty) {
					return;
				}
				setLoading(false);
			}
		})();

		return () => {
			dirty = true;
		};
	}, [url, frame]);

	return { poster, loading } as const;
};
