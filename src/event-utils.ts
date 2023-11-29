import EventEmitter from "eventemitter3";

type Handler = (...args: any[]) => unknown | void;

export const $on = (
    event: string,
    handler: Handler,
    emitter?: EventEmitter
) => {
    emitter?.on(event, handler);
    return () => {
        emitter?.off(event, handler);
    };
};

export const $ons = (
    options: { event: string; handler: Handler }[],
    emitter?: EventEmitter
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
