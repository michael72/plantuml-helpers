import type {
  ProcessRunner,
  ChildProcessHandle,
} from "../../src/pumlsrvService.js";

/** A recorded spawn call. */
export interface SpawnCall {
  command: string;
  args: string[];
  options: Record<string, unknown>;
}

/**
 * Fake ProcessRunner that records spawn calls without running any process.
 *
 * Each `spawn` returns a handle whose events can be triggered manually
 * via {@link FakeProcessHandle}.
 */
export class FakeProcessRunner implements ProcessRunner {
  readonly calls: SpawnCall[] = [];
  readonly handles: FakeProcessHandle[] = [];

  spawn(
    command: string,
    args: string[],
    options: Record<string, unknown>
  ): ChildProcessHandle {
    this.calls.push({ command, args, options });
    const handle = new FakeProcessHandle();
    this.handles.push(handle);
    return handle;
  }

  /** The handle returned by the most recent `spawn` call. */
  get lastHandle(): FakeProcessHandle | undefined {
    return this.handles[this.handles.length - 1];
  }

  /** The most recent `spawn` call. */
  get lastCall(): SpawnCall | undefined {
    return this.calls[this.calls.length - 1];
  }
}

/**
 * Fake child-process handle whose events can be triggered manually.
 *
 * Register handlers via `.on("error", ...)` / `.on("exit", ...)`, then
 * call {@link emitError} or {@link emitExit} to simulate process events.
 */
export class FakeProcessHandle implements ChildProcessHandle {
  private errorHandler?: (err: Error) => void;
  private exitHandler?: (code: number | null, signal: string | null) => void;
  killed = false;

  on(event: "error", handler: (err: Error) => void): void;
  on(event: "exit", handler: (code: number | null, signal: string | null) => void): void;
  on(
    event: "error" | "exit",
    handler: ((err: Error) => void) | ((code: number | null, signal: string | null) => void)
  ): void {
    if (event === "error") {
      this.errorHandler = handler as (err: Error) => void;
    } else if (event === "exit") {
      this.exitHandler = handler as (code: number | null, signal: string | null) => void;
    }
  }

  kill(): void {
    this.killed = true;
  }

  emitError(err: Error): void {
    this.errorHandler?.(err);
  }

  emitExit(code: number | null, signal: string | null = null): void {
    this.exitHandler?.(code, signal);
  }
}
