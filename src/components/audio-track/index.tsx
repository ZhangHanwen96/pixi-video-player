/* eslint-disable react-refresh/only-export-components */
import { Sound, SoundLibrary, sound } from "@pixi/sound";
import { $on, $ons } from "@/event-utils";
import { useTimelineStore } from "@/store";
import { AudioTrack } from "@/interface/vmml";
import { FC, memo, useEffect, useRef, useState } from "react";
import { EVENT_SEEK, TimelineEventTypes } from "@/Timeline";
import { seekAudio } from "./utils";
import { applyAudioTransition } from "@/animation/audio";
import { AudioTransitionCode } from "@/interface/animation";
import { useDeepCompareEffect, useMemoizedFn, useMount } from "ahooks";
import { hooks } from "../Controller/hooks";
import EventEmitter from "eventemitter3";

// TODO: sound instance per component

const AUDIO_ALIAS = "AUDIO_TRACK";

interface SoundTrackProps {
	audioTrack: AudioTrack;
}

const isValidAudioClip = (clip?: AudioTrack["clips"][number]) =>
	!!clip?.audioClip.sourceUrl;

const mergeUtil = {
	speed(speed: number) {
		return speed * (useTimelineStore.getState().timeline?.speed ?? 1);
	},
	volume(volume: number) {
		return (
			volume * (useTimelineStore.getState().timeline?.audioVolume ?? 1)
		);
	},
};

const findOrCreateSound = (alias: string, url: string) => {
	let instance: Sound;
	if (!sound.exists(alias)) {
		instance = sound.add(alias, {
			url,
			preload: true,
			autoPlay: false,
			singleInstance: true,
		});
	} else {
		instance = sound.find(alias);
	}
	return instance;
};

