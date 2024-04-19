/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { memo, useEffect, useRef, useState } from "react";
import {
	useMove,
	useMouse,
	useResizeObserver,
	mergeRefs,
} from "@mantine/hooks";
import { EVENT_UPDATE, FRAME_RATE, TimeLineContoller } from "@/Timeline";
import { useMemoizedFn, useUpdate, useResponsive, useSize } from "ahooks";
import { useTimelineStore } from "@/store";
import MdiFullscreenExit from "~icons/mdi/fullscreen-exit";
import MdiPlay from "~icons/mdi/play";
import MdiFullscreen from "~icons/mdi/fullscreen";
import MdiSpeedometerSlow from "~icons/mdi/speedometer-slow";
import MdiVolume from "~icons/mdi/volume";
import MdiVolumeOff from "~icons/mdi/volume-off";
import MdiPlayCircleOutline from "~icons/mdi/play-circle-outline";
import MdiPauseCircleOutline from "~icons/mdi/pause-circle-outline";
import MdiRestart from "~icons/mdi/restart";
import { $on } from "@/event-utils";
import { Dropdown, Slider, Popover, Switch } from "antd";
import { useTezignPlayerStore } from "@/store/teizng-player";
import classNames from "classnames";

type Status = "pending" | "start" | "stop" | "resume" | "restart";

