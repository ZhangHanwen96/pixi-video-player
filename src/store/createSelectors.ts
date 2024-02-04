import { StoreApi, UseBoundStore } from "zustand";
import { shallow as shallowEqual } from "zustand/shallow";

type WithSelectors<S> = S extends { getState: () => infer T }
	? S & { use: { [K in keyof T]: (shallow?: boolean) => T[K] } }
	: never;

export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
	_store: S,
) => {
	const store = _store as WithSelectors<typeof _store>;
	store.use = {};
	for (const k of Object.keys(store.getState())) {
		(store.use as any)[k] = (shallow: boolean) =>
			store(
				(s) => s[k as keyof typeof s],
				// @ts-ignore
				shallow ? shallowEqual : undefined,
			);
	}

	return store;
};
