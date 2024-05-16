import { Font } from "@/interface/vmml";
import stringify from "fast-json-stable-stringify";
import { useEffect, useState } from "react";

const serializeObjectToKey = (obj: Record<string, any>) => {
	return stringify(obj);
};

class FontLoader {
	static cache = new Map<string, FontFace>();
	static delele(font: Font, descriptors?: FontFaceDescriptors) {
		const url = font.fontSourceUrl;
		const key = serializeObjectToKey({ url, descriptors });
		const fontFace = FontLoader.cache.get(key);
		if (fontFace) {
			FontLoader.cache.delete(key);
			document.fonts.delete(fontFace);
			return true;
		}
		return false;
	}
	async load(font: Font, descriptors?: FontFaceDescriptors) {
		const url = font.fontSourceUrl;
		const key = serializeObjectToKey({ url, descriptors });

		if (FontLoader.cache.has(key)) {
			return FontLoader.cache.get(key);
		}
		// load font
		const fontFace = new FontFace(
			font.fontFamily,
			`url(${url})`,
			descriptors,
		);
		FontLoader.cache.set(key, fontFace);
		const promise = fontFace.load();
		document.fonts.add(fontFace);
		return promise.then(() => {
			console.log("font loaded", font.fontFamily);
			return fontFace;
		});
	}
	static isFontLoaded(font: Font, descriptors?: FontFaceDescriptors) {
		const url = font.fontSourceUrl;
		const key = serializeObjectToKey({ url, descriptors });
		const fontFace = FontLoader.cache.get(key);
		if (!fontFace) return false;
		return fontFace.status === "loaded";
	}
}

type LoadFontProps = {
	fonts: Font[];
	enabled?: boolean;
};

const useLoadFont = ({ fonts, enabled = true }: LoadFontProps) => {
	const fontLoader = useState(() => new FontLoader())[0];
	useEffect(() => {
		if (!fonts?.length || !enabled) return;
		console.log(
			"will load fonts",
			fonts.map(({ fontFamily }) => fontFamily).sort(),
		);
		fonts.forEach((font) => fontLoader.load(font));
	}, [fonts, enabled]);
};

export default useLoadFont;
