/**
 * 字体
 */
interface Font {
	fontName: string;
	fontCssCode: string;
	fontSourceUrl: string;
}

/**
 * 默认使用字体
 */
export const DEFAULT_FONT = {
	fontName: "欣意冠黑体2.0",
	fontCssCode: "CustomFontXinyi",
	fontSourceUrl: "https://static-common.tezign.com/fonts/xinyi.ttf",
};

/**
 * 根据fontSourceUrl找到对应的fontCssCode
 * @param sourceUrl
 */
export function getFontCssCodeBySourceUrl(sourceUrl: string) {
	return FONT_OPTIONS.find((f) => f.fontSourceUrl === sourceUrl)?.fontCssCode;
}

/**
 * 所有可选字体
 */
const FONT_OPTIONS: Array<Font> = [
	DEFAULT_FONT,
	{
		fontName: "优设标题黑",
		fontSourceUrl:
			"https://static-common.tezign.com/fonts/CustomFontYouSeBiaoTiHei.ttf",
		fontCssCode: "CustomFontYouSeBiaoTiHei",
	},
	{
		fontName: "抖音体",
		fontSourceUrl:
			"https://static-common.tezign.com/fonts/CustomFontDouyinSansBold.otf",
		fontCssCode: "CustomFontDouyinSansBold",
	},
	{
		fontName: "阿里健康体2.0",
		fontSourceUrl:
			"https://static-common.tezign.com/fonts/CustomFontAlibabaHealthFont.ttf",
		fontCssCode: "CustomFontAlibabaHealthFont",
	},
	{
		fontName: "传奇南安体",
		fontSourceUrl:
			"https://static-common.tezign.com/fonts/CustomFontChuanQiAnNan.ttf",
		fontCssCode: "CustomFontChuanQiAnNan",
	},
	{
		fontName: "优设好身体",
		fontSourceUrl:
			"https://static-common.tezign.com/fonts/CustomFontYouSheHaoShenTi.ttf",
		fontCssCode: "CustomFontYouSheHaoShenTi",
	},
];

export default FONT_OPTIONS;
