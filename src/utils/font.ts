import Fontfaceobserver from "fontfaceobserver";

export const createFontOB = async (font: string) => {
    const fontFace = new Fontfaceobserver(font);
    await fontFace.load();
    return fontFace;
};
