/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useEffect, useState } from "react";
import { useMove } from "@mantine/hooks";
import { EVENT_UPDATE } from "./Timeline";
import { useUpdate } from "ahooks";
import { useTimelineStore } from "./store";
import { $on } from "./event-utils";

const TimeControl = () => {
	const { timeline } = useTimelineStore();

	const [value, setValue] = useState(0);

	const { ref: sliderRef } = useMove(({ x }) => {
		setValue(x);
		const timeToSeek = (timeline?.timeMetadata.totalDuration || 0) * x;
		console.log(`%cseekTime ${timeToSeek}`, "color: #00b300");
		timeline?.seek(timeToSeek);
	});

	useEffect(() => {
		let handler = () => {};
		if (timeline) {
			timeline.on(
				"update",
				// @ts-ignore
				(handler = ({ progress }: EVENT_UPDATE) => {
					setValue(progress);
				}),
			);
		}
		return () => {
			if (timeline) {
				timeline.off("update", handler);
			}
		};
	}, [timeline]);

	const forceUpdate = useUpdate();

	useEffect(() => {
		let handler = () => {};
		if (timeline) {
			timeline.on(
				"common-update",
				// @ts-ignore
				(handler = () => {
					forceUpdate();
				}),
			);
		}

		return () => {
			if (timeline) {
				timeline.off("common-update", handler);
			}
		};
	}, [timeline]);

	useEffect(() => {
		return $on(
			"resume",
			() => {
				const state = useTimelineStore.getState();
				if (state.pausedByController) {
					useTimelineStore.setState({
						pausedByController: false,
					});
				}
			},
			timeline,
		);
	}, [timeline]);

	return (
		<div
			style={{
				position: "absolute",
				bottom: 0,
			}}
		>
			<button
				type="button"
				onClick={() => {
					if (timeline) {
						if (timeline.completed) {
							timeline.seek(0);
							return;
						}
						if (timeline.isPlaying) {
							console.log(
								"%cstop",
								"color: black; font-size: 30px;",
							);
							timeline.stop();
							useTimelineStore.setState({
								pausedByController: true,
							});
						} else {
							if (timeline.paused) {
								timeline.resume();
							} else {
								timeline.seek(0);
							}
						}
					}
				}}
			>
				{timeline?.completed
					? "restart"
					: timeline?.isPlaying
					  ? "stop"
					  : timeline?.paused
						  ? "resume"
						  : "start"}
			</button>
			<div
				ref={sliderRef}
				style={{
					width: 800,
					height: 16,
					backgroundColor: "gray",
					position: "relative",
				}}
			>
				{/* Filled bar */}
				<div
					style={{
						width: `${value * 100}%`,
						height: 16,
						backgroundColor: "#0061d6",
					}}
				/>
				{/* Thumb */}
				<div
					style={{
						position: "absolute",
						left: `calc(${value * 100}% - ${8}px)`,
						top: 0,
						width: 16,
						height: 16,
						backgroundColor: "yellow",
					}}
				/>
			</div>
		</div>
	);
};

export default TimeControl;
