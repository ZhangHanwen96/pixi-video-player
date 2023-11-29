/* eslint-disable @typescript-eslint/ban-ts-comment */
export function withPromise<T = unknown>() {
    let $resolve: (value: T) => void;
    let $reject: (value: unknown) => void;
    const promise = new Promise((resolve, reject) => {
        $resolve = resolve;
        $reject = reject;
    });
    return {
        promise,
        // @ts-ignore
        resolve: $resolve,
        // @ts-ignore
        reject: $reject,
    };
}
