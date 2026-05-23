declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
  cwd(): string;
};

declare const console: {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

declare function encodeURIComponent(value: string): string;

declare function fetch(
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

declare module "node:test" {
  export default function test(name: string, fn: () => unknown | Promise<unknown>): void;
}

declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    throws(fn: () => unknown, error?: RegExp | { name?: string; message?: RegExp }): void;
    rejects(fn: () => Promise<unknown>, error?: RegExp | { name?: string; message?: RegExp }): Promise<void>;
  };
  export default assert;
}

declare module "node:crypto" {
  export function randomUUID(): string;
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: "hex"): string };
  };
}

declare module "node:http" {
  export type IncomingMessage = {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    on(event: "data", listener: (chunk: unknown) => void): void;
    on(event: "end", listener: () => void): void;
  };
  export type ServerResponse = {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  };
  export function createServer(
    listener: (request: IncomingMessage, response: ServerResponse) => void
  ): {
    listen(port: number, callback?: () => void): void;
  };
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readdirSync(path: string, options?: { withFileTypes?: boolean }): Array<{
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }>;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
  export function writeFileSync(path: string, data: string): void;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...parts: string[]): string;
  export function extname(path: string): string;
}

declare module "node:perf_hooks" {
  export const performance: { now(): number };
}
