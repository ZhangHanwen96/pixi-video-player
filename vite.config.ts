import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import AutoImport from "unplugin-auto-import/vite";
import IconsResolver from "unplugin-icons/resolver";
import Icons from "unplugin-icons/vite";

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
	],
	// set alias for src => @
	resolve: {
		alias: {
			"@": "/src",
		},
	},
});
