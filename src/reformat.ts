import { SortComponent } from "./sortcomponent";
import { SortSequence } from "./sortsequence";
import { Component } from "./uml/component";
import { DiagramType, getType } from "./uml/diagramtype";

const REGEX_LINEENDING = /(.*\S+)(\s*)$/s;

export const UNKNOWN_DIAGRAM_TYPE = "Unable to determine diagram type";

export function autoFormatTxt(txt: string, rebuild = false): string {
  const crLf = _crLf(txt);
  const m = REGEX_LINEENDING.exec(txt);
  // auto formatting does not include the ending - add it later
  let ending = "";
  if (m) {
    txt = m[1];
    ending = m[2];
    if (ending.length > 2) {
      ending = crLf;
    }
  }

  const lines = txt.split(crLf);
  const tpe = getType(lines);
  if (tpe == DiagramType.ClassComponent) {
    let formatted = new SortComponent(Component.fromString(lines))
      .autoFormat(rebuild)
      .toString(crLf);
    if (!formatted.endsWith(ending)) {
      formatted += ending;
    }
    return formatted;
  } else if (tpe == DiagramType.Sequence) {
    return (
      new SortSequence(Component.fromString(lines, true))
        .autoFormat()
        .toString(crLf) + ending
    );
  } else if (tpe == DiagramType.Unknown) {
    throw new Error(UNKNOWN_DIAGRAM_TYPE);
  } else {
    throw new Error("Unsupported diagram type: " + tpe.toString());
  }
}

function _crLf(txt: string): string {
  const idx = txt.indexOf("\n");
  if (idx != -1) {
    if (idx > 0 && txt.charAt(idx - 1) == "\r") {
      return "\r\n";
    }
    return "\n";
  }
  return "\r";
}
