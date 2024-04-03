/* eslint-disable react-refresh/only-export-components */
import { $on, $ons } from "@/event-utils";
import { useTimelineStore } from "@/store";
import { AudioTrack } from "@/interface/vmml";
import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { EVENT_SEEK, TimelineEventTypes } from "@/Timeline";
import { seekAudio } from "./utils";
import { applyAudioTransition } from "@/animation/audio";
import { AudioTransitionCode } from "@/interface/animation";
import { Howl, Howler, SoundSpriteDefinitions } from "howler";
import {
	useCreation,
	useDeepCompareEffect,
	useMemoizedFn,
	useMount,
	useUnmount,
} from "ahooks";
import { hooks } from "../Controller/hooks";
import { withPromise } from "@/utils/withPromise";
import { isNumber } from "lodash-es";
import EventEmitter from "eventemitter3";

// TODO: sound instance per component

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

const useInitSpriteState = () => {
	const { clipIdToSoundIDMap, loadedPromiseMap, spriteMap } = useCreation(
		() => ({
			spriteMap: new Map<string, Howl>(),
			loadedPromiseMap: new Map<string, Promise<Howl>>(),
			clipIdToSoundIDMap: new Map<string, number>(),
		}),
		[],
	);

	const createSoundSprite = useMemoizedFn(
		(src: string, clips: AudioTrack["clips"]) => {
			if (spriteMap.has(src)) {
				return {
					sound: spriteMap.get(src) as Howl,
					loaded: loadedPromiseMap.get(src),
				};
			}
			const sprite = clips.reduce((acc, clip) => {
				if (!clip.audioClip.sourceUrl) return acc;
				const range = [
					clip.start / 1_000,
					(clip.start + clip.duration) / 1_000,
				] as [number, number];
				acc[clip.id] = [...range, true];
				return acc;
			}, {} as SoundSpriteDefinitions);

			console.log(
				"%cCreating Sprite",
				"color: green; font-weight: 600; font-size: 14px;",
			);
			console.log("sprite: ", sprite);

			const { promise, reject, resolve } = withPromise<Howl>();
			loadedPromiseMap.set(src, promise);

			const sound = new Howl({
				src: [src],
				autoplay: false,
				html5: true,
				sprite,
				onload: () => {
					resolve(sound);
				},
				onloaderror: (id, error) => {
					reject({
						error,
						id,
					});
				},
			});

			spriteMap.set(src, sound);
			return {
				sound,
				loaded: promise,
			};
		},
	);

	// useUnmount(() => {
	// 	for (const [_, sprite] of spriteMap) {
	// 		sprite.unload();
	// 	}
	// 	spriteMap.clear();
	// });

	return {
		clipIdToSoundIDMap,
		loadedPromiseMap,
		spriteMap,
		pauseAll: useCallback(() => {
			for (const [, sound] of spriteMap) {
				sound.pause();
			}
		}, [spriteMap]),
		createSoundSprite,
	};
};

