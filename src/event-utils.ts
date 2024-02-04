import EventEmitter from "eventemitter3";

export const $on = <T extends object, K extends EventEmitter.EventNames<T>>(
	event: K,
	handler: EventEmitter.EventListener<T, K>,
	emitter?: EventEmitter<T>,
) => {
	emitter?.on(event, handler);
	return () => {
		emitter?.off(event, handler);
	};
};

export const $ons = <T extends object, K extends EventEmitter.EventNames<T>>(
	options: { event: K; handler: EventEmitter.EventListener<T, K> }[],
	emitter?: EventEmitter<T>,
) => {
	options.forEach(({ event, handler }) => {
		emitter?.on(event, handler);
	});
	return () => {
		options.forEach(({ event, handler }) => {
			emitter?.off(event, handler);
		});
	};
};
