import { assert } from "console";

export function mapReduce<T, U>(
  items: Iterable<T>,
  init: U,
  map: (item: T) => U,
  reduce: (accu: U, item: U) => U
): U {
  let accu = init;
  for (const it of items) {
    accu = reduce(accu, map(it));
  }
  return accu;
}

export function bestOfMap<T, U>(
  items: Iterable<T>,
  map: (item: T) => U,
  init: U,
  cmp: (left: U, right: U) => boolean
): T {
  const initVal: [T | undefined, U] = [undefined, init];
  const val = mapReduce<T, [T | undefined, U]>(
    items,
    initVal,
    (item: T) => {
      return [item, map(item)];
    },
    (accu: [T | undefined, U], item: [T | undefined, U]) => {
      return cmp(item[1], accu[1]) ? item : accu;
    }
  )[0];
  // if we get here either the items were empty
  // or the init value did not use the "least best" = worst value.
  assert(val);
  return val as T;
}

export function bestOf<T>(
  items: Iterable<T>,
  init: T,
  cmp: (left: T, right: T) => boolean
): T {
  let accu = init;
  for (const it of items) {
    if (cmp(it, accu)) {
      accu = it;
    }
  }
  return accu;
}

export function maxOf<T, U>(
  items: Iterable<T>,
  init: U,
  map: (item: T) => U
): T {
  return bestOfMap<T, U>(items, map, init, (left, right) => left > right);
}
