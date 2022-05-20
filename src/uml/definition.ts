import { Attachable } from "./attachable";
import {
  REGEX_INTERFACE,
  REGEX_CLASS,
  REGEX_COMPONENT,
  REGEX_SEQUENCE,
} from "./diagramtype";
import { Line } from "./line";

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
  constructor(public type: string, public name: string, public alias?: string) {
    super();
  }
  static fromString(line: string): Definition | undefined {
    const shorten = (s: string, by: string): string => {
      if (s[0] === by) {
        return s.substring(1, s.length - 1);
      }
      return s;
    };
    let m = REGEX_INTERFACE.exec(line);
    // check interface definition
    if (m) {
      return new this("interface", shorten(m[2], '"'), m[3]);
    } else {
      // check for component
      m = REGEX_COMPONENT.exec(line);
      if (m && (m[1] || m[2][0] === "[")) {
        return new this("component", shorten(m[2], "["), m[3]);
      } else {
        m = REGEX_CLASS.exec(line);
        if (!m) {
          m = REGEX_SEQUENCE.exec(line);
        }
        if (m) {
          return new this(m[1], shorten(m[2], '"'), m[3]);
        }
      }
    }
    return;
  }

  isComponent(): boolean {
    return this.type === "component";
  }

  toString(): string {
    const comp = `${this.type} ${this.name}`;
    const content =
      this.alias != null && this.alias ? comp + " as " + this.alias : comp;
    return content + this.attachedToString();
  }

  removeAlias(): Definition {
    return new Definition(this.type, this.name);
  }
}
