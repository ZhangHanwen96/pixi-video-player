export const argb2Rgba = (argb: string) => {
	const a = argb.slice(1, 3);

	return `#${argb.slice(3)}${a}`;
};
