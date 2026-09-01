/** Single clock seam for every quiz deadline. */
let clock: () => number = () => Date.now();
export function now(): number { return clock(); }
export function setClockForTests(next: (() => number) | undefined): void { clock = next ?? (() => Date.now()); }
