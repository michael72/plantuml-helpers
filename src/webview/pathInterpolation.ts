/* global document */
interface PathPoint {
  x: number;
  y: number;
  t: number; // Position along path (0-1)
}

function samplePath(d: string, numSamples: number): PathPoint[] {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);

  const totalLength = path.getTotalLength();
  const points: PathPoint[] = [];

  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    const point = path.getPointAtLength(t * totalLength);
    points.push({ x: point.x, y: point.y, t });
  }

  return points;
}

// Find best rotation offset to minimize total movement
function findBestAlignment(
  fromPoints: PathPoint[],
  toPoints: PathPoint[]
): number {
  const n = fromPoints.length;
  let bestOffset = 0;
  let bestDistance = Infinity;

  // Try different starting point offsets
  for (let offset = 0; offset < n; offset++) {
    let totalDist = 0;
    for (let i = 0; i < n; i++) {
      const from = fromPoints[i];
      const to = toPoints[(i + offset) % n];
      if (from && to) totalDist += Math.hypot(to.x - from.x, to.y - from.y);
    }
    if (totalDist < bestDistance) {
      bestDistance = totalDist;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

export function createPathInterpolator(
  fromPath: string,
  toPath: string,
  options: { samples?: number; align?: boolean } = {}
): (t: number) => string {
  const { samples = 64, align = true } = options;

  const fromPoints = samplePath(fromPath, samples);
  let toPoints = samplePath(toPath, samples);

  // Optimize starting point alignment for closed paths
  if (align && fromPath.includes("Z") && toPath.includes("Z")) {
    const offset = findBestAlignment(fromPoints, toPoints);
    if (offset > 0) {
      toPoints = [...toPoints.slice(offset), ...toPoints.slice(0, offset)];
    }
  }

  const fromClosed = fromPath.toUpperCase().includes("Z");
  const toClosed = toPath.toUpperCase().includes("Z");

  return (t: number): string => {
    const points: [number, number][] = fromPoints.map((from, i) => {
      const to = toPoints[i];
      if (to) {
        return [from.x + ((to.x - from.x) * t), from.y + ((to.y - from.y) * t)];
      } else return [0, 0];
    });

    // Interpolate closed state
    const closed = t < 0.5 ? fromClosed : toClosed;
    return pointsToPath(points, closed);
  };

  function pointsToPath(
    points: [number, number][],
    closed: boolean = true
  ): string {
    if (points.length === 0) return "";

    const [first, ...rest] = points;
    if (first) {
      let d = `M${first[0]},${first[1]}`;

      for (const [x, y] of rest) {
        d += ` L${x},${y}`;
      }

      if (closed) d += " Z";
      return d;
    } else return "";
  }
}
