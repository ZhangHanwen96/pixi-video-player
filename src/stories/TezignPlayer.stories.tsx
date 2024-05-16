import type { Meta, StoryObj } from "@storybook/react";
import { within, userEvent, expect } from "@storybook/test";
import buggy from "@/mock/buggy.json";

import { TezignPlayer } from "../components/TezignPlayer";
import { Spin } from "antd";

const meta = {
	title: "Example/TezignPlayer",
	component: TezignPlayer,
	parameters: {
		// More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {
		container: {
			description: "The container element of the player",
			table: {
				disable: true,
			},
		},
		spinner: {
			description: "The spinner element when loading",
			table: {
				disable: true,
			},
		},
		backgroundColor: { control: "color" },
	},
} satisfies Meta<typeof TezignPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on interaction testing: https://storybook.js.org/docs/writing-tests/interaction-testing
export const Simple: Story = {
	args: {
		spinner: (
			<div className="absolute z-[9999] inset-0 bg-black/50 flex items-center justify-center">
				<Spin className="text-teal-500" spinning size="large" />
			</div>
		),
		vmml: buggy.template,
		width: 960,
		height: (960 / 16) * 9,
	},
};
