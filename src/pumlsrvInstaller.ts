import * as child_process from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as https from "https";
import * as os from "os";
import * as path from "path";

/**
 * Pinned pumlsrv release installed by the extension.
 *
 * The jar is downloaded directly from the GitHub release and its sha256 is
 * verified against the digest pinned here before anything is installed -
 * no remote script is fetched or executed. A compromised upstream release
 * therefore cannot reach users of this extension until this pin is
 * deliberately updated.
 *
 * To upgrade: pick the new tag on
 * https://github.com/michael72/pumlsrv/releases and copy the jar's sha256
 * digest from
 * `curl -s https://api.github.com/repos/michael72/pumlsrv/releases/latest`.
 */
export const PINNED_PUMLSRV = {
  version: "v2.1.1",
  jarName: "pumlsrv-2.1.1.jar",
  sha256: "4726d8334644e793ad49d157d3f006f48a45777dee15f11880ee400321a23212",
  // maven.compiler.target of the pinned release (see pumlsrv's pom.xml)
  requiredJavaMajor: 25,
} as const;

export interface PumlsrvRelease {
  version: string;
  jarName: string;
  sha256: string;
}

export function jarDownloadUrl(release: PumlsrvRelease): string {
  return `https://github.com/michael72/pumlsrv/releases/download/${release.version}/${release.jarName}`;
}

/** Same locations get.sh uses, so both install methods find each other. */
export function getPumlsrvDataDir(): string {
  const env = globalThis.process.env;
  const dataHome =
    env["XDG_DATA_HOME"] ?? path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "pumlsrv");
}

export function getPumlsrvBinDir(): string {
  const env = globalThis.process.env;
  return env["XDG_BIN_HOME"] ?? path.join(os.homedir(), ".local", "bin");
}

/** Launcher script content, identical to the one written by pumlsrv's get.sh. */
export function launcherScript(dataDir: string, jarName: string): string {
  return (
    "#!/bin/bash\n" +
    `cd "${dataDir}"\n` +
    `java -cp "./${jarName}" com.github.michael72.pumlsrv.Main "$@"\n`
  );
}

/** Extracts the major version from `java -version` output, e.g. 21 from
 *  `openjdk version "21.0.10"` or 8 from `java version "1.8.0_392"`. */
export function parseJavaMajorVersion(versionOutput: string): number | undefined {
  const match = /version "(\d+)(?:\.(\d+))?/.exec(versionOutput);
  if (!match) {
    return undefined;
  }
  const first = Number(match[1]);
  // Pre-9 JDKs report "1.x"
  return first === 1 && match[2] !== undefined ? Number(match[2]) : first;
}

export async function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });
    stream.on("error", reject);
  });
}

/* v8 ignore start */
function assertJavaAvailable(): void {
  // java -version prints its version to stderr
  const result = child_process.spawnSync("java", ["-version"], {
    encoding: "utf-8",
    timeout: 10000,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      "Java is required to run pumlsrv but was not found on PATH."
    );
  }
  const major = parseJavaMajorVersion(result.stderr + result.stdout);
  if (major !== undefined && major < PINNED_PUMLSRV.requiredJavaMajor) {
    throw new Error(
      `pumlsrv ${PINNED_PUMLSRV.version} requires Java ` +
        `${PINNED_PUMLSRV.requiredJavaMajor.toString()} or newer, ` +
        `but Java ${major.toString()} was found on PATH.`
    );
  }
}

async function httpsDownload(
  url: string,
  dest: string,
  maxRedirects = 5
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "plantuml-helpers" }, timeout: 30000 },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location !== undefined) {
          res.resume();
          if (maxRedirects <= 0) {
            reject(new Error(`Too many redirects while downloading ${url}`));
            return;
          }
          const next = new URL(location, url).toString();
          if (!next.startsWith("https://")) {
            reject(new Error(`Refusing insecure redirect to ${next}`));
            return;
          }
          httpsDownload(next, dest, maxRedirects - 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`Download failed with HTTP ${status.toString()}: ${url}`));
          return;
        }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on("finish", () => {
          out.close(() => {
            resolve();
          });
        });
        out.on("error", (err) => {
          res.destroy();
          reject(err);
        });
        res.on("error", (err) => {
          out.destroy();
          reject(err);
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`Download timed out: ${url}`));
    });
    req.on("error", reject);
  });
}

/**
 * Downloads the pinned pumlsrv release jar, verifies its sha256 against the
 * pinned digest and installs jar + launcher script. Replaces the previous
 * `curl ... | bash` install, which executed a remote script without any
 * integrity check.
 */
export async function installPinnedPumlsrv(): Promise<void> {
  if (globalThis.process.platform === "win32") {
    throw new Error(
      "Automatic pumlsrv installation is not supported on Windows. " +
        "See https://github.com/michael72/pumlsrv for manual installation."
    );
  }
  assertJavaAvailable();

  const dataDir = getPumlsrvDataDir();
  const binDir = getPumlsrvBinDir();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });

  const jarPath = path.join(dataDir, PINNED_PUMLSRV.jarName);
  const tmpPath = path.join(
    dataDir,
    `.${PINNED_PUMLSRV.jarName}.${globalThis.process.pid.toString()}.tmp`
  );
  try {
    await httpsDownload(jarDownloadUrl(PINNED_PUMLSRV), tmpPath);
    const actual = await sha256OfFile(tmpPath);
    if (actual.toLowerCase() !== PINNED_PUMLSRV.sha256.toLowerCase()) {
      throw new Error(
        `Checksum mismatch for ${PINNED_PUMLSRV.jarName}: ` +
          `expected ${PINNED_PUMLSRV.sha256}, got ${actual}. ` +
          "The download was discarded."
      );
    }
    fs.renameSync(tmpPath, jarPath);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }

  const launcher = path.join(binDir, "pumlsrv");
  fs.writeFileSync(launcher, launcherScript(dataDir, PINNED_PUMLSRV.jarName));
  fs.chmodSync(launcher, 0o755);
}
/* v8 ignore stop */
