import { VMMLTemplateV4 } from "@/interface/vmml";
import { useTezignPlayerStore } from "@/store/tezignPlayer";
import { FC, useMemo } from "react";
import { usePoster } from "./usePoster";
import VideoPoster from "@/VideoPoster";

const extractSourceurl = (vmml: VMMLTemplateV4) => {
	const videoTracks = vmml.tracks
		.filter(({ type }) => type === 0 || type === 1)
		.sort((a, b) => a.type - b.type);

	const sourceUrl = videoTracks[0]?.clips[0].videoClip?.sourceUrl;
	return sourceUrl;
};

type Poster = {
    auto: boolean
} | {
    url: string;
}

const Poster: FC<Poster> = (props) => {
	const vmml = useTezignPlayerStore.use.vmml?.(true);

	const sourceUrl = useMemo(() => {
		if (!vmml || props.auto) return undefined;
		return extractSourceurl(vmml);
	}, [vmml, props.auto]);

	const { poster } = usePoster(sourceUrl);

	if (!poster) {
		return null;
	}

	return (
		<VideoPoster
			className={"aniamte-fadein"}
			style={{
				objectFit: "cover",
			}}
			url={poster}
		/>
	);
};

export default Poster;
