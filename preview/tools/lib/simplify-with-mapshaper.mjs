import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

function countGeometryVertices(geometry) {
  if (!geometry) return 0;
  if (geometry.type === "Polygon") {
    return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.reduce(
      (sum, polygon) => sum + polygon.reduce((ringSum, ring) => ringSum + ring.length, 0),
      0
    );
  }
  return 0;
}

export function countFeatureVertices(featureCollection) {
  return (featureCollection.features || []).reduce(
    (sum, feature) => sum + countGeometryVertices(feature.geometry),
    0
  );
}

export async function simplifyFeatureCollectionWithMapshaper(featureCollection, options = {}) {
  const {
    interval = "60m",
    weighting = 0.7,
    minIslandArea = "1500m2",
    minSliverArea = "1500m2",
    sliverControl = 0.8
  } = options;

  const tempDir = await mkdtemp(path.join(tmpdir(), "geoquiz-mapshaper-"));
  const inputPath = path.join(tempDir, "input.geojson");
  const outputPath = path.join(tempDir, "output.geojson");
  const mapshaperBin = path.resolve("node_modules", "mapshaper", "bin", "mapshaper");

  try {
    await writeFile(inputPath, JSON.stringify(featureCollection), "utf8");
    await execFile(
      process.execPath,
      [
        mapshaperBin,
        inputPath,
        "-simplify",
        "weighted",
        `interval=${interval}`,
        `weighting=${weighting}`,
        "keep-shapes",
        "-filter-islands",
        `min-area=${minIslandArea}`,
        "remove-empty",
        "-filter-slivers",
        `min-area=${minSliverArea}`,
        `sliver-control=${sliverControl}`,
        "remove-empty",
        "-clean",
        "-o",
        "format=geojson",
        outputPath
      ],
      { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 20 }
    );

    return JSON.parse(await readFile(outputPath, "utf8"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
