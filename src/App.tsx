import * as PIXI from "pixi.js";
import { useMount } from "ahooks";

import "./App.css";
import { useRef, useState } from "react";
import { TimeLineProvider } from "./Timeline";

import { QSPlayer } from "./QSPlayer";

// const blurFilter = new PIXI.BlurFilter(20, 10, window.devicePixelRatio || 1);
// // blurFilter.autoFit = true;
// // blurFilter.blur = 2;
// blurFilter.enabled = true;

export const MyComponent = () => {
    const [app, setApp] = useState<PIXI.Application>();

    return (
        <TimeLineProvider app={app}>
            <QSPlayer setApp={setApp} />
        </TimeLineProvider>
    );
};

function App() {
    const [show, setShow] = useState(false);
    return (
        <div>
            {show && <MyComponent />}
            <button
                onClick={() => {
                    setShow(!show);
                }}
            >
                12312132
            </button>
        </div>
    );
}

export default App;
