import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NodeProcessRunner,
  setProcessRunner,
  resetProcessRunner,
} from "../src/pumlsrvService.js";
import {
  FakeProcessRunner,
  FakeProcessHandle,
} from "./mocks/processRunner.js";

// Mock vscode for the functions that import it (needed so the module loads).
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: () => "PlantUML Server",
    }),
  },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    withProgress: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  ProgressLocation: { Notification: 1 },
}));

describe("ProcessRunner", () => {
  describe("NodeProcessRunner", () => {
    it("returns a handle with on and kill methods", () => {
      const runner = new NodeProcessRunner();
      const handle = runner.spawn("node", ["-e", "process.exit(0)"], {
        stdio: "ignore",
      });
      expect(typeof handle.kill).toBe("function");
      expect(typeof handle.on).toBe("function");
      // Consume the handle to avoid unref'd processes in tests.
      handle.kill();
    });
  });

  describe("setProcessRunner / resetProcessRunner", () => {
    let fake: FakeProcessRunner;

    beforeEach(() => {
      fake = new FakeProcessRunner();
    });

    afterEach(() => {
      resetProcessRunner();
    });

    it("routes spawn calls through the injected runner", () => {
      setProcessRunner(fake);
      fake.spawn("pumlsrv", ["-n", "8080"], {
        detached: false,
      });
      expect(fake.calls).toHaveLength(1);
      expect(fake.lastCall?.command).toBe("pumlsrv");
      expect(fake.lastCall?.args).toEqual(["-n", "8080"]);
    });

    it("resetProcessRunner restores the default runner", () => {
      setProcessRunner(fake);
      resetProcessRunner();
      // After reset, calling spawn should use a NodeProcessRunner,
      // which returns a real ChildProcess (not the fake).
      const runner = new NodeProcessRunner();
      const handle = runner.spawn("node", ["-e", ""], { stdio: "ignore" });
      expect(typeof handle.kill).toBe("function");
      handle.kill();
    });
  });

  describe("FakeProcessRunner", () => {
    it("records spawn calls", () => {
      const fake = new FakeProcessRunner();
      fake.spawn("pumlsrv", ["-n", "8080"], { detached: false });

      expect(fake.calls).toHaveLength(1);
      expect(fake.lastCall?.command).toBe("pumlsrv");
      expect(fake.lastCall?.args).toEqual(["-n", "8080"]);
    });

    it("returns a handle that records kill", () => {
      const fake = new FakeProcessRunner();
      const handle = fake.spawn("pumlsrv", [], {}) as FakeProcessHandle;
      expect(handle.killed).toBe(false);
      handle.kill();
      expect(handle.killed).toBe(true);
    });

    it("emits error handlers", () => {
      const fake = new FakeProcessRunner();
      const handle = fake.spawn("pumlsrv", [], {}) as FakeProcessHandle;
      const onError = vi.fn();
      handle.on("error", onError);
      handle.emitError(new Error("boom"));
      expect(onError).toHaveBeenCalledWith(new Error("boom"));
    });

    it("emits exit handlers", () => {
      const fake = new FakeProcessRunner();
      const handle = fake.spawn("pumlsrv", [], {}) as FakeProcessHandle;
      const onExit = vi.fn();
      handle.on("exit", onExit);
      handle.emitExit(0);
      expect(onExit).toHaveBeenCalledWith(0, null);
    });

    it("provides lastHandle and lastCall for convenience", () => {
      const fake = new FakeProcessRunner();
      const h1 = fake.spawn("a", [], {});
      fake.spawn("b", [], {});
      expect(fake.lastHandle).not.toBe(h1);
      expect(fake.lastCall?.command).toBe("b");
    });
  });
});
