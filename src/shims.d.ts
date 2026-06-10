declare const process: {
  argv: string[];
  exitCode?: number;
  cwd: () => string;
  env: Record<string, string | undefined>;
  exit: (code?: number) => never;
  on: (event: string, handler: () => void) => void;
  platform: string;
  version: string;
};

declare function setTimeout(handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]): number;
declare function clearTimeout(handle: number): void;
declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare function fetch(input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: 'utf8'): Promise<string>;
}

declare module 'playwright' {
  export interface Locator {
    first(): Locator;
    count(): Promise<number>;
    click(): Promise<void>;
    fill(value: string): Promise<void>;
    selectOption(option: { label: string }): Promise<void>;
    waitFor(options: { state: 'visible' }): Promise<void>;
    innerText(): Promise<string>;
  }

  export interface Page {
    goto(url: string): Promise<void>;
    title(): Promise<string>;
    url(): string;
    getByRole(role: string, options?: { name?: string }): Locator;
    getByText(text: string, options?: { exact?: boolean }): Locator;
    getByLabel(text: string, options?: { exact?: boolean }): Locator;
    getByPlaceholder(text: string, options?: { exact?: boolean }): Locator;
    locator(selector: string): Locator;
    keyboard: {
      press(key: string): Promise<void>;
    };
    waitForURL(predicate: (url: URL) => boolean): Promise<void>;
    waitForTimeout(milliseconds: number): Promise<void>;
    screenshot(options: { path: string; fullPage?: boolean }): Promise<Buffer>;
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
    tracing: {
      start(options: { screenshots: boolean; snapshots: boolean }): Promise<void>;
      stop(options: { path: string }): Promise<void>;
    };
  }

  export interface Browser {
    newContext(): Promise<BrowserContext>;
    close(): Promise<void>;
    version(): string;
  }

  export const chromium: {
    launch(options: { headless: boolean }): Promise<Browser>;
  };
}

declare module 'vite' {
  interface ViteDevServer {
    middlewares: (req: unknown, res: unknown, next: () => void) => void;
    close(): Promise<void>;
  }

  interface InlineConfig {
    configFile?: string | false;
    root?: string;
    server?: { middlewareMode?: boolean };
    appType?: string;
    plugins?: unknown[];
  }

  export function createServer(config: InlineConfig): Promise<ViteDevServer>;
}

declare module '@vitejs/plugin-react' {
  export default function react(): unknown;
}
