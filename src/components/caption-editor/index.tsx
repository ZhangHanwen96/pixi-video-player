// import MdiDragHorizontal from "~icons/mdi/drag-horizontal";
import { EVENT_UPDATE, TimelineEventTypes } from "@/Timeline";
import MdiDrag from "~icons/mdi/drag";
import MdiCloseThick from "~icons/mdi/close-thick";
import { motion, useDragControls, AnimatePresence } from "framer-motion";
import { useMergedState } from "rc-util";
import dayjs, { Dayjs } from "dayjs";
import { TimePicker } from "antd";
import { produce } from "immer";
import { $on } from "@/event-utils";
import { CaptionTrack } from "@/interface/vmml";
import { useTimelineStore } from "@/store";
import { useDeepCompareEffect, useMemoizedFn } from "ahooks";
import classNames from "classnames";
import EventEmitter from "eventemitter3";
import { FC, useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";

// format time in seconds to mm:ss
const formatTime = (time: number) => {
	const minutes = Math.floor(time / 60);
	const seconds = Math.floor(time % 60);
	return `${minutes}:${seconds}`
		.split(":")
		.map((s) => s.padStart(2, "0"))
		.join(":");
};

type UpdateTime = (id: string, type: "start" | "end", to: number) => void;
type UpdateCaption = (id: string, cap: string) => void;

const CaptionClip: FC<{
	active: boolean;
	clip: CaptionTrack["clips"][number];
	seekPlayer: () => void;
	updateTime: UpdateTime;
	updateCaption: UpdateCaption;
}> = ({ clip, active, seekPlayer, updateTime, updateCaption }) => {
	const { textClip, id, inPoint, duration } = clip;
	const s = inPoint / 1_000;
	const e = (inPoint + duration) / 1_000;

	// const foramttedStart = formatTime(inPoint / 1_000_000);
	// const formattedEnd = formatTime((inPoint + duration) / 1_000_000);

	// const [{ start, end }, setValue] = useState(() => ({
	// 	start: dayjs().startOf("day").add(s, "milliseconds"),
	// 	end: dayjs().startOf("day").add(e, "milliseconds"),
	// }));

	const onDisplayChange = (type: "start" | "end", time: Dayjs) => {
		// this is what vmml needs
		const to = time.diff(time.startOf("day"));

		// setValue((prev) => ({
		// 	...prev,
		// 	[type]: time,
		// }));

		updateTime(id, type, Math.round(to * 1000));
	};

	return (
		<div key={id} className="" data-clipId={clip.id}>
			<div className="flex flex-col items-start gap-1">
				<div className="text-xs bg-black/10 backdrop-blur rounded text-white px-2 py-1">
					{/* <span>{foramttedStart}</span> - <span>{formattedEnd}</span> */}
					<TimePicker
						value={dayjs().startOf("day").add(s, "milliseconds")}
						onChange={(v) => {
							onDisplayChange("start", v);
						}}
						format={"HH:mm:ss"}
						allowClear={false}
						showNow={false}
						suffixIcon={null}
					/>
					<span> - </span>
					<TimePicker
						value={dayjs().startOf("day").add(e, "milliseconds")}
						onChange={(v) => {
							onDisplayChange("end", v);
						}}
						format={"HH:mm:ss"}
						allowClear={false}
						showNow={false}
						suffixIcon={null}
					/>
				</div>

				<span
					className={classNames(
						"text-white text-left break-all bg-white/10 px-1 rounded-sm",
						"cursor-pointer hover:bg-white/20",
						active && "!text-green-500 !bg-transparent",
					)}
					onClick={() => {
						if (active) return;
						seekPlayer();
					}}
				>
					{textClip.textContent}
				</span>
			</div>
		</div>
	);
};

const CaptionEditor: FC<{
	captionTrack: CaptionTrack;
	onClose: () => void;
	open: boolean;
}> = ({ captionTrack: _captionTrack, onClose, open }) => {
	const [captionTrack, setCaptionTrack] = useMergedState(_captionTrack);

	const updateUtil = {
		updateTime: (id: string, type: "start" | "end", to: number) => {
			const newState = produce(captionTrack, (draft) => {
				const clip = draft.clips.find((clip) => clip.id === id);
				if (!clip) return;
				if (type === "start") {
					clip.inPoint = to;
				} else {
					clip.duration = to - clip.inPoint;
				}
			});
			setCaptionTrack(newState);
		},
		updateCaption: (id: string, cap: string) => {
			const newState = produce(captionTrack, (draft) => {
				const clip = draft.clips.find((clip) => clip.id === id);
				if (!clip) return;
				clip.textClip.textContent = cap;
			});
			setCaptionTrack(newState);
		},
	};

	const timeline = useTimelineStore.use.timeline?.(true);
	const [captionClip, setCaptionClip] =
		useState<CaptionTrack["clips"][number]>();
	const captionClipRef = useRef<CaptionTrack["clips"][number]>();

	const activeId = captionClip?.id;
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// scroll to active caption
		if (!containerRef.current || !activeId) return;
		const activeElement = containerRef.current.querySelector(
			`[data-clipId="${activeId}"]`,
		);
		if (!activeElement) return;

		activeElement.scrollIntoView({
			behavior: "smooth",
			block: "center",
			inline: "center",
		});
	}, [activeId, containerRef.current]);

	useDeepCompareEffect(() => {
		return $on(
			"update",
			(event: EVENT_UPDATE) => {
				const currentCaption = captionTrack.clips.find((clip) => {
					const start = clip.inPoint / 1_000;
					const end = (clip.inPoint + clip.duration) / 1_000;
					return (
						event.elapsedTime >= start &&
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						event.elapsedTime <= end
					);
				});

				if (captionClipRef.current?.id !== currentCaption?.id) {
					captionClipRef.current = currentCaption;
					setCaptionClip(currentCaption);
				}
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline, ...captionTrack.clips.map(({ id }) => id)]);

	const seekPlayer = useMemoizedFn((clip: CaptionTrack["clips"][number]) => {
		timeline?.seek(clip.inPoint / 1_000);
	});

	const controls = useDragControls();

	return (
		// <Draggable
		// 	defaultPosition={{
		// 		x: 100,
		// 		y: 0,
		// 	}}
		// 	defaultClassName="fixed z-10"
		// 	handle=".handle"
		// >
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ scale: 0.9 }}
					animate={{ scale: 1 }}
					exit={{ scale: 0.9 }}
					className="antialiased fixed z-10 top-12 right-8  rounded-md overflow-hidden"
					dragControls={controls}
					drag
					dragListener={false}
					transition={{
						type: "spring",
						duration: 0,
					}}
					dragMomentum={false}
				>
					<div
						onPointerDown={(e) => {
							controls.start(e);
						}}
						className="handle justify-center items-center flex relative w-full h-10 cursor-grab bg-[#292D39] backdrop-blur text-3xl text-[#828385c4] hover:text-white delay-100 duration-150 ease-in-out transition-all"
					>
						<MdiDrag />
						<MdiCloseThick
							onClick={onClose}
							className="absolute right-2 text-xl cursor-pointer text-white hover:text-white"
						/>
					</div>
					<div
						ref={containerRef}
						className="w-[500px] h-[400px] flex flex-col gap-4 resize-y bg-[#181C20] py-4 px-4 overflow-y-auto"
					>
						{captionTrack.clips.map((clip) => {
							return (
								<CaptionClip
									updateTime={updateUtil.updateTime}
									updateCaption={updateUtil.updateCaption}
									seekPlayer={() => seekPlayer(clip)}
									active={activeId === clip.id}
									key={clip.id}
									clip={clip}
								/>
							);
						})}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
		// </Draggable>
	);
};

export default CaptionEditor;
