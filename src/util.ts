export function calculateScale(
    containerWidth: number,
    containerHeight: number,
    imageWidth: number,
    imageHeight: number
) {
    // Calculate the scale
    const scale = Math.min(
        containerWidth / imageWidth,
        containerHeight / imageHeight
    );

    // Calculate the x and y coordinates
    const x = (containerWidth - imageWidth * scale) / 2;
    const y = (containerHeight - imageHeight * scale) / 2;

    return {
        x,
        y,
        scale,
        width: imageWidth * scale,
        height: imageHeight * scale,
    };
}

type Rect = {
    width: number;
    height: number;
};

export const calculatRectByObjectFit = (
    {
        containerRect,
        sourceRect,
    }: {
        containerRect: Rect;
        sourceRect: Rect;
    },
    objectFit: "contain" | "cover" | "fill" | "none" = "contain"
) => {
    switch (objectFit) {
        case "contain": {
            const scale = Math.min(
                containerRect.width / sourceRect.width,
                containerRect.height / sourceRect.height
            );
            return {
                width: sourceRect.width * scale,
                height: sourceRect.height * scale,
                scale,
                x: (containerRect.width - sourceRect.width * scale) / 2,
                y: (containerRect.height - sourceRect.height * scale) / 2,
            };
        }
        case "fill": {
            return {
                width: containerRect.width,
                height: containerRect.height,
                scale: 1,
                x: 0,
                y: 0,
            };
        }
        case "cover": {
            const scale = Math.max(
                containerRect.width / sourceRect.width,
                containerRect.height / sourceRect.height
            );
            return {
                width: sourceRect.width * scale,
                height: sourceRect.height * scale,
                scale,
                x: (containerRect.width - sourceRect.width * scale) / 2,
                y: (containerRect.height - sourceRect.height * scale) / 2,
            };
        }
        case "none": {
            return {
                width: sourceRect.width,
                height: sourceRect.height,
                scale: 1,
                x: 0,
                y: 0,
            };
        }
    }
};

export const delay = (ms: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

export const easeIn = (
    from: number,
    to: number,
    duration: number,
    elapsed: number
) => {
    const t = elapsed / duration;
    console.log(t);
    return from + (to - from) * t * t;
};
