import { useEffect, useRef, useState } from "react";

type Params = {
	loading: boolean;
	delay?: number;
};

export const useDelayLoading = ({ loading, delay = 300 }: Params) => {
	const [spin, setSpin] = useState(loading);
	const timerRef = useRef<any>();

	useEffect(() => {
		if (loading) {
			timerRef.current = setTimeout(() => {
				setSpin(true);
			}, delay);
		} else {
			setSpin(false);
		}

		return () => {
			clearTimeout(timerRef.current);
		};
	}, [delay, loading]);

	return spin;
};
