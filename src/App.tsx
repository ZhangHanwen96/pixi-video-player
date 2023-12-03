import * as PIXI from "pixi.js";
import { useMount } from "ahooks";
import { TezignPlayer } from "./components/TezignPlayer";
import vmml from "@/mock/example-vmml-1";
import vmml2 from "@/mock/example-vmml-2";

import "./App.css";

import { QSPlayer } from "./QSPlayer";
import { VMMLTemplateV4 } from "./interface/vmml";

function App() {
    return (
        <>
            <TezignPlayer vmml={vmml2.template as VMMLTemplateV4} />;
        </>
    );
    return <QSPlayer />;
}

export default App;