const format = (time: number) => {
	const minutes = `${Math.floor(time / 60)}`;
	const seconds = `${Math.floor(time % 60)}`;
	return `${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
};

const getStatus = (timeline?: TimeLineContoller): Status => {
	if (!timeline) return "pending";
	return timeline?.completed
		? "restart"
		: timeline?.isPlaying
		  ? "stop"
		  : timeline?.paused
			  ? "resume"
			  : "start";
};

const TimeControl = () => {
	const { timeline } = useTimelineStore();
	const isSeeking = useTezignPlayerStore.use.seekLoading(true);
	const showCaptionEditor = useTezignPlayerStore.use.showCaptionEditor(true);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const wrapperSize = useSize(wrapperRef);
	const isMobileLayout = !!wrapperSize && wrapperSize.width < 400;

	const volumeRef = useRef<number>(50);

	const durationDisplayRef = useRef<HTMLDivElement>(null);

	const { ref: sliderContainerRef1, x } = useMouse();

	const [sliderContainerRef2, { width, left }] = useResizeObserver();

	const { ref: sliderRef } = useMove(({ x }) => {
		if (sliderRef.current) {
			sliderRef.current.style.setProperty("--progress", `${x}`);
		}
		const timeToSeek = totalDuration * x;
		// TODO: seek and update when active
		timeline?.seek(timeToSeek, "control");
	});

	const sliderContainerRef = mergeRefs(
		sliderContainerRef1,
		sliderContainerRef2,
		sliderRef,
	);

	const currentHoverProgress = ((x - left) / width).toFixed(4);

	const forceUpdate = useUpdate();

	const totalDuration = timeline?.timeMetadata.totalDuration || 0;

	useEffect(() => {
		let handler = () => {};
		if (timeline) {
			timeline.on(
				"update",
				// @ts-ignore
				(handler = ({ progress }: EVENT_UPDATE) => {
					if (sliderRef.current) {
						sliderRef.current.style.setProperty(
							"--progress",
							`${progress}`,
						);
					}
				}),
			);
		}
		return () => {
			if (timeline) {
				timeline.off("update", handler);
			}
		};
	}, [timeline]);

	useEffect(() => {
		let handler = () => {};

		if (timeline) {
			durationDisplayRef.current!.setAttribute(
				"data-time",
				`${format(
					timeline.timeMetadata.elapsedTime / 1_000,
				)} / ${format(timeline.timeMetadata.totalDuration / 1_000)}`,
			);
			timeline.on(
				"common-update",
				// @ts-ignore
				(handler = () => {
					forceUpdate();
					const { elapsedTime, totalDuration } =
						timeline.timeMetadata;
					// format to mm:ss / mm:ss

					const formattedTime = `${format(
						elapsedTime / 1_000,
					)} / ${format(totalDuration / 1_000)}`;

					durationDisplayRef.current!.setAttribute(
						"data-time",
						formattedTime,
					);
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

	const status = getStatus(timeline);

	const [volume, setVolume] = useState((timeline?.audioVolume || 1) * 100);

	const handleButtonClick = useMemoizedFn(() => {
		if (timeline) {
			if (timeline.completed) {
				timeline.seek(0);
				return;
			}
			if (timeline.isPlaying) {
				console.log("%cstop", "color: black; font-size: 30px;");
				timeline.stop();
				useTimelineStore.setState({
					pausedByController: true,
				});
			} else {
				if (timeline.paused) {
					timeline.resume();
				} else {
					timeline.start();
				}
			}
		}
	});

	const statusIcon = () => {
		switch (status) {
			case "pending":
				return null;
			case "restart":
				return <MdiRestart />;
			case "start":
				return <MdiPlay />;
			case "stop":
				return <MdiPauseCircleOutline />;
			case "resume":
				return <MdiPlay />;
			default:
				return null;
		}
	};

	const toggleCaptionEditor = () => {
		useTezignPlayerStore.setState({
			showCaptionEditor:
				!useTezignPlayerStore.getState().showCaptionEditor,
		});
	};

	const showIcon = ["resume", "start"].includes(status);

	const renderSlider = () => {
		return (
			<div
				ref={sliderContainerRef}
				className="flex-auto group/slider rounded-sm bg-gray-700 cursor-pointer relative h-[4px] group hover:h-[6px] hover:bg-gray-400 origin-center transition-all duration-300 ease-in-out"
			>
				<div
					style={{
						width: `calc(var(--progress, 0) * 100%)`,
					}}
					className="bg-white cursor-pointer h-full"
				/>
				{/* Thumb */}
				<div
					className="rounded-[50%] bg-slate-100 top-1/2 -translate-y-1/2"
					style={{
						position: "absolute",
						// left: `calc(${value * 100}% - ${8}px)`,
						left: `calc(var(--progress, 0) * 100% - 8px)`,
						width: 16,
						height: 16,
					}}
				/>

				<div
					className="absolute bottom-full mb-2 -translate-x-1/2 group-hover/slider:translate-y-0 origin-center invisible group-hover/slider:visible group-hover/slider:opacity-100 opacity-70 delay-150"
					style={{
						left: `calc(${currentHoverProgress} * 100%)`,
						transition: "transform 0s, opacity 0.3s ease",
					}}
				>
					<div className="bg-white py-1 px-2 text-black rounded text-xs">
						{format(
							(parseFloat(currentHoverProgress) * totalDuration) /
								1_000,
						)}
					</div>
				</div>
			</div>
		);
	};

	return (
		<>
			<div
				className="absolute group/container inset-0 cursor-default flex items-center justify-center"
				ref={wrapperRef}
				onClick={() => {
					handleButtonClick();
				}}
			>
				{showIcon && !isSeeking && (
					<div className="w-16 h-16 hover:scale-110 transition-all duration-100 ease-in flex items-center justify-center cursor-pointer z-10 rounded-[50%] bg-white/60 backdrop-blur text-2xl text-black">
						<span className="text-5xl grid place-items-center">
							{statusIcon()}
						</span>
					</div>
				)}

				<div
					onClick={(e) => {
						e.stopPropagation();
					}}
					className={classNames([
						"translate-y-full group-hover/container:translate-y-0",
						"absolute bottom-0 inset-x-0 bg-black/30 backdrop-filter px-3 py-2 delay-150 transition-transform duration-300 ease-in-out",
					])}
				>
					{isMobileLayout && (
						<div className="mx-1 mb-2">{renderSlider()}</div>
					)}
					<div
						className={classNames([
							"flex w-full flex-row items-center",
							isMobileLayout && "justify-between",
						])}
					>
						<span
							onClick={handleButtonClick}
							className="text-2xl text-slate-200 hover:text-white cursor-pointer flex-none flex items-center shrink-0"
						>
							{statusIcon()}
						</span>
						{!isMobileLayout && (
							<div className="mx-8 flex-auto">
								{renderSlider()}
							</div>
						)}
						<div className="flex gap-2 flex-none items-center">
							<div
								ref={durationDisplayRef}
								data-time-fallback="00:00 / 00:00"
								className="display-time text-white pr-2"
							/>
							<Popover
								arrow={false}
								trigger={["hover"]}
								overlayInnerStyle={{
									padding: "8px 6px",
								}}
								content={
									<div className="h-32">
										<Slider
											vertical
											onChange={(v: number) => {
												setVolume(v);
												if (timeline) {
													timeline.audioVolume =
														v / 100;
												}
											}}
											value={volume}
											defaultValue={volume}
											min={0}
											max={100}
											step={1}
										/>
									</div>
								}
							>
								<span
									className="text-2xl inline-flex hover:text-white text-slate-200 cursor-pointer"
									onClick={() => {
										if (volume !== 0) {
											volumeRef.current = volume;
											setVolume(0);
											if (timeline) {
												timeline.audioVolume = 0;
											}
										} else {
											const nextVolume =
												volumeRef.current || 50;
											if (timeline) {
												timeline.audioVolume =
													nextVolume / 100;
											}
											setVolume(nextVolume);
										}
									}}
								>
									{volume === 0 ? (
										<MdiVolumeOff />
									) : (
										<MdiVolume />
									)}
								</span>
							</Popover>
							<Dropdown
								menu={{
									items: [
										{
											label: "1X",
											key: 1,
										},
										{
											label: "1.5X",
											key: 1.5,
										},
										{
											label: "2X",
											key: 2,
										},
									],
									onClick: (item) => {
										const speed = parseFloat(item.key);

										if (timeline) {
											timeline.speed = speed;
										}
									},
								}}
							>
								<span className="text-2xl inline-flex hover:text-white text-slate-200 cursor-pointer">
									<MdiSpeedometerSlow />
								</span>
							</Dropdown>
							{/* <Dropdown
                                menu={{
                                    items: [
                                        // must be divided by 60
                                        {
                                            label: "60",
                                            key: "60",
                                        },
                                        {
                                            label: "30",
                                            key: "30",
                                        },
                                        {
                                            label: "20",
                                            key: "20",
                                        },
                                    ],
                                    onClick: (item) => {
                                        if (timeline) {
                                            timeline.FPS = parseInt(item.key);
                                        }
                                    },
                                }}
                            >
                                <span className="text-2xl text-slate-200 cursor-pointer ant-icon">
                                    <MdiSpeedometerSlow />
                                </span>
                            </Dropdown> */}
							{/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
							<span
								onClick={() => {
									if (window.document.fullscreenElement) {
										useTezignPlayerStore
											.getState()
											.exitFullScreen();
									} else {
										useTezignPlayerStore
											.getState()
											.requestFullScreen();
									}

									forceUpdate();
								}}
								className="text-2xl hover:text-white inline-flex text-slate-200 cursor-pointer ant-icon"
							>
								{window.document.fullscreenElement ? (
									<MdiFullscreenExit />
								) : (
									<MdiFullscreen />
								)}
							</span>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default memo(TimeControl);
