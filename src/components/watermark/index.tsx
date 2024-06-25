import { $on, $ons } from "@/event-utils";
import { useTimelineStore } from "@/store";
import { Container, Text } from "@pixi/react";
import * as PIXI from "pixi.js";
import { useEffect, useRef, useState } from "react";

type WatermarkProps = {
	stageRect: any;
};

const Watermark = ({ stageRect }: WatermarkProps) => {
	const [opacity, setOpacity] = useState(0);
	const textRef = useRef<PIXI.Text | null>(null);
	const [transform, setTransform] = useState({ x: 0, y: 0 });

	const textMetrics = useRef<any>();
	const timeline = useTimelineStore.use.timeline?.(true);

	useEffect(() => {
		if (textRef.current) {
			const { height, width } = textRef.current.getBounds();
			textMetrics.current = { height, width };
		}
	}, []);

	useEffect(() => {
		return $ons(
			[
				{
					// @ts-ignore
					event: "update",
					handler(...args) {},
				},
			],
			timeline,
		);
	}, []);

	return (
		<Container>
			<Text
				alpha={opacity}
				anchor={{
					x: 0.5,
					y: 0,
				}}
				// x={stageRect.width * centerX}
				// scale={stageRect.scale}
				// y={stageRect.height * centerY}
				ref={textRef}
				zIndex={200}
				style={
					new PIXI.TextStyle({
						align: "center",
						// dropShadow: true,
						// dropShadowColor: "#ccced2",
						// dropShadowBlur: 4,
						// dropShadowAngle: Math.PI / 6,
						// dropShadowDistance: 6,
						// breakWords: true,
						// TODO:
						// textBaseline: "top",
						// padding: 30,
						wordWrap: true,
						lineJoin: "round",
						whiteSpace: "pre",
						breakWords: true,
						fontSize: 48,
						wordWrapWidth:
							// TODO: how much padding?
							(stageRect.width / stageRect.scale) * 0.75,
						// ...customStyles,
					})
				}
				resolution={window.devicePixelRatio || 1}
			/>
		</Container>
	);
};

export default Watermark;
