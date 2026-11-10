import { canvas2d } from '#/graphics/Canvas.js';
import Pix2D from '#/graphics/Pix2D.js';

export default class PixMap {
    // EASCape (from 2007scape): in the PixMap whose pixels are `owner`, a rectangle where pixels equal to
    // `copy` are made transparent, so the SD increased-resolution view under the canvas shows through
    // (client/SdView.ts); it lapses if no new frame comes within a second
    static hole: { owner: Int32Array; x: number; y: number; width: number; height: number; copy: Int32Array; age: number } | null = null;

    readonly data: Int32Array;
    private readonly width: number;
    private readonly height: number;
    private readonly img: ImageData;

    private readonly ctx: CanvasRenderingContext2D;
    private readonly paint: Uint32Array;

    constructor(width: number, height: number, ctx: CanvasRenderingContext2D = canvas2d) {
        this.width = width;
        this.height = height;
        this.data = new Int32Array(width * height);

        this.ctx = ctx;
        this.img = this.ctx.createImageData(width, height);
        this.paint = new Uint32Array(this.img.data.buffer);

        this.setPixels();
    }

    setPixels(): void {
        Pix2D.setPixels(this.data, this.width, this.height);
    }

    draw(x: number, y: number): void {
        this.prepareCanvas();
        this.ctx.putImageData(this.img, x, y);
    }

    private prepareCanvas(): void {
        const data = this.data;
        const paint = this.paint;
        const len = data.length;

        let i = 0;
        const unroll = len - (len % 4);

        for (; i < unroll; i += 4) {
            const p0 = data[i];
            const p1 = data[i + 1];
            const p2 = data[i + 2];
            const p3 = data[i + 3];

            paint[i] = ((p0 & 0xff0000) >> 16) | (p0 & 0xff00) | ((p0 & 0xff) << 16) | 0xff000000;
            paint[i + 1] = ((p1 & 0xff0000) >> 16) | (p1 & 0xff00) | ((p1 & 0xff) << 16) | 0xff000000;
            paint[i + 2] = ((p2 & 0xff0000) >> 16) | (p2 & 0xff00) | ((p2 & 0xff) << 16) | 0xff000000;
            paint[i + 3] = ((p3 & 0xff0000) >> 16) | (p3 & 0xff00) | ((p3 & 0xff) << 16) | 0xff000000;
        }

        for (; i < len; i++) {
            const pixel = data[i];
            paint[i] = ((pixel & 0xff0000) >> 16) | (pixel & 0xff00) | ((pixel & 0xff) << 16) | 0xff000000;
        }

        const hole = PixMap.hole;
        if (hole !== null && hole.owner === data && performance.now() - hole.age < 1000 && hole.x + hole.width <= this.width && hole.y + hole.height <= this.height) {
            const copy = hole.copy;
            let c = 0;
            for (let y = 0; y < hole.height; y++) {
                let p = (hole.y + y) * this.width + hole.x;
                for (let x = 0; x < hole.width; x++, p++, c++) {
                    if (data[p] === copy[c]) {
                        paint[p] = 0;
                    }
                }
            }
        }
    }
}
