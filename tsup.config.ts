import { defineConfig, build } from "tsup";
import Icons from "unplugin-icons/esbuild";
import packageJson from './package.json'

const dependencies = Object.keys(packageJson.dependencies || {});
const peerDependencies = Object.keys(packageJson.peerDependencies || {});

export default defineConfig({
	entry: {
		index: "./src/lib-entry.ts",
	},
	format: ["cjs", "esm"],
	outDir: "dist",
	dts: true,
	external: [...dependencies, ...peerDependencies, 'react/jsx-runtime'],
	injectStyle: false,
	esbuildPlugins: [
		Icons({
			compiler: "jsx",
			jsx: "react",
			iconCustomizer(collection, icon, props) {
				props.width = "1em";
				props.height = "1em";
			},
		}),
	],
	esbuildOptions(options, context) {
		options.banner = {
			"js": "/* Create by @tezign Zhang Hanwen */",
		}
	},
	clean: true,
});
