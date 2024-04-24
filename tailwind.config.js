const bundle = process.env.BUNDLE === "true";

/** @type {import('tailwindcss').Config} */
const devConfig = {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {},
	},
	plugins: [require("@tailwindcss/container-queries")],
	corePlugins: {
		container: false,
		preflight: false,
	},
};

/** @type {import('tailwindcss').Config} */
const bundleConfig = {
	content: ["./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {},
	},
	plugins: [require("@tailwindcss/container-queries")],
	corePlugins: {
		container: false,
		preflight: false,
	},
};

export default bundle ? bundleConfig : devConfig;
