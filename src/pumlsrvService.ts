import * as vscode from "vscode";
import * as http from "http";
import * as net from "net";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import { encodePlantUml } from "./plantumlEncoder.js";
import { getPumlsrvBinDir, installPinnedPumlsrv } from "./pumlsrvInstaller.js";

/* ------------------------------------------------------------------ */
/*  ProcessRunner adapter                                              */
/* ------------------------------------------------------------------ */

/**
 * Handle returned by {@link ProcessRunner.spawn}, abstracting just the
 * events and methods that pumlsrvService needs from a child process.
 */
export interface ChildProcessHandle {
  on(event: "error", handler: (err: Error) => void): void;
  on(event: "exit", handler: (code: number | null, signal: string | null) => void): void;
  kill(): void;
}

/**
 * Injectable adapter around child-process creation.
 *
 * The production implementation wraps `child_process.spawn`; tests supply
 * a fake that records calls and simulates lifecycle events.
 */
export interface ProcessRunner {
  spawn(command: string, args: string[], options: child_process.SpawnOptions): ChildProcessHandle;
}

/** Production ProcessRunner that delegates to `child_process.spawn`. */
export class NodeProcessRunner implements ProcessRunner {
  spawn(command: string, args: string[], options: child_process.SpawnOptions): ChildProcessHandle {
    return child_process.spawn(command, args, options);
  }
}

/** The active runner, replaceable via {@link setProcessRunner}. */
let currentProcessRunner: ProcessRunner = new NodeProcessRunner();

/**
 * Override the process runner (for tests).
 *
 * Call with a {@link FakeProcessRunner} to capture spawn calls without
 * actually running processes.
 */
export function setProcessRunner(runner: ProcessRunner): void {
  currentProcessRunner = runner;
}

/** Reset the process runner back to the production Node implementation. */
export function resetProcessRunner(): void {
  currentProcessRunner = new NodeProcessRunner();
}

const HELLO_WORLD_PUML = "@startuml\nAlice -> Bob: Hello\n@enduml";

/* v8 ignore start */

export type ServerType = "PlantUML Server" | "Local pumlsrv" | "Other";

export function getServerType(): ServerType {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<ServerType>("serverType", "PlantUML Server");
}

export function getCustomServerUrl(): string {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get("serverUrl", "http://localhost:8080/plantuml");
}

let activePumlsrvPort: number | undefined;

export function getServerUrl(): string {
  const type = getServerType();
  if (type === "PlantUML Server") {
    return "https://www.plantuml.com/plantuml";
  } else if (type === "Local pumlsrv") {
    return `http://localhost:${activePumlsrvPort}/plantuml`;
  } else {
    return getCustomServerUrl();
  }
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : undefined;
      server.close(() => {
        if (port === undefined) {
          reject(new Error("Could not determine a free port"));
        } else {
          resolve(port);
        }
      });
    });
    server.on("error", reject);
  });
}

async function checkPumlsrvRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const encoded = encodePlantUml(HELLO_WORLD_PUML);
    const req = http.get(
      `http://localhost:${port}/plantuml/svg/${encoded}`,
      { timeout: 2000 },
      (res) => {
        // Drain response to avoid socket hang
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => {
      resolve(false);
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function findPumlsrvBinary(): string | undefined {
  // Check PATH via 'which' (execFileSync avoids spawning a shell)
  try {
    const result = child_process
      .execFileSync("which", ["pumlsrv"], { encoding: "utf-8", timeout: 5000 })
      .trim();
    if (result && fs.existsSync(result)) {
      return result;
    }
  } catch {
    // not found on PATH
  }

  // Check XDG_BIN_HOME or ~/.local/bin
  const candidate = path.join(getPumlsrvBinDir(), "pumlsrv");
  if (fs.existsSync(candidate)) {
    return candidate;
  }

  return undefined;
}

async function runInstallWithProgress(): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Installing pumlsrv...",
      cancellable: false,
    },
    async () => {
      await installPinnedPumlsrv();
    }
  );
}

