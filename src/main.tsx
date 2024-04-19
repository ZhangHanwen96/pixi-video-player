import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "antd/dist/reset.css";
import "./index.css";
import { ConfigProvider } from "antd";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ConfigProvider
			theme={{
				token: {
					colorPrimary: "#000000",
					colorInfo: "#000000",
					wireframe: false,
				},
				components: {
					Select: {
						optionSelectedColor: "rgba(255, 255, 255)",
					},
				},
			}}
		>
			<App />
		</ConfigProvider>
	</React.StrictMode>,
);
