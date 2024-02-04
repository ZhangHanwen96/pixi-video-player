import { createHooks } from "hookable";

export const hooks = createHooks<{
	seek: (options: {
		currentTime: number;
	}) => void;
}>();
