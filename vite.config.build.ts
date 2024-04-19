import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import AutoImport from "unplugin-auto-import/vite";
import IconsResolver from "unplugin-icons/resolver";
import Icons from "unplugin-icons/vite";
import dts from "vite-plugin-dts";
import peerdep from "rollup-plugin-peer-deps-external";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
			rollupTypes: true,
			tsconfigPath: resolve(__dirname, "./tsconfig.json"),
		}),
		// peerdep(),
	],
	// set alias for src => @
	resolve: {
		alias: {
			"@": "/src",
		},
	},
	build: {
		emptyOutDir: true,
		cssCodeSplit: true,
		lib: {
			entry: resolve(__dirname, "./src/lib-entry.ts"),
			fileName(format, entryName) {
				if (format === "es") {
					return `${entryName}.mjs`;
				}
				if (format === "cjs") {
					return `${entryName}.cjs`;
				}
				return `${entryName}.js`;
			},
			formats: ["es", "cjs"],
		},
		rollupOptions: {
			// plugins: [peerdep()],
			external: [
				"react",
				"react-dom",
				"react/jsx-runtime",
				"pixi.js",
				"ahooks",
				"react-router-dom",
				"react-i18next",
			],
		},
	},
});
