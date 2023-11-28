/* eslint-disable @typescript-eslint/ban-ts-comment */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import * as PIXI from "pixi.js";
import { createSelectors } from "./createSelectors";
import { TimeLineContoller } from "../Timeline";

interface State {
    timeline?: TimeLineContoller;
    app?: PIXI.Application;
}

interface Actions {
    setApp: (app: PIXI.Application) => void;
    setTimeline: (timeline: TimeLineContoller) => void;
}

let $timeline: TimeLineContoller | undefined;

export const timelineStore = create<State & Actions>((set, get) => {
    return {
        timeline: undefined,
        app: undefined,
        setApp(app) {
            const createTimeline = () => {
                if (!app) return undefined;

                app.stop();
                $timeline = new TimeLineContoller(
                    {
                        totalDuration: 13_176,
                        onCaptionChange: (caption) => {
                            // console.log(caption);
                        },
                    },
                    app
                );
                return $timeline;
            };
            const timeline = createTimeline();
            set(() => ({ app, timeline }));
        },
        setTimeline(timeline) {
            set(() => ({ timeline }));
        },
    };
});

export const useTimelineStore = createSelectors(timelineStore);
