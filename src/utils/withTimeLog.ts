type ExtractFunctionReturn<T extends (...args: any[]) => any> = T extends (
	...args: any[]
) => Promise<infer R>
	? R
	: ReturnType<T>;

export async function withTimeLog<Fn extends (...args: any[]) => any>(
	fn: Fn,
	label: string,
) {
	console.log("%cTimeLog -----------", "color: blue; font-size: 16px;");
	console.time(label);
	const result = await Promise.resolve(fn());
	console.timeEnd(label);
	return result as ExtractFunctionReturn<Fn>;
}
