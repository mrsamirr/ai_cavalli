declare module 'escpos' {
    export class USB {
        constructor(vidpid?: number, vidpid2?: number);
        open(callback: (err: Error | null) => void): void;
        close(): void;
    }

    export class Printer {
        constructor(device: USB, options?: any);
        text(content: string): Printer;
        align(type: 'LT' | 'CT' | 'RT'): Printer;
        style(type: 'NORMAL' | 'B' | 'I' | 'U' | 'U2' | 'BU' | 'BU2' | 'BIU' | 'BIU2'): Printer;
        size(width: number, height: number): Printer;
        feed(n?: number): Printer;
        cut(type?: 'FULL' | 'PAPER'): Printer;
        close(callback?: () => void): Printer;
    }

    export let USB: any;
}

declare module 'escpos-usb' {
    const USB: any;
    export default USB;
}
