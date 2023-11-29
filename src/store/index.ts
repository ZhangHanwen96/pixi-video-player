/* eslint-disable @typescript-eslint/ban-ts-comment */
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import * as PIXI from "pixi.js";
import { createSelectors } from "./createSelectors";
import { TimeLineContoller } from "../Timeline";
import { shallow } from "zustand/shallow";

interface State {
    timeline?: TimeLineContoller;
    app?: PIXI.Application;
    pausedByController: boolean;
}

interface Actions {
    setApp: (app: PIXI.Application) => void;
    setTimeline: (timeline: TimeLineContoller) => void;
}

let $timeline: TimeLineContoller | undefined;

export const timelineStore = create(
    subscribeWithSelector<State & Actions>((set, get) => {
        return {
            timeline: undefined,
            app: undefined,
            pausedByController: false,
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
    })
);

timelineStore.subscribe(
    (s) => s.pausedByController,
    (current, prev) => {
        console.warn(current, "   " + 1111111);
    },
    {
        equalityFn: shallow,
        fireImmediately: true,
    }
);

export const useTimelineStore = createSelectors(timelineStore);
