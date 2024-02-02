import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import AutoImport from "unplugin-auto-import/vite";
import IconsResolver from "unplugin-icons/resolver";
import Icons from "unplugin-icons/vite";
import dts from "vite-plugin-dts";
import peerdep from "rollup-plugin-peer-deps-external";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		AutoImport({
			include: [
				/\.[tj]sx?$/, // .ts, .tsx, .js, .jsx
				// /\.vue$/,
				// /\.vue\?vue/, // .vue
				/\.md$/, // .md
			],
			imports: ["ahooks", "react-router-dom", "react", "react-i18next"],
			resolvers: [
				IconsResolver({
					prefix: "Icon",
					extension: "jsx",
				}),
			],
		}),
		Icons({
			compiler: "jsx",
			jsx: "react",
			iconCustomizer(collection, icon, props) {
				props.width = "1em";
				props.height = "1em";
			},
		}),
		dts({
			declarationOnly: true,
			rollupTypes: true,
		}),
		peerdep(),
	],
	// set alias for src => @
	resolve: {
		alias: {
			"@": "/src",
		},
	},
	build: {
		lib: {
			entry: "./src/components/TezignPlayer/index.tsx",
			fileName(format, entryName) {
				if (format === "es") {
					return `${entryName}.mjs`;
				}
				if (format === "cjs") {
					return `${entryName}.cjs`;
				}
				return `${entryName}.js`;
			},
			formats: ["es"],
		},
	},
});
