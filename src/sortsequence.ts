import { assert } from "console";
import { DefaultMap } from "./helpers";
import { bestOf, mapReduce, maxOf } from "./mapreduce";

import { Component } from "./uml/component";
import { Content, Definition } from "./uml/definition";
import { Line } from "./uml/line";

function _toKey(s: [string, string]): string {
  return s[0] + "," + s[1];
}

function _toTup(s: string): [string, string] {
  const arr = s.split(",");
  return [arr[0], arr[1]];
}

// The items with the most incoming dependencies should be on the right.
// The items with the most outgoing dependencies should be on the left.
// The strongest connected items should be neighbours.
// The items should be sorted by incoming/outgoing dependencies.
// The order of lines with arrows and the direction of the arrows cannot be changed!
// Sorting of sequences can only swap the definitions.

export class SortSequence {
  constructor(private component: Component) { }

  autoFormat(): Component {
    this._reformat();
    return this.component;
  }

  private _reformat(): void {
    // participant definitions define the order - they are automatically added if needed
    this.component.content = this._removeParticipants();
    const ordered = this._orderNames();

    const newContent = this._getOrderedContent(ordered);
    // set the ordered content
    this.component.content = newContent.concat(this.component.content);
  }

  private _removeParticipants() {
    return this.component.content.filter((c: Content) => {
      return !(c instanceof Definition && c.type === "participant");
    });
  }

  private _orderNames(): Array<string> {
    const [depCount, totalCount, names] = this._getCountsAndNames();
    // order the names (participants/actors) starting with the strongest connected pair
    const ordered = this._strongestConnected(depCount, totalCount);
    const remaining = new Set<string>(
      names.filter((n) => !ordered.includes(n) && n.length != 0)
    );

    // 1-2 elements per loop are moved from `remaining` to `ordered`
    let last_size = 0;
    while (remaining.size > 0 && last_size != remaining.size) {
      last_size = remaining.size;
      this._moveToOrdered(remaining, ordered, depCount);
    }
    return ordered.filter((c) =>
      c.length > 1 || (c.length == 1 && c[0] != "[" && c[0] != "]")
    );
  }

  private _getCountsAndNames(): [
    DefaultMap<string, number>,
    DefaultMap<string, number>,
    Array<string>
  ] {
    const depCount = new DefaultMap<string, number>(() => 0);
    const totalCount = new DefaultMap<string, number>(() => 0);
    const names = new Array<string>();

    for (const def of this.component.definitions()) {
      names.push(def.name);
    }
    for (const line of this.component.lines()) {
      this._addLineComponentsNames(line, names);
      this._updateLineStats(line, depCount, totalCount);
    }
    return [depCount, totalCount, names];
  }

  private _addLineComponentsNames(line: Line, names: string[]) {
    for (const item of line.components) {
      if (!names.includes(item)) {
        names.push(item);
      }
    }
  }

  private _updateLineStats(
    line: Line,
    depCount: DefaultMap<string, number>,
    totalCount: DefaultMap<string, number>
  ) {
    const [from, to] = line.components;
    const key = _toKey([from, to]);
    depCount.set(key, depCount.getDef(key) + 1);
    totalCount.set(from, totalCount.getDef(from) + 1);
    totalCount.set(to, totalCount.getDef(to) + 1);
  }

  private _strongestConnected(
    depCount: DefaultMap<string, number>,
    totalCount: DefaultMap<string, number>
  ): Array<string> {
    const getCount = (item: [string, number]) =>
      totalCount.getDef(_toTup(item[0])[0]);
    const best = bestOf(
      depCount.entries(),
      ["", 0],
      (left: [string, number], right: [string, number]) =>
        left[1] > right[1] ||
        (left[1] == right[1] && getCount(left) > getCount(right))
    );
    return _toTup(best[0]);
  }

  private _moveToOrdered(
    remaining: Set<string>,
    ordered: string[],
    depCount: DefaultMap<string, number>
  ) {
    // find the tuple in `remaining` with the most [outgoing, incoming] dependencies
    // related to the already `ordered` elements.
    const bestTup = this._findMostOutIn(ordered, remaining, depCount);
    // move the item with the most outgoing dependencies from remaining to the left of `ordered`
    let moved = this._moveKeyToLeft(bestTup[0], ordered, remaining);
    // move the item with the most incoming dependencies from `remaining` to the right of `ordered`
    moved = this._moveKeyToRight(bestTup[1], ordered, remaining) || moved;
    // if `remaining` and `ordered` were not connected (disjoint) then add a new sequence to `ordered`
    if (!moved) {
      assert(!bestTup[0] && !bestTup[1]);
      this._moveDisjoint(ordered, remaining, depCount);
    }
  }

