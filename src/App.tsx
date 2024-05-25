import { VMMLTemplateV4 } from "@/interface/vmml";
import custom_1 from "@/mock/custom_1.json";
import custom_2 from "@/mock/custom_3.json";
import defaultVMML from "@/mock/debugvmml.json";
import htmlVmml from "@/mock/html_vmml.json";
import Editor, { useMonaco } from "@monaco-editor/react";
import { useThrottle, useUpdateEffect } from "ahooks";
import { useSize } from "ahooks";
import { Button, Drawer, FloatButton, Space, Spin, message } from "antd";
import { button, folder, useControls } from "leva";
import React, {
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import "./App.css";
import { TezignPlayer } from "./components/TezignPlayer";
import { usePoster } from "./components/TezignPlayer/usePoster";
import { useTezignPlayerStore } from "./store/tezignPlayer";

const ratio_16_9 = 16 / 9;
const ratio_9_16 = 9 / 16;

const defaultPreset = {
	default: defaultVMML,
	HTML字幕: htmlVmml,
	"自定义-1": custom_1,
	"自定义-2": custom_2,
};

const aspect_ratio_mapping = {
	"16:9": 16 / 9,
	"9:16": 9 / 16,
	"4:3": 4 / 3,
};

const Comp = React.forwardRef(() => {
	return <div>asd</div>;
});

function App() {
	const ref = useRef<HTMLDivElement>(null);
	const size = useSize(ref);
	const [presets, setPresets] = useState(defaultPreset);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [code, setCode] = useState("");

	const [vmmlJson, setVmml] = useState<any>(defaultVMML);

	const [{ preset, auto_poster, aspectRatio }, set] = useControls(() => ({
		preset: {
			value: "default",
			options: Object.keys(presets),
			onChange: (v) => {
				setVmml(presets[v as keyof typeof presets]);
			},
		},
		auto_poster: true,
		aspectRatio: {
			value: "16:9",
			options: ["16:9", "9:16", "4:3"],
		},
		编辑VMML: button((get) => {
			setSheetOpen((p) => !p);
		}),
		字幕: button((get) => {
			useTezignPlayerStore.setState((s) => {
				return {
					showCaptionEditor: !s.showCaptionEditor,
				};
			});
		}),
	}));

	const width = Math.round(size?.width || 800);
	const height = Math.round(width / ratio_16_9);

	const tWidth = useThrottle(width, {
		wait: 300,
		leading: true,
		trailing: true,
	});
	const tHeight = useThrottle(height, {
		wait: 300,
		leading: true,
		trailing: true,
	});

	useUpdateEffect(() => {
		if (preset === "default") {
			setVmml(defaultVMML);
		}
	}, [preset]);
	const preCodeRef = useRef("");

	useEffect(() => {
		if (sheetOpen) {
			const currentCode = JSON.stringify(vmmlJson, null, 2);
			preCodeRef.current = currentCode;
			setCode(currentCode);
		} else {
			setCode("");
			preCodeRef.current = "";
		}
	}, [sheetOpen]);

	const isTooVertical = tWidth / tHeight <= 3 / 4;
	let classes = "w-[85vw] lg:w-[70vw] 2xl:w-[60vw]";
	if (isTooVertical) {
		classes = "w-[clamp(400px,30vw,800px)]";
	}
	if (aspectRatio === "9:16") {
		classes = "w-[clamp(400px,30vw,800px)]";
	}
	if (aspectRatio === "4:3") {
		classes = "w-[55vw]";
	}

	const videoTracks = useMemo(() => {
		return vmmlJson.template.tracks
			.filter(({ type }) => type === 0 || type === 1)
			.sort(
				(a: { type: number }, b: { type: number }) => a.type - b.type,
			);
	}, [vmmlJson.template]);

	const sourceUrl = useDeferredValue(
		videoTracks[0]?.clips[0].videoClip?.sourceUrl,
	);

	const { poster: posterUrl } = usePoster(
		auto_poster ? sourceUrl : undefined,
	);

	return (
		<div className={classes}>
			<div
				ref={ref}
				className="flex w-full bg-black shadow-xl"
				style={{
					aspectRatio:
						aspect_ratio_mapping[
							aspectRatio as keyof typeof aspect_ratio_mapping
						],
				}}
				// style={{
				// 	aspectRatio: 4 / 16,
				// 	width: "50vw",
				// }}
			>
				<Drawer
					title="VMML Editor"
					placement={"left"}
					closable={true}
					width={700}
					onClose={() => setSheetOpen(false)}
					open={sheetOpen}
					extra={
						<Space>
							{/* <Button
								type="primary"
								onClick={() => {
									try {
										const vmmlJson = JSON.parse(code);
										const name = `自定义-${customIndex++}`;
										flushSync(() => {
											setPresets((p) => {
												const newPreset = {
													...p,
													[name]: vmmlJson,
												};
												return newPreset;
											});
										});
										set({
											preset: name,
										});
										setSheetOpen(false);
									} catch (error) {
										message.error("Invalid Vmml Json");
									}
								}}
							>
								保存至 preset
							</Button> */}
							<Button
								type="primary"
								onClick={() => {
									try {
										const vmmlJson = JSON.parse(code);
										setVmml(vmmlJson);
										setSheetOpen(false);
									} catch (error) {
										message.error("Invalid Vmml json");
									}
								}}
							>
								保存
							</Button>
						</Space>
					}
				>
					<Editor
						value={code}
						height="100%"
						defaultLanguage="json"
						defaultValue="// vmml json here"
						onChange={(value) => {
							try {
								setCode(value);
							} catch (error) {}
						}}
						options={{
							"semanticHighlighting.enabled": true,
						}}
						theme="vs-light"
					/>
				</Drawer>
				{vmmlJson && (
					<TezignPlayer
						features={[
							"audioTrack",
							"captionTrack",
							"controller-options",
							"poster",
						]}
						key={vmmlJson.template.tracks[0].id}
						container={() => ref.current as HTMLDivElement}
						// width={useDeferredValue(tWidth)}
						// height={useDeferredValue(tHeight)}
						vmml={vmmlJson.template as VMMLTemplateV4}
						poster={{
							url: posterUrl,
							objectFit: "contain",
						}}
						spinner={
							<div className="h-full w-full bg-black/50 flex items-center justify-center">
								<Spin
									style={{ color: "green" }}
									spinning
									size="large"
								/>
							</div>
						}
					/>
				)}
			</div>
		</div>
	);
	// return <QSPlayer />;
}

export default App;
