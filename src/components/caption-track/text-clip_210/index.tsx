import { StageRect } from "@/interface/app";
import { CaptionTrack, TextClip210 } from "@/interface/vmml";
import React, { FC, useMemo } from "react";

interface TextClip210Props {
	clip: Omit<CaptionTrack["clips"][number], "textClip"> & {
		textClip: TextClip210;
	};
	stageRect: StageRect;
}

const webkitMask =
	"mask-image: linear-gradient(black, transparent); -webkit-mask-image: linear-gradient(black, transparent);";
const gradiant =
	"background: linear-gradient(black, transparent); -webkit-background-clip: text; -webkit-text-fill-color: transparent;";
const stroke =
	"-webkit-text-stroke-color: white; -webkit-text-stroke-width: 1px;";

const htmlContentTex = `你好呀 <span style="color: #000000; font-size: 39px; font-weight: 700; ${webkitMask}">世界</span>,我是 <span style="color: blue; font-size: 32px;">小明</span>`;

/**
 *
 * @description TextClip component for 210 type
 * 210 is custom defined type for text clip to render html content directly
 *
 */
const TextClip = (props: TextClip210Props) => {
	const {
		clip: { textClip },
		stageRect,
	} = props;
	const { htmlContent = "" } = textClip;

	const unsafeModifiedHtml = useMemo(() => {
		if (!htmlContent) return "";
		try {
			const hiddenDiv = document.createElement("div");
			hiddenDiv.style.display = "none";
			hiddenDiv.innerHTML = htmlContent;

			const container = hiddenDiv.children[0]
				.children[0] as HTMLDivElement;
			container.style.position = "unset";
			container.style.transform = "none";
			// container.style.lineHeight = "14px";
			const outerHTML = container.outerHTML;
			container.remove();
			return outerHTML;
		} catch (error) {
			console.error("TextClip210: error in parsing html content", error);
			return "";
		}
	}, [htmlContent]);

	/** properties */
	const centerY = textClip.posParam.centerY ?? 0.5;
	const centerX = textClip.posParam.centerX ?? 0.5;

	if (!unsafeModifiedHtml) return null;

	return (
		// stage size container
		<div
			style={{
				pointerEvents: "none",
				position: "absolute",
				top: 0,
				left: `calc(${stageRect.x || 0}px)`,
				width: stageRect.width,
				height: stageRect.height,
				zIndex: 99,
				fontFamily: "CustomFontXinyi",
			}}
			className="tezign-player-caption_container"
		>
			{/* position container */}
			<div
				style={{
					transform: "translate(-50%, 0%)",
					left: `${centerX * 100}%`,
					top: `${centerY * 100}%`,
					position: "absolute",
					width: "100%",
				}}
			>
				{/* adjust scale container */}
				<div
					style={{
						width: `calc(100% / ${stageRect.scale})`,
						transform: `scale(${stageRect.scale}) translate(0%, -50%)`,
						transformOrigin: "left top",
					}}
				>
					<div
						// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
						dangerouslySetInnerHTML={{
							__html: unsafeModifiedHtml,
						}}
					/>
				</div>
			</div>
		</div>
	);
};

export default TextClip;
