export const canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
export const canvas2d: CanvasRenderingContext2D = canvas?.getContext('2d', {
    desynchronized: false,
    // EASCape: alpha, so the SD increased-resolution view (client/SdView.ts) can show through the
    // viewport; every pixel the client draws is opaque, so this changes nothing else
    alpha: true
})!;

export function saveDataURL(dataURL: string, filename: string) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
