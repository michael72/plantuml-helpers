import * as vscode from "vscode";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ServerType = "PlantUML Server" | "Local pumlsrv" | "Other";

/* ------------------------------------------------------------------ */
/*  Pumlsrv port (set by the process lifecycle manager)                */
/* ------------------------------------------------------------------ */

let activePumlsrvPort: number | undefined;

/**
 * Called by pumlsrvService when the local pumlsrv port changes.
 * Affects the URL returned by {@link getServerUrl} when serverType is
 * "Local pumlsrv".
 */
export function setActivePumlsrvPort(port: number | undefined): void {
  activePumlsrvPort = port;
}

/* ------------------------------------------------------------------ */
/*  Server-type                                                        */
/* ------------------------------------------------------------------ */

/**
 * Returns the configured server type.
 */
export function getServerType(): ServerType {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<ServerType>("serverType", "PlantUML Server");
}

/* ------------------------------------------------------------------ */
/*  Server URL                                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns the custom server URL from configuration.
 * Only meaningful when serverType is "Other".
 */
function getCustomServerUrl(): string {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get("serverUrl", "http://localhost:8080/plantuml");
}

/**
 * Returns the full PlantUML server URL based on the configured server type.
 *
 * - "PlantUML Server" → https://www.plantuml.com/plantuml
 * - "Local pumlsrv"   → http://localhost:{port}/plantuml
 * - "Other"           → the custom server URL from settings
 */
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

/* ------------------------------------------------------------------ */
/*  Render method                                                      */
/* ------------------------------------------------------------------ */

/**
 * Returns the configured render method for communicating with the
 * PlantUML server.
 */
export function getRenderMethod(): "get" | "post" {
  const config = vscode.workspace.getConfiguration("plantumlHelpers");
  return config.get<"get" | "post">("renderMethod", "get");
}
