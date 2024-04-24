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

// TODO: loop short audio

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
			const sprite = clips.reduce((_spriteObject, clip) => {
				if (!clip.audioClip.sourceUrl) return _spriteObject;
				const range = [
					clip.start / 1_000,
					// (clip.start + clip.duration) / 1_000,
					clip.duration / 1_000,
				] as [number, number];
				_spriteObject[clip.id] = [...range, true]; // [offset, duration, (loop)]
				return _spriteObject;
			}, {} as SoundSpriteDefinitions);

			console.log(
				"%cCreating Sprite",
				sprite,
				"color: green; font-weight: 600; font-size: 14px;",
			);

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

	/** unmount clean up */
	useUnmount(() => {
		for (const [_, sprite] of spriteMap) {
			sprite.pause(); // pause all sounds in the sprite
			sprite.unload();
		}
	});

	return {
		clipIdToSoundIDMap,
		loadedPromiseMap,
		spriteMap,
		pauseAll: useCallback(() => {
			for (const [, sprite] of spriteMap) {
				sprite.pause(); // pause all sounds in the sprite
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

		const urlToClipsMap = new Map<string, AudioTrack["clips"][number][]>();

		for (const clip of audioTrack.clips) {
			const sourceUrl = clip.audioClip.sourceUrl;
			if (!sourceUrl) continue;
			if (!urlToClipsMap.has(sourceUrl)) {
				urlToClipsMap.set(sourceUrl, []);
			}
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			urlToClipsMap.get(sourceUrl)!.push(clip);
		}

		for (const [url, clips] of urlToClipsMap) {
			createSoundSprite(url, clips);
		}

		return () => {
			for (const [url, sprite] of spriteMap) {
				if (
					!audioTrack.clips.find(
						(clip) => clip.audioClip.sourceUrl === url,
					)
				) {
					sprite.unload();
				}
			}
		};
	}, [...deps]);

	/** no need for hooks for now */
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
		);
		if (!sprite) return;
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

				const realStart = calcStart(
					event.elapsedTime * 1_000,
					audioMeta.inPoint,
					audioMeta.start,
				);

				let soundId = clipIdToSoundIDMap.get(audioMeta.id);
				const sprite = spriteMap.get(audioMeta.audioClip.sourceUrl);
				if (!sprite) {
					throw new Error("Sprite should exist but 'Not Found'");
				}
				const startRef = { soundId } as { soundId: number };
				sprite.once("play", (id) => {
					sprite.seek(realStart, id);
				});
				if (!isNumber(soundId)) {
					startRef.soundId = soundId = sprite.play(audioMeta.id);
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
				);
				if (!sprite) {
					throw new Error("Sprite should exist but 'Not Found'");
				}
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
	}, [timeline, pauseAll]);

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
						);
						if (!sprite) {
							throw new Error(
								"Sprite should exist but 'Not Found'",
							);
						}
						sprite.play(soundId);
					},
				},
				{
					event: "complete",
					handler: () => {
						console.info("sound track complete");
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
						);
						if (!sprite) {
							throw new Error(
								"Sprite should exist but 'Not Found'",
							);
						}
						sprite.volume(v, soundId);
					},
				},
			],
			timeline as EventEmitter<TimelineEventTypes>,
		);
	}, [timeline]);

	return null;
};

function calcStart(elapsed: number, inpoint: number, start: number) {
	const realStart = elapsed - inpoint + start / 1000_000;
	return parseFloat(realStart.toFixed(3));
}

export default memo(SoundTrack);
