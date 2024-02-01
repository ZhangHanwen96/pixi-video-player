/* eslint-disable react-refresh/only-export-components */
import { Sound, sound } from "@pixi/sound";
import { $on, $ons } from "@/event-utils";
import { useTimelineStore } from "@/store";
import { AudioTrack } from "@/interface/vmml";
import { FC, memo, useEffect, useRef, useState } from "react";
import { EVENT_SEEK } from "@/Timeline";
import { seekAudio } from "./utils";
import { applyAudioTransition } from "@/animation/audio";
import { AudioTransitionCode } from "@/interface/animation";
import { useMemoizedFn } from "ahooks";

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
	const currentIdRef = useRef<AudioTrack["clips"][number]>();
	const deps = audioTrack ? audioTrack.clips.map((c) => c.id) : [];

	// when audio track changes
	useEffect(() => {
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

	useEffect(() => {
		return $on(
			"seek",
			(event: EVENT_SEEK) => {
				const audioMeta = seekAudio(event.elapsedTime, audioTrack);

				if (!isValidAudioClip(audioMeta)) {
					// soundInstance?.pause();
					sound.pauseAll();
					setInstance(null);
					currentIdRef.current = undefined;
					return;
				}

				if (audioMeta.id !== currentIdRef.current?.id) {
					return;
				}

				const alias = `${AUDIO_ALIAS}_${audioMeta.id}`;
				const instance = findOrCreateSound(
					alias,
					audioMeta.audioClip.sourceUrl,
				);

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
			},
			timeline,
		);
	}, [soundInstance, timeline, audioTrack]);

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
					currentIdRef.current = undefined;
					return;
				}
				if (audioMeta.id === currentIdRef.current?.id) {
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
				currentIdRef.current = audioMeta;

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
			timeline,
		);
	}, [soundInstance, timeline, audioTrack]);

	useEffect(() => {
		return $on(
			"speed",
			() => {
				if (!soundInstance) return;
				soundInstance.speed = mergeUtil.speed(
					currentIdRef.current?.audioClip.constantSpeed ?? 1,
				);
			},
			timeline,
		);
	}, [timeline, soundInstance, audioTrack]);

	useEffect(() => {
		return $on(
			"pause",
			() => {
				soundInstance?.stop();
			},
			timeline,
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
							currentIdRef.current = audioMeta;
							const alias = `${AUDIO_ALIAS}_${audioMeta.id}`;
							const instance = findOrCreateSound(
								alias,
								audioMeta.audioClip.sourceUrl,
							);

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
							currentIdRef.current = undefined;
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
						currentIdRef.current = undefined;
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
							currentIdRef.current?.audioClip.volume ?? 1,
						);
						soundInstance.volume = v;
					},
				},
			],
			timeline,
		);
	}, [soundInstance, timeline, audioTrack]);

	return null;
};

export default memo(SoundTrack);
