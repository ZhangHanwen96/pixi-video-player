import { useThrottle } from "ahooks";
import { TezignPlayer } from "./components/TezignPlayer";
import { Button, Drawer, FloatButton, Space, message } from "antd";
import Editor from "@monaco-editor/react";
import { useSize } from "ahooks";
import debugvmml from "@/mock/debugvmml.json";
import "./App.css";
import { VMMLTemplateV4 } from "@/interface/vmml";
import { useEffect, useRef, useState } from "react";

const ratio_16_9 = 16 / 9;
const ratio_9_16 = 9 / 16;

function App() {
	const ref = useRef<HTMLDivElement>(null);
	const size = useSize(ref);

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

	const [sheetOpen, setSheetOpen] = useState(false);
	const [code, setCode] = useState("");

	const [vmmlJson, setVmml] = useState<any>(debugvmml);
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
			<div ref={ref} className="aspect-video flex w-full bg-white">
				<FloatButton
					type="primary"
					style={{
						right: 24,
						bottom: 24,
					}}
					onClick={() => {
						setSheetOpen((p) => !p);
					}}
				/>
				<Drawer
					title="VMML JSON Editor"
					placement={"left"}
					closable={false}
					width={700}
					onClose={() => setSheetOpen(false)}
					open={sheetOpen}
					extra={
						<Space>
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
								Save
							</Button>
						</Space>
					}
				>
					<Editor
						value={code}
						height="100%"
						defaultLanguage="json"
						defaultValue="// some comment"
						onChange={(value) => {
							try {
								setCode(value);
							} catch (error) {}
						}}
					/>
				</Drawer>
				{vmmlJson && (
					<TezignPlayer
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
