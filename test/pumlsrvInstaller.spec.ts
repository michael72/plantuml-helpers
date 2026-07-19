import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  PINNED_PUMLSRV,
  jarDownloadUrl,
  launcherScript,
  parseJavaMajorVersion,
  sha256OfFile,
  getPumlsrvBinDir,
  getPumlsrvDataDir,
} from "../src/pumlsrvInstaller.js";

describe("pumlsrvInstaller", () => {
  describe("PINNED_PUMLSRV", () => {
    it("should pin a full sha256 digest in lowercase hex", () => {
      expect(PINNED_PUMLSRV.sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should pin a jar matching the pinned version", () => {
      const bareVersion = PINNED_PUMLSRV.version.replace(/^v/, "");
      expect(PINNED_PUMLSRV.jarName).toBe(`pumlsrv-${bareVersion}.jar`);
    });
  });

  describe("jarDownloadUrl", () => {
    it("should build the GitHub release download URL for the pinned jar", () => {
      expect(jarDownloadUrl(PINNED_PUMLSRV)).toBe(
        "https://github.com/michael72/pumlsrv/releases/download/" +
          `${PINNED_PUMLSRV.version}/${PINNED_PUMLSRV.jarName}`
      );
    });
  });

  describe("launcherScript", () => {
    it("should produce the same launcher get.sh writes", () => {
      const script = launcherScript("/home/user/.local/share/pumlsrv", "x.jar");
      expect(script).toBe(
        "#!/bin/bash\n" +
          'cd "/home/user/.local/share/pumlsrv"\n' +
          'java -cp "./x.jar" com.github.michael72.pumlsrv.Main "$@"\n'
      );
    });
  });

  describe("parseJavaMajorVersion", () => {
    it("should parse modern java version output", () => {
      expect(
        parseJavaMajorVersion('openjdk version "21.0.10" 2026-01-20')
      ).toBe(21);
      expect(parseJavaMajorVersion('java version "25" 2025-09-16')).toBe(25);
    });

    it("should parse pre-9 java version output", () => {
      expect(parseJavaMajorVersion('java version "1.8.0_392"')).toBe(8);
    });

    it("should return undefined for unrecognized output", () => {
      expect(parseJavaMajorVersion("no version here")).toBeUndefined();
    });
  });

  describe("sha256OfFile", () => {
    it("should compute the sha256 of a file as lowercase hex", async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pumlsrv-test-"));
      const file = path.join(dir, "data.bin");
      try {
        fs.writeFileSync(file, "abc");
        await expect(sha256OfFile(file)).resolves.toBe(
          "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should reject for a missing file", async () => {
      await expect(sha256OfFile("/nonexistent/nowhere.bin")).rejects.toThrow();
    });
  });

  describe("install directories", () => {
    const savedBin = process.env["XDG_BIN_HOME"];
    const savedData = process.env["XDG_DATA_HOME"];

    afterEach(() => {
      if (savedBin === undefined) {
        delete process.env["XDG_BIN_HOME"];
      } else {
        process.env["XDG_BIN_HOME"] = savedBin;
      }
      if (savedData === undefined) {
        delete process.env["XDG_DATA_HOME"];
      } else {
        process.env["XDG_DATA_HOME"] = savedData;
      }
    });

    it("should honor XDG_BIN_HOME and XDG_DATA_HOME", () => {
      process.env["XDG_BIN_HOME"] = "/custom/bin";
      process.env["XDG_DATA_HOME"] = "/custom/share";
      expect(getPumlsrvBinDir()).toBe("/custom/bin");
      expect(getPumlsrvDataDir()).toBe(path.join("/custom/share", "pumlsrv"));
    });

    it("should fall back to ~/.local defaults", () => {
      delete process.env["XDG_BIN_HOME"];
      delete process.env["XDG_DATA_HOME"];
      expect(getPumlsrvBinDir()).toBe(
        path.join(os.homedir(), ".local", "bin")
      );
      expect(getPumlsrvDataDir()).toBe(
        path.join(os.homedir(), ".local", "share", "pumlsrv")
      );
    });
  });
});
