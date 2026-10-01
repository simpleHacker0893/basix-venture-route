/**
 * Where the per-scene clips land, and a reader for a WebM's frame size, so each scene can prove
 * its clip is 1080p without ffprobe. The reader walks the EBML tree
 * Segment → Tracks → TrackEntry → Video → PixelWidth / PixelHeight.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Git-ignored (apps/web/.gitignore). */
export const CLIPS_DIR = path.resolve(HERE, "../../demo-output/clips");

export const VIDEO_SIZE = { width: 1920, height: 1080 } as const;

/** `clip` is the scene's stable clip name from the script (`scenes.ts`), e.g. `F1-signup`. */
export function clipPath(clip: string): string {
  return path.join(CLIPS_DIR, `${clip}.webm`);
}

const SEGMENT = 0x18538067;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const VIDEO = 0xe0;
const PIXEL_WIDTH = 0xb0;
const PIXEL_HEIGHT = 0xba;

type Vint = { value: number; length: number; allOnes: boolean };

function readVint(buf: Buffer, pos: number, keepMarker: boolean): Vint {
  const first = buf[pos];
  if (first === undefined || first === 0) throw new Error(`invalid EBML vint at byte ${pos}`);
  let length = 1;
  while (!(first & (0x80 >> (length - 1)))) length += 1;
  let value = keepMarker ? first : first & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i += 1) {
    const byte = buf[pos + i] ?? 0;
    value = value * 256 + byte;
    allOnes &&= byte === 0xff;
  }
  return { value, length, allOnes };
}

type Element = { id: number; start: number; end: number };

function* children(buf: Buffer, start: number, end: number): Generator<Element> {
  let pos = start;
  while (pos < end) {
    const id = readVint(buf, pos, true);
    const size = readVint(buf, pos + id.length, false);
    const dataStart = pos + id.length + size.length;
    // An unknown size (all ones) runs to the end of the parent.
    const dataEnd = size.allOnes ? end : Math.min(dataStart + size.value, end);
    yield { id: id.value, start: dataStart, end: dataEnd };
    pos = dataEnd;
  }
}

function child(buf: Buffer, parent: Element, id: number): Element {
  for (const element of children(buf, parent.start, parent.end)) {
    if (element.id === id) return element;
  }
  throw new Error(`EBML element 0x${id.toString(16)} not found`);
}

function uint(buf: Buffer, element: Element): number {
  let value = 0;
  for (let i = element.start; i < element.end; i += 1) value = value * 256 + (buf[i] ?? 0);
  return value;
}

/** The frame size recorded in a WebM's first track header. */
export function webmSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  const root: Element = { id: 0, start: 0, end: buf.length };
  const video = [SEGMENT, TRACKS, TRACK_ENTRY, VIDEO].reduce((parent, id) => child(buf, parent, id), root);
  return { width: uint(buf, child(buf, video, PIXEL_WIDTH)), height: uint(buf, child(buf, video, PIXEL_HEIGHT)) };
}

/**
 * The size of a JPEG (a screencast frame), from its first SOF marker. The WebM header only states
 * the canvas: Playwright pads smaller frames into it, so a clip can claim 1920×1080 while the page
 * fills its top-left corner. The fixture checks the frames themselves.
 */
export function jpegSize(buf: Buffer): { width: number; height: number } {
  let pos = 2;
  while (pos + 9 < buf.length) {
    if (buf[pos] !== 0xff) throw new Error(`invalid JPEG marker at byte ${pos}`);
    const marker = buf[pos + 1] ?? 0;
    const length = buf.readUInt16BE(pos + 2);
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: buf.readUInt16BE(pos + 7), height: buf.readUInt16BE(pos + 5) };
    }
    pos += 2 + length;
  }
  throw new Error("JPEG has no SOF marker");
}
