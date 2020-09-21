import { DefaultMap } from "./helpers";
// sorting of sequences can only swap the definitions.
// I can _not_ however change the order of lines with arrows
// and also _not_ the direction of the arrows!

import { Component } from "./uml/component";
import { Content, Definition } from "./uml/definition";
import { Line } from "./uml/line";

export class SortSequence {
  constructor(private component: Component) {}
  autoFormat(): Component {
    this._reformat();
    return this.component;
  }

  private _hasKey(c: Content, key: string): boolean {
    if (c instanceof Line) {
      return c.components[0] === key || c.components[1] === key;
    }
    if (c instanceof Definition) {
      return c.name === key;
    }
    return false;
  }

  private _reformat(): void {
    const ordered = this._findMostDeps();

    // finally: bring the items in `this.component` in order
    // the ordering shall be done as in `ordered`
    // bring the definitions (if necessary) to the front
    const newContent = new Array<Content>();

    for (const key of ordered) {
      const contained = newContent.some((c: Content) => {
        return this._hasKey(c, key);
      });

      if (!contained) {
        const first = this.component.content[0];
        if (this._hasKey(first, key) || typeof first === "string") {
          newContent.push(this.component.content.splice(0, 1)[0]);
        } else {
          newContent.push(new Definition("participant", key));
        }
      }
    }
    // set the ordered content
    this.component.content = newContent.concat(this.component.content);
  }

  private _toKey(s: [string, string]): string {
    return s[0] + "," + s[1];
  }

  private _toTup(s: string): [string, string] {
    const arr = s.split(",");
    return [arr[0], arr[1]];
  }

  private _findMostDeps(): Array<string> {
    const [depCount, totalCount, items] = this._getCounts();
    const ordered = this._strongestConnected(depCount, totalCount);
    const remaining = new Set<string>(
      items.filter((key: string) => {
        return ordered.indexOf(key) == -1;
      })
    );

    // find the tuple with the most dependencies
    const bestTup = ["", ""];
    const maxDeps = [0, 0];
    // 1-2 elements are removed per loop
    while (remaining.size > 0) {
      for (const r of remaining) {
        let left = 0;
        let right = 0;
        for (const i of ordered) {
          left += depCount.getDef(this._toKey([r, i]));
          right += depCount.getDef(this._toKey([i, r]));
        }
        if (left > maxDeps[0] && left > right) {
          maxDeps[0] = left;
          bestTup[0] = r;
        } else if (right > maxDeps[0] && right > left) {
          maxDeps[1] = right;
          bestTup[1] = r;
        }
      }
      if (bestTup[0]) {
        // insert at the beginning
        ordered.splice(0, 0, bestTup[0]);
        remaining.delete(bestTup[0]);
      }
      if (bestTup[1]) {
        ordered.push(bestTup[1]);
        remaining.delete(bestTup[1]);
      }
      if (!(bestTup[0] || bestTup[1])) {
        // elements are disjoint
        // add the element with the most outgoing dependencies to the right
        let best = "";
        let bestVal = -1;
        for (const r1 of remaining) {
          let deps = 0;
          for (const r2 of remaining) {
            if (r1 !== r2) {
              deps += depCount.getDef(this._toKey([r1, r2]));
            }
          }
          if (deps > bestVal) {
            best = r1;
            bestVal = deps;
          }
        }
        ordered.push(best);
        remaining.delete(best);
      }
    }
    return ordered;
  }

  private _getCounts(): [
    DefaultMap<string, number>,
    DefaultMap<string, number>,
    Array<string>
  ] {
    const depCount = new DefaultMap<string, number>(() => 0);
    const totalCount = new DefaultMap<string, number>(() => 0);

    const items = new Array<string>();
    this.component.content = this.component.content.filter((c: Content) => {
      return !(c instanceof Definition && c.type === "participant");
    });

    for (const content of this.component.content) {
      if (content instanceof Definition) {
        items.push(content.name);
      } else if (content instanceof Line) {
        for (const item of content.components) {
          if (!items.includes(item)) {
            items.push(item);
          }
        }
        const [from, to] = content.components;
        const key = this._toKey([from, to]);
        depCount.set(key, depCount.getDef(key) + 1);
        totalCount.set(from, totalCount.getDef(from) + 1);
        totalCount.set(to, totalCount.getDef(to) + 1);
      } else {
        // ignore
      }
    }
    return [depCount, totalCount, items];
  }

  private _strongestConnected(
    depCount: DefaultMap<string, number>,
    totalCount: DefaultMap<string, number>
  ): Array<string> {
    let bestTup = ["", ""];
    let bestNumFrom = 0;
    let bestNum = 0;
    for (const [tup, num] of depCount.entries()) {
      const from = tup[1];
      if (
        num > bestNum ||
        (num == bestNum && bestNumFrom < totalCount.getDef(from))
      ) {
        bestNum = num;
        bestTup = this._toTup(tup);
        bestNumFrom = totalCount.getDef(from);
      }
    }
    return bestTup;
  }
}