const SoundTrack: FC<SoundTrackProps> = ({ audioTrack }) => {
	const [soundInstance, setInstance] = useState<Sound | null>(null);
	const timeline = useTimelineStore.use.timeline?.();
	const currentMetaRef = useRef<AudioTrack["clips"][number]>();
	const deps = audioTrack ? audioTrack.clips.map((c) => c.id) : [];

	// when audio track changes
	useDeepCompareEffect(() => {
		if (!audioTrack.clips.length) return;

		// const urls = [
		// 	...new Set(audioTrack.clips.map((c) => c.audioClip.sourceUrl)),
		// ];
		const first2 = audioTrack.clips.slice(0, 2);

		// preload first 2 audio
		for (const clip of first2) {
			const alias = `${AUDIO_ALIAS}_${clip.id}`;
			findOrCreateSound(alias, clip.audioClip.sourceUrl);
		}
	}, [...deps]);

	useMount(() => {
		let audioMeta: ReturnType<typeof seekAudio>;
		let id = 0;
		let currentId = id;
		hooks.beforeEach(({ context, name }) => {
			if (name === "seek") {
				currentId = context.currentId = ++id;
			}
		});
		hooks.hook("seek", async ({ currentTime }) => {
			audioMeta = seekAudio(currentTime, audioTrack);
			if (!isValidAudioClip(audioMeta)) {
				// soundInstance?.pause();
				sound.pauseAll();
				setInstance(null);
				currentMetaRef.current = undefined;
				return;
			}
			if (audioMeta.id === currentMetaRef.current?.id) {
				return;
			}
			// TODO: async preload
			const alias = `${AUDIO_ALIAS}_${audioMeta.id}`;
			const instance = findOrCreateSound(
				alias,
				audioMeta.audioClip.sourceUrl,
			);
			sound.stopAll();
			if (instance.isPlaying) {
				instance.pause();
			}
		});
		hooks.afterEach(({ args, context, name }) => {
			if (name === "seek" && context.currentId === currentId) {
				currentMetaRef.current = audioMeta;

				const { currentTime } = args[0];
				const realStart =
					currentTime * 1_000 - audioMeta.inPoint + audioMeta.start;
				const alias = `${AUDIO_ALIAS}_${audioMeta.id}`;
				const instance = findOrCreateSound(
					alias,
					audioMeta.audioClip.sourceUrl,
				);

				setInstance(instance);
				instance.play({
					start: parseFloat((realStart / 1_000_000).toFixed(2)),
					loop: true,
					speed: mergeUtil.speed(
						audioMeta.audioClip.constantSpeed ?? 1,
					),
					volume: mergeUtil.volume(audioMeta.audioClip.volume ?? 1),
					singleInstance: true,
				});
			}
		});
	});

	// useEffect(() => {
	// 	return $on(
	// 		"seek",
	// 		(event: EVENT_SEEK) => {
	// 			const audioMeta = seekAudio(event.elapsedTime, audioTrack);

	// 			if (!isValidAudioClip(audioMeta)) {
	// 				// soundInstance?.pause();
	// 				sound.pauseAll();
	// 				setInstance(null);
	// 				currentMetaRef.current = undefined;
	// 				return;
	// 			}

	// 			if (audioMeta.id !== currentMetaRef.current?.id) {
	// 				return;
	// 			}

	// 			const alias = `${AUDIO_ALIAS}_${audioMeta.id}`;
	// 			const instance = findOrCreateSound(
	// 				alias,
	// 				audioMeta.audioClip.sourceUrl,
	// 			);

	// 			const realStart =
	// 				event.elapsedTime * 1_000 -
	// 				audioMeta.inPoint +
	// 				audioMeta.start;

	// 			if (instance.isPlaying) {
	// 				instance.pause();
	// 			}
	// 			instance.play({
	// 				start: parseFloat((realStart / 1_000_000).toFixed(2)),
	// 				loop: true,
	// 				speed: mergeUtil.speed(
	// 					audioMeta.audioClip.constantSpeed ?? 1,
	// 				),
	// 				volume: mergeUtil.volume(audioMeta.audioClip.volume ?? 1),
	// 				singleInstance: true,
	// 			});
	// 		},
	// 		timeline,
	// 	);
	// }, [soundInstance, timeline, audioTrack]);

	const setVolume = useMemoizedFn((v: number) => {
		if (!soundInstance) return;
		soundInstance.volume = mergeUtil.volume(v);
	});

	useEffect(() => {
		return $on(
			"update",
			(event: EVENT_SEEK) => {
				const audioMeta = seekAudio(event.elapsedTime, audioTrack);
				if (!isValidAudioClip(audioMeta)) {
					// soundInstance?.pause();
					sound.pauseAll();
					setInstance(null);
					currentMetaRef.current = undefined;
					return;
				}
				if (audioMeta.id === currentMetaRef.current?.id) {
					// transition
					let transitionCode: AudioTransitionCode | undefined;
					let transitionDuration = 0;
					if (audioMeta.audioClip.volumeFadeIn) {
						const duration = audioMeta.audioClip.volumeFadeIn;

						const isInPhase =
							event.elapsedTime * 1000 <
							audioMeta.inPoint + duration;

						if (isInPhase) {
							transitionDuration = duration / 1000;
							transitionCode = "fade_in";
						}
					}
					if (audioMeta.audioClip.volumeFadeOut) {
						const duration = audioMeta.audioClip.volumeFadeOut;

						const outPoint = audioMeta.inPoint + audioMeta.duration;
						const isOutPhase =
							event.elapsedTime * 1000 > outPoint - duration;

						if (isOutPhase) {
							transitionDuration = duration / 1000;
							transitionCode = "fade_out";
						}
					}
					if (!transitionCode || !transitionDuration) return;
					const nextVolume = applyAudioTransition({
						elapsedTime: event.elapsedTime,
						clip: audioMeta,
						transitionCode,
						duration: transitionDuration,
					});

					setVolume(nextVolume);
					return;
				}
				currentMetaRef.current = audioMeta;

				const alias = `${AUDIO_ALIAS}_${audioMeta.id}`;
				const instance = findOrCreateSound(
					alias,
					audioMeta.audioClip.sourceUrl,
				);

				// soundInstance?.pause();
				sound.stopAll();
				setInstance(instance);

				const realStart =
					event.elapsedTime * 1_000 -
					audioMeta.inPoint +
					audioMeta.start;
				if (instance.isPlaying) {
					instance.pause();
				}
				instance.play({
					start: parseFloat((realStart / 1_000_000).toFixed(2)),
					loop: true,
					speed: mergeUtil.speed(
						audioMeta.audioClip.constantSpeed ?? 1,
					),
					volume: mergeUtil.volume(audioMeta.audioClip.volume ?? 1),
					singleInstance: true,
				});

				// load next
				const nextTwoAudioMeta = audioTrack.clips.findIndex(
					(c) => c.id === audioMeta.id,
				);
				const nextTwoAudio = audioTrack.clips.slice(
					nextTwoAudioMeta + 1,
					nextTwoAudioMeta + 3,
				);

				for (const clip of nextTwoAudio) {
					const alias = `${AUDIO_ALIAS}_${clip.id}`;
					findOrCreateSound(alias, clip.audioClip.sourceUrl);
				}
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [soundInstance, timeline, audioTrack]);

	useEffect(() => {
		return $on(
			"speed",
			() => {
				if (!soundInstance) return;
				soundInstance.speed = mergeUtil.speed(
					currentMetaRef.current?.audioClip.constantSpeed ?? 1,
				);
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline, soundInstance, audioTrack]);

	useEffect(() => {
		return $on(
			"pause",
			() => {
				soundInstance?.stop();
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [soundInstance, timeline]);

	useEffect(() => {
		return $ons(
			[
				{
					event: "start",
					handler: () => {
						const audioMeta = seekAudio(0, audioTrack);
						if (isValidAudioClip(audioMeta)) {
							// switch audio
							currentMetaRef.current = audioMeta;
							const alias = `${AUDIO_ALIAS}_${audioMeta.id}`;
							const instance = findOrCreateSound(
								alias,
								audioMeta.audioClip.sourceUrl,
							);

							sound.stopAll();
							setInstance(instance);

							if (instance.isPlaying) {
								instance.pause();
							}
							instance.play({
								singleInstance: true,
								start: parseFloat(
									(audioMeta.start / 1_000_000).toFixed(2),
								),
								loop: true,
								speed: mergeUtil.speed(
									audioMeta?.audioClip.constantSpeed ?? 1,
								),
								volume: mergeUtil.volume(
									audioMeta.audioClip.volume ?? 1,
								),
							});
							// }
							// else {
							// 	// TODO:
							// 	PIXI.Assets.load(alias).then((s: Sound) => {
							// 		console.log(
							// 			"start playing - 2",
							// 			audioMeta,
							// 		);
							// 		instance.play({
							// 			start: parseFloat(
							// 				(
							// 					audioMeta.start / 1_000_000
							// 				).toFixed(2),
							// 			),
							// 			singleInstance: true,
							// 			loop: true,
							// 			speed: mergeUtil.speed(
							// 				audioMeta?.audioClip
							// 					.constantSpeed || 1,
							// 			),
							// 			volume: mergeUtil.volume(
							// 				audioMeta.audioClip.volume || 1,
							// 			),
							// 		});
							// 	});
							// }
						} else {
							currentMetaRef.current = undefined;
							sound.stopAll();
							setInstance(null);
						}
					},
				},
				{
					event: "resume",
					handler: () => {
						soundInstance?.resume();
					},
				},
				{
					event: "complete",
					handler: () => {
						currentMetaRef.current = undefined;
						// soundInstance?.pause();
						sound.stopAll();
						setInstance(null);
					},
				},
				{
					event: "audio-volume",
					handler: () => {
						if (!soundInstance) return;
						const v = mergeUtil.volume(
							currentMetaRef.current?.audioClip.volume ?? 1,
						);
						soundInstance.volume = v;
					},
				},
			],
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [soundInstance, timeline, audioTrack]);

	return null;
};

export default memo(SoundTrack);
