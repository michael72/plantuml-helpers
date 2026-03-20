/* v8 ignore start */
import * as vscode from "vscode";
import * as http from "http";
import * as child_process from "child_process";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { encodePlantUml } from "./plantumlEncoder.js";

const HELLO_WORLD_PUML = "@startuml\nAlice -> Bob: Hello\n@enduml";

export type ServerType = "PlantUML Server" | "Local pumlsrv" | "Other";

export function getServerType(): ServerType {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<ServerType>("serverType", "PlantUML Server");
}

export function getPumlsrvPort(): number {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<number>("pumlsrvPort", 8380);
}

export function getCustomServerUrl(): string {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<string>("serverUrl", "http://localhost:8080/plantuml");
}

export function getServerUrl(): string {
  const type = getServerType();
  if (type === "PlantUML Server") {
    return "https://www.plantuml.com/plantuml";
  } else if (type === "Local pumlsrv") {
    return `http://localhost:${getPumlsrvPort()}`;
  } else {
    return getCustomServerUrl();
  }
}

async function checkPumlsrvRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const encoded = encodePlantUml(HELLO_WORLD_PUML);
    const req = http.get(
      `http://localhost:${port}/svg/${encoded}`,
      { timeout: 2000 },
      (res) => {
        // Drain response to avoid socket hang
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => { resolve(false); });
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function getPumlsrvBinDir(): string {
  const env = globalThis.process.env;
  return env["XDG_BIN_HOME"] ?? path.join(os.homedir(), ".local", "bin");
}

function findPumlsrvBinary(): string | undefined {
  // Check PATH via 'which'
  try {
    const result = child_process
      .execSync("which pumlsrv", { encoding: "utf-8", timeout: 5000 })
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

async function installPumlsrv(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(
      "bash",
      [
        "-c",
        "curl -sSL https://raw.githubusercontent.com/michael72/pumlsrv/master/get.sh | bash",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    // The install script asks whether to start pumlsrv - answer "n"
    proc.stdin?.write("n\n");
    proc.stdin?.end();

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pumlsrv installation failed with exit code ${code?.toString() ?? "unknown"}`));
      }
    });

    proc.on("error", reject);
  });
}

let pumlsrvProcess: child_process.ChildProcess | undefined;

function startPumlsrvProcess(binary: string, port: number): void {
  pumlsrvProcess = child_process.spawn(binary, ["-N", port.toString()], {
    detached: false,
    stdio: "ignore",
  });

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

export async function stopPumlsrv(port: number): Promise<void> {
  // Clear the cached startup promise so future callers restart from scratch
  ensureRunningPromise = undefined;
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${port}/exit`,
      { timeout: 3000 },
      (res) => {
        res.resume();
        resolve();
      }
    );
    req.on("error", () => { resolve(); });
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
  const port = getPumlsrvPort();

  if (await checkPumlsrvRunning(port)) {
    return;
  }

  let binary = findPumlsrvBinary();

  if (binary === undefined) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Installing pumlsrv...",
        cancellable: false,
      },
      async () => {
        await installPumlsrv();
      }
    );

    binary = findPumlsrvBinary();
    if (binary === undefined) {
      throw new Error(
        "pumlsrv installation succeeded but binary not found. " +
          `Expected location: ${getPumlsrvBinDir()}`
      );
    }
  }

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
