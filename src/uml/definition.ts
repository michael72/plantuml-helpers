import { Attachable } from "./attachable.js";
import {
  REGEX_INTERFACE,
  REGEX_CLASS,
  REGEX_COMPONENT,
  REGEX_SEQUENCE,
} from "./diagramtype.js";
import { Line } from "./line.js";

export type Content = Line | Definition;

export function toString(content: Array<Content>, lf: string): string {
  return content
    .map((s: Content) => {
      return s.toString();
    })
    .join(lf);
}

export function joinContent(
  left: string,
  right: string,
  lf: string,
  addSection = true
): string {
  const addLf = addSection
    ? lf +
      (left.endsWith(lf) ||
      left.endsWith("\n") ||
      right.startsWith(lf) ||
      right.startsWith("\n")
        ? ""
        : lf)
    : lf;
  return left + (left.length > 0 && right.length > 0 ? addLf : "") + right;
}

export class Definition extends Attachable {
  constructor(
    public type: string,
    public name: string,
    public alias?: string
  ) {
    super();
  }
  static fromString(line: string): Definition | undefined {
    const shorten = (s: string, by: string): string => {
      if (s.length > 0 && s[0] === by) {
        return s.substring(1, s.length - 1);
      }
      return s;
    };
    let m = REGEX_INTERFACE.exec(line);
    // check interface definition
    if (m) {
      const name = m[2];
      if (name != null && name.length > 0) {
        return new this("interface", shorten(name, '"'), m[3]);
      }
    } else {
      // check for component
      m = REGEX_COMPONENT.exec(line);
      if (
        m &&
        (m[1] != null || (m[2] != null && m[2].length > 0 && m[2][0] === "["))
      ) {
        const name = m[2];
        if (name != null && name.length > 0) {
          return new this("component", shorten(name, "["), m[3]);
        }
      } else {
        m = REGEX_CLASS.exec(line) ?? REGEX_SEQUENCE.exec(line);

        if (m) {
          const type = m[1];
          const name = m[2];
          if (
            type != null &&
            type.length > 0 &&
            name != null &&
            name.length > 0
          ) {
            return new this(type, shorten(name, '"'), m[3]);
          }
        }
      }
    }
    return;
  }

  isComponent(): boolean {
    return this.type === "component";
  }

  override toString(): string {
    const comp = `${this.type} ${this.name}`;
    const content =
      this.alias != null && this.alias.length > 0
        ? comp + " as " + this.alias
        : comp;
    return content + this.attachedToString();
  }

  removeAlias(): Definition {
    return new Definition(this.type, this.name);
  }
}
