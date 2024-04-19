import { useThrottle, useUpdateEffect } from "ahooks";
import { TezignPlayer } from "./components/TezignPlayer";
import { Button, Drawer, FloatButton, Space, message } from "antd";
import Editor, { useMonaco } from "@monaco-editor/react";
import { useSize } from "ahooks";
import defaultVMML from "@/mock/debugvmml.json";
import custom_1 from "@/mock/custom_1.json";
import githubTheme from "./github.theme.json";
import MdiCodeJson from "~icons/mdi/code-json";
import MdiClosedCaptionOutline from "~icons/mdi/closed-caption-outline";
import "./App.css";
import { VMMLTemplateV4 } from "@/interface/vmml";
import { useEffect, useRef, useState } from "react";
import CaptionEditor from "./components/caption-editor";
import { useTezignPlayerStore } from "./store/teizng-player";
import { useControls, folder, button } from "leva";
import { flushSync } from "react-dom";

const ratio_16_9 = 16 / 9;
const ratio_9_16 = 9 / 16;

const defaultPreset = {
	default: defaultVMML,
	"自定义-1": custom_1,
};

let customIndex = 1;

function App() {
	const ref = useRef<HTMLDivElement>(null);
	const size = useSize(ref);
	const [presets, setPresets] = useState(defaultPreset);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [code, setCode] = useState("");

	const [vmmlJson, setVmml] = useState<any>(defaultVMML);

	const [{ preset }, set] = useControls(() => ({
		preset: {
			value: "default",
			options: Object.keys(presets),
			onChange: (v) => {
				setVmml(presets[v as keyof typeof presets]);
			},
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

	console.log(presets);

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
	const classes = isTooVertical
		? "w-[35vw]"
		: "w-[85vw] lg:w-[70vw] 2xl:w-[60vw]";

	return (
		<div className={classes}>
			{/* <FloatButton
				icon={<MdiCodeJson />}
				type="primary"
				style={{
					right: 24,
					bottom: 24,
				}}
				tooltip="Edit VMML"
				onClick={() => {
					setSheetOpen((p) => !p);
				}}
			/>
			<FloatButton
				icon={<MdiClosedCaptionOutline />}
				type="primary"
				style={{
					right: 24,
					bottom: 90,
				}}
				tooltip="Caption"
				onClick={() => {
					useTezignPlayerStore.setState((s) => {
						return {
							showCaptionEditor: !s.showCaptionEditor,
						};
					});
				}}
			/> */}
			<div
				ref={ref}
				className="aspect-video flex w-full bg-black shadow-xl"
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
						key={vmmlJson.template.tracks[0].id}
						container={() => ref.current as HTMLDivElement}
						// width={useDeferredValue(tWidth)}
						// height={useDeferredValue(tHeight)}
						vmml={vmmlJson.template as VMMLTemplateV4}
					/>
				)}
			</div>
		</div>
	);
	// return <QSPlayer />;
}

export default App;