export function isPumlsrvInstalled(): boolean {
  return findPumlsrvBinary() !== undefined;
}

export async function installPumlsrvManually(): Promise<void> {
  if (isPumlsrvInstalled()) {
    void vscode.window.showInformationMessage("pumlsrv is already installed.");
    return;
  }
  try {
    await runInstallWithProgress();
  } catch (err) {
    void vscode.window.showErrorMessage(
      `pumlsrv installation failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return;
  }
  if (findPumlsrvBinary() === undefined) {
    void vscode.window.showErrorMessage(
      `pumlsrv installation failed: binary not found after install. ` +
        `Expected location: ${getPumlsrvBinDir()}`
    );
  } else {
    void vscode.window.showInformationMessage(
      "pumlsrv installed successfully."
    );
    void vscode.commands.executeCommand("markdown.preview.refresh");
  }
}

let pumlsrvProcess: ChildProcessHandle | undefined;

function startPumlsrvProcess(binary: string, port: number): void {
  // do not save settings + do not bring up browser on startup
  pumlsrvProcess = currentProcessRunner.spawn(
    binary,
    ["-n", "-N", port.toString()],
    { detached: false, stdio: "ignore" }
  );

  pumlsrvProcess.on("error", (err) => {
    void vscode.window.showErrorMessage(
      `pumlsrv failed to start: ${err.message}`
    );
    pumlsrvProcess = undefined;
  });

  pumlsrvProcess.on("exit", () => {
    pumlsrvProcess = undefined;
  });
}

let ensureRunningPromise: Promise<void> | undefined;

export async function stopPumlsrv(): Promise<void> {
  // Clear the cached startup promise so future callers restart from scratch
  ensureRunningPromise = undefined;
  const port = activePumlsrvPort;
  activePumlsrvPort = undefined;
  if (port === undefined) {
    return;
  }
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${port}/exit`,
      { timeout: 3000 },
      (res) => {
        res.resume();
        resolve();
      }
    );
    req.on("error", () => {
      resolve();
    });
    req.on("timeout", () => {
      req.destroy();
      // Fall back to killing the process directly
      if (pumlsrvProcess) {
        pumlsrvProcess.kill();
        pumlsrvProcess = undefined;
      }
      resolve();
    });
  });
}

export function ensurePumlsrvRunning(): Promise<void> {
  ensureRunningPromise ??= doEnsurePumlsrvRunning().catch((err: unknown) => {
    ensureRunningPromise = undefined;
    throw err;
  });
  return ensureRunningPromise;
}

async function doEnsurePumlsrvRunning(): Promise<void> {
  if (
    activePumlsrvPort !== undefined &&
    (await checkPumlsrvRunning(activePumlsrvPort))
  ) {
    return;
  }

  let binary = findPumlsrvBinary();

  if (binary === undefined) {
    const choice = await vscode.window.showInformationMessage(
      "pumlsrv is not installed. Install it now?",
      { modal: true },
      "Install"
    );
    if (choice !== "Install") {
      throw new Error(
        "pumlsrv is not installed. " +
          "Use the 'PlantUMLHelpers: Install pumlsrv' command to install it."
      );
    }

    await runInstallWithProgress();

    binary = findPumlsrvBinary();
    if (binary === undefined) {
      throw new Error(
        "pumlsrv installation succeeded but binary not found. " +
          `Expected location: ${getPumlsrvBinDir()}`
      );
    }
  }

  const port = await findFreePort();
  activePumlsrvPort = port;
  startPumlsrvProcess(binary, port);

  // Wait up to 10 seconds for pumlsrv to be ready
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await checkPumlsrvRunning(port)) {
      return;
    }
  }

  throw new Error(
    `pumlsrv started but is not responding on port ${port}. ` +
      "Check that the port is not blocked by a firewall."
  );
}
/* v8 ignore stop */
