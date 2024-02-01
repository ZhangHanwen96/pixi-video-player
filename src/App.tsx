import * as PIXI from "pixi.js";
import { useMount } from "ahooks";
import { TezignPlayer } from "./components/TezignPlayer";
import vmml from "@/mock/example-vmml-1";
import vmml2 from "@/mock/example-vmml-2";
import vmml3 from "@/mock/example-vmml-3";
import { useSize } from "ahooks";

import "./App.css";

import { QSPlayer } from "./QSPlayer";
import { VMMLTemplateV4 } from "./interface/vmml";
import { useRef } from "react";

function App() {
	const ref = useRef<HTMLDivElement>(null);
	const size = useSize(ref);

	console.log(size);
	return (
		<div
			style={{
				display: "flex",
				width: 800,
			}}
		>
			<div
				ref={ref}
				style={{
					aspectRatio: "16 / 9",
				}}
				className="flex-auto bg-white"
			>
				<TezignPlayer
					containerRect={{
						height: size?.height || 450,
						width: size?.width || 800,
					}}
					vmml={vmml3.template as VMMLTemplateV4}
				/>
			</div>
		</div>
	);
	// return <QSPlayer />;
}

export default App;
