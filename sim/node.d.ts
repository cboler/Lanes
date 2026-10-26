// The few Node APIs the simulator uses, so it needs no @types/node.
declare const process: {
  readonly env: Record<string, string | undefined>;
  readonly stdout: { write(text: string): boolean };
};

declare module 'node:fs' {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string): void;
}
