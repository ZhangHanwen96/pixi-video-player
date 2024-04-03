/* eslint-disable react-refresh/only-export-components */
import { FC, memo } from "react";
import clx from "classnames";
import { useTimelineStore } from "./store";

const VideoPoster: FC<{
	className?: string;
	url: string;
	imgClassName?: string;
}> = ({ className, url, imgClassName }) => {
	const showPoster = useTimelineStore.use.showPoster();

	return (
		showPoster && (
			<div className={clx(className, "absolute inset-0")}>
				<img
					src={url}
					crossOrigin="anonymous"
					alt="video poster"
					className={clx("w-full h-full object-cover", imgClassName)}
				/>
			</div>
		)
	);
};

export default memo(VideoPoster);