  private _findMostOutIn(
    ordered: string[],
    remaining: Set<string>,
    depCount: DefaultMap<string, number>
  ) {
    const bestTup = ["", ""];
    const maxDeps = [0, 0];
    for (const r of remaining) {
      this._calcOutIn(ordered, depCount, r, maxDeps, bestTup);
    }
    return bestTup;
  }

  private _calcOutIn(
    ordered: string[],
    depCount: DefaultMap<string, number>,
    refKey: string,
    maxDeps: number[],
    bestTup: string[]
  ) {
    const outIn = this._sumOutIn(ordered, depCount, refKey);
    for (let i = 0; i < outIn.length; i++) {
      if (maxDeps[i] < outIn[i]) {
        maxDeps[i] = outIn[i];
        bestTup[i] = refKey;
        break;
      }
    }
  }

  private _sumOutIn(
    ordered: string[],
    depCount: DefaultMap<string, number>,
    refItem: string
  ): [number, number] {
    // sum all outgoing and incoming dependencies to the reference item `refItem`
    const sum = (connect: (k: string) => [string, string]) => {
      const countDeps = (c: string) =>
        depCount.getDef(_toKey(connect(c))
        );
      return mapReduce(ordered, 0, countDeps, (accu, i) => accu + i);
    };
    // connect refItem -> k = outgoing and k -> refItem = incoming dependencies of refItem
    return [sum((k) => [refItem, k]), sum((k) => [k, refItem])];
  }

  private _moveKeyToLeft(
    key: string,
    dest: string[],
    src: Set<string>
  ): boolean {
    // insert at the beginning
    if (key && src.delete(key)) {
      dest.splice(0, 0, key);
      return true;
    }
    return false;
  }

  private _moveKeyToRight(
    key: string,
    dest: string[],
    src: Set<string>
  ): boolean {
    // insert at the end
    if (key && src.delete(key)) {
      dest.push(key);
      return true;
    }
    return false;
  }

  private _moveDisjoint(
    ordered: string[],
    remaining: Set<string>,
    depCount: DefaultMap<string, number>
  ) {
    // elements are disjoint
    // get the element with the most outgoing dependencies and...
    const bestKey = maxOf(remaining, 0, (key) =>
      this._calcSumOfDepCounts(remaining, key, depCount)
    );
    // ... move it to the right of the ordered keys.
    // This is the start of the next sequence.
    this._moveKeyToRight(bestKey, ordered, remaining);
  }

  private _calcSumOfDepCounts(
    keySet: Set<string>,
    leftPart: string,
    depCount: DefaultMap<string, number>
  ) {
    return mapReduce(
      keySet,
      0,
      (rightPart: string) => depCount.getDef(_toKey([leftPart, rightPart])),
      (accu: number, count: number) => accu + count
    );
  }

  private _getOrderedContent(ordered: string[]) {
    // bring the names in `this.component` in the order as in `ordered`.
    // bring the definitions (if necessary) to the front
    const newContent = new Array<Content>();
    const unordered = new Array<string>();
    const defs = new Array<Definition>(...this.component.definitions());
    const defNames = defs.map((d: Definition) => {
      return d.name;
    });
    for (const c of this.component.content) {
      if (c instanceof Line) {
        for (const name of c.componentNames()) {
          if (!unordered.includes(name)) {
            unordered.push(name);
          }
        }
      }
      else if (c instanceof Definition) {
        if (!unordered.includes(c.name)) {
          unordered.push(c.name);
        }
      }
    }
    if (ordered.join(",") !== unordered.join(",")) {
      for (const o of ordered) {
        const idx = defNames.indexOf(o);
        if (idx === -1) {
          newContent.push(new Definition("participant", o));
        }
        else {
          newContent.push(this.component.content.splice(this.component.content.indexOf(defs[idx]), 1)[0]);
        }
      }
    }

    return newContent;
  }

}