const SoundTrack: FC<SoundTrackProps> = ({ audioTrack }) => {
	const timeline = useTimelineStore.use.timeline?.();
	const currentMetaRef = useRef<AudioTrack["clips"][number]>();
	const deps = audioTrack ? audioTrack.clips.map((c) => c.id) : [];

	const {
		clipIdToSoundIDMap,
		createSoundSprite,
		loadedPromiseMap,
		pauseAll,
		spriteMap,
	} = useInitSpriteState();

	useDeepCompareEffect(() => {
		if (!audioTrack.clips.length) return;

		const urlToClips = new Map<string, AudioTrack["clips"][number][]>();
		for (const clip of audioTrack.clips) {
			if (!clip.audioClip.sourceUrl) continue;
			if (!urlToClips.has(clip.audioClip.sourceUrl)) {
				urlToClips.set(clip.audioClip.sourceUrl, []);
			}
			urlToClips.get(clip.audioClip.sourceUrl)?.push(clip);
		}

		for (const [url, clips] of urlToClips) {
			createSoundSprite(url, clips);
		}

		console.log("------- spriteMap");
		console.log(Array.from(spriteMap.entries()));

		return () => {
			for (const [_, sprite] of spriteMap) {
				sprite.unload();
			}
			spriteMap.clear();
		};
	}, [...deps]);

	useMount(() => {
		let audioMeta: ReturnType<typeof seekAudio>;
		let id = 0;
		let currentId = id;
		const remove = hooks.beforeEach(({ context, name }) => {
			if (name === "seek") {
				currentId = context.currentAudioId = ++id;
			}
		});
		const remove2 = hooks.hook("seek", async ({ currentTime }) => {
			audioMeta = seekAudio(currentTime, audioTrack);
			pauseAll();
			if (!audioMeta || !isValidAudioClip(audioMeta)) {
				return;
			}
			if (audioMeta.id === currentMetaRef.current?.id) {
				return;
			}
			await loadedPromiseMap.get(audioMeta.audioClip.sourceUrl);
		});
		const remove3 = hooks.afterEach(({ args, context, name }) => {
			if (
				name === "seek" &&
				context.currentAudioId === currentId &&
				audioMeta
			) {
				currentMetaRef.current = audioMeta;

				const { currentTime } = args[0];
				let realStart =
					(currentTime * 1_000 -
						audioMeta.inPoint +
						audioMeta.start) /
					1000_000;
				realStart = parseFloat(realStart.toFixed(2));

				if (!audioMeta.audioClip.sourceUrl) return;

				let soundId = clipIdToSoundIDMap.get(audioMeta.id);
				const _state = { soundId } as { soundId: number };
				console.info(
					"audioMeta.audioClip.sourceUrl",
					audioMeta.audioClip.sourceUrl,
				);
				console.info(Array.from(spriteMap.entries()));
				const sprite = spriteMap.get(audioMeta.audioClip.sourceUrl)!;

				if (!sprite) {
					console.error("Sprite Not Found");
					console.error(audioMeta.audioClip.sourceUrl);
					return;
				}

				sprite.once("play", (id) => {
					sprite.seek(realStart, id);
				});
				if (!isNumber(soundId)) {
					_state.soundId = soundId = sprite.play(audioMeta.id);
					clipIdToSoundIDMap.set(audioMeta.id, soundId);
				} else {
					sprite.play(soundId);
				}
				sprite.volume(
					mergeUtil.volume(audioMeta.audioClip.volume ?? 1),
					soundId,
				);
			}
		});

		return () => {
			hooks.removeAllHooks();
		};
	});

	const setVolume = useMemoizedFn((v: number) => {
		if (!currentMetaRef.current?.id) return;
		const soundId = clipIdToSoundIDMap.get(currentMetaRef.current.id);
		if (!isNumber(soundId)) return;
		const sprite = spriteMap.get(
			currentMetaRef.current.audioClip.sourceUrl,
		)!;
		sprite.volume(v, soundId);
	});

	useEffect(() => {
		return $on(
			"update",
			(event: EVENT_SEEK) => {
				const audioMeta = seekAudio(event.elapsedTime, audioTrack);
				const isSameMeta = audioMeta?.id === currentMetaRef.current?.id;
				if (!audioMeta || !isValidAudioClip(audioMeta)) {
					// avoid repeating
					if (isSameMeta) return;
					pauseAll();
					currentMetaRef.current = audioMeta;
					return;
				}
				if (isSameMeta) {
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

				pauseAll();
				currentMetaRef.current = audioMeta;

				let realStart =
					(event.elapsedTime * 1_000 -
						audioMeta.inPoint +
						audioMeta.start) /
					1_000_000;
				realStart = parseFloat(realStart.toFixed(2));

				let soundId = clipIdToSoundIDMap.get(audioMeta.id);
				const sprite = spriteMap.get(audioMeta.audioClip.sourceUrl)!;
				const _state = { soundId } as { soundId: number };
				sprite.once("play", (id) => {
					sprite.seek(realStart, id);
				});
				if (!isNumber(soundId)) {
					_state.soundId = soundId = sprite.play(audioMeta.id);
					clipIdToSoundIDMap.set(audioMeta.id, soundId);
				} else {
					sprite.play(soundId);
				}
				sprite.volume(
					mergeUtil.volume(audioMeta.audioClip.volume ?? 1),
					soundId,
				);
				// sprite.seek(realStart / 1_000_000, soundId);
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline, audioTrack]);

	useEffect(() => {
		return $on(
			"speed",
			() => {
				if (!currentMetaRef.current?.id) return;
				if (!currentMetaRef.current?.audioClip.sourceUrl) return;
				const v = mergeUtil.speed(
					currentMetaRef.current?.audioClip.constantSpeed ?? 1,
				);
				const soundId = clipIdToSoundIDMap.get(
					currentMetaRef.current.id,
				);
				if (!isNumber(soundId)) return;
				const sprite = spriteMap.get(
					currentMetaRef.current.audioClip.sourceUrl,
				)!;
				sprite.rate(v, soundId);
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline]);

	useEffect(() => {
		return $on(
			"pause",
			() => {
				pauseAll();
			},
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline]);

	useEffect(() => {
		return $ons(
			[
				{
					event: "resume",
					handler: () => {
						if (!currentMetaRef.current?.id) return;
						if (!currentMetaRef.current?.audioClip.sourceUrl)
							return;
						const soundId = clipIdToSoundIDMap.get(
							currentMetaRef.current.id,
						);
						if (!isNumber(soundId)) return;
						const sprite = spriteMap.get(
							currentMetaRef.current.audioClip.sourceUrl,
						)!;
						sprite.play(soundId);
					},
				},
				{
					event: "complete",
					handler: () => {
						currentMetaRef.current = undefined;
						pauseAll();
					},
				},
				{
					event: "audio-volume",
					handler: () => {
						if (!currentMetaRef.current?.id) return;
						if (!currentMetaRef.current?.audioClip.sourceUrl)
							return;
						const v = mergeUtil.volume(
							currentMetaRef.current?.audioClip.volume ?? 1,
						);
						const soundId = clipIdToSoundIDMap.get(
							currentMetaRef.current.id,
						);
						if (!isNumber(soundId)) return;
						const sprite = spriteMap.get(
							currentMetaRef.current.audioClip.sourceUrl,
						)!;
						sprite.volume(v, soundId);
					},
				},
			],
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline]);

	return null;
};

export default memo(SoundTrack);
