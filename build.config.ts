import { defineBuildConfig } from "unbuild";
import path from "path";
import { fileURLToPath } from "url";

// const __dirname = path.dirname(fileURLToPath(import.meta.filename));

export default defineBuildConfig({
	// If entries is not provided, will be automatically inferred from package.json
	entries: ["./src/lib-entry"],

	// Change outDir, default is 'dist'
	outDir: "dist",
	// Generates .d.ts declaration file
	declaration: true,
	// alias: {
	// 	"@": path.resolve(__dirname, "./src"),
	// },
	failOnWarn: false,

	rollup: {
		emitCJS: true,
		alias: {
			entries: [
				{
					find: "@",
					replacement: path.resolve(__dirname, "./src"),
				},
			],
		},
	},
});
