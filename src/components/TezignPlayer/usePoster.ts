import { extractFrame } from "@/utils/extractVideoFrame";
import { useEffect, useState } from "react";

export const usePoster = (url?: string) => {
	const [poster, setPoster] = useState<string>();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!url) {
			setPoster(undefined);
		}
		let dirty = false;

		const generatePoster = async () => {
			const src = await extractFrame(url as string, 3);
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
	}, [url]);

	return { poster, loading } as const;
};
