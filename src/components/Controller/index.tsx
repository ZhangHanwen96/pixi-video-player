/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { memo, useEffect, useRef, useState } from "react";
import { useMove } from "@mantine/hooks";
import { EVENT_UPDATE, FRAME_RATE, TimeLineContoller } from "@/Timeline";
import { useMemoizedFn, useUpdate } from "ahooks";
import { useTimelineStore } from "@/store";
import MdiSpeedometerSlow from "~icons/mdi/speedometer-slow";
import MdiVolume from "~icons/mdi/volume";
import MdiVolumeOff from "~icons/mdi/volume-off";
import MdiPlayCircleOutline from "~icons/mdi/play-circle-outline";
import MdiPauseCircleOutline from "~icons/mdi/pause-circle-outline";
import MdiRestart from "~icons/mdi/restart";
import { $on } from "@/event-utils";
import { Dropdown, Select } from "antd";

type Status = "pending" | "start" | "stop" | "resume" | "restart";

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

    const durationDisplayRef = useRef<HTMLDivElement>(null);

    const forceUpdate = useUpdate();

    const { ref: sliderRef } = useMove(({ x }) => {
        if (sliderRef.current) {
            sliderRef.current.style.setProperty("--progress", `${x}`);
        }
        const timeToSeek = 13176 * x;
        // TODO: seek and update when active
        timeline?.seek(timeToSeek);
    });

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
                            `${progress}`
                        );
                    }
                })
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
            timeline.on(
                "common-update",
                // @ts-ignore
                (handler = () => {
                    forceUpdate();
                    const { elapsedTime, totalDuration } =
                        timeline.timeMetadata;
                    // format to mm:ss / mm:ss
                    const format = (time: number) => {
                        const minutes = `${Math.floor(time / 60)}`;
                        const seconds = `${Math.floor(time % 60)}`;
                        return `${minutes.padStart(2, "0")}:${seconds.padStart(
                            2,
                            "0"
                        )}`;
                    };

                    const formattedTime = `${format(
                        elapsedTime / 1_000
                    )} / ${format(totalDuration / 1_000)}`;

                    console.log(formattedTime, "formattedTime");

                    durationDisplayRef.current!.setAttribute(
                        "data-time",
                        formattedTime
                    );
                })
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
            timeline
        );
    }, [timeline]);

    const status = getStatus(timeline);

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
                return <MdiPlayCircleOutline />;
            case "stop":
                return <MdiPauseCircleOutline />;
            case "resume":
                return <MdiPlayCircleOutline />;
            default:
                return null;
        }
    };

    return (
        <div className="absolute bottom-0 inset-x-0 bg-slate-800/70 backdrop-filter px-4 py-2">
            <div className="flex w-full flex-row items-center">
                <span
                    onClick={handleButtonClick}
                    className="text-2xl text-slate-200 flex-none flex items-center shrink-0"
                >
                    {statusIcon()}
                </span>
                <div
                    ref={sliderRef}
                    className="flex-auto ml-8 rounded-sm bg-gray-700 cursor-pointer relative h-[4px] group hover:h-[6px] hover:bg-gray-400 origin-center transition-all duration-300 ease-in-out"
                >
                    <div
                        style={{
                            width: `calc(var(--progress, 0) * 100%)`,
                        }}
                        className="bg-sky-600 cursor-pointer h-full"
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
                </div>
                <div className="flex gap-1 items-center">
                    <div
                        ref={durationDisplayRef}
                        data-time-fallback="00:00 / 00:00"
                        className="display-time text-white"
                    />
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
                        <span className="text-2xl text-slate-200 cursor-pointer">
                            <MdiSpeedometerSlow />
                        </span>
                    </Dropdown>

                    <Dropdown
                        menu={{
                            items: [
                                {
                                    label: "60",
                                    key: "60",
                                },
                                {
                                    label: "30",
                                    key: "30",
                                },
                                {
                                    label: "24",
                                    key: "24",
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
                    </Dropdown>
                </div>
            </div>
        </div>
    );
};

export default memo(TimeControl);
