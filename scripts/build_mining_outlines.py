#!/usr/bin/env python3
"""Build outline-only regional mining disturbance polygons from Earth Genome's public raster.

These polygons are model-derived mining-scar context, NOT legally verified illegal-mining sites.
They are purposely generalized for a web map. The underlying raster remains the authoritative
source for detailed work. No year is assigned from downsampled overview values.
"""
import json
import os
import shutil
import urllib.request
import tempfile

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import shapes
from rasterio.transform import from_bounds
from rasterio.windows import from_bounds as window_from_bounds
from scipy.ndimage import binary_closing, binary_opening, label
from shapely.geometry import shape, mapping

SOURCE = "https://data.source.coop/earthgenome/amazon-mining-watch/amazon_basin_mining_scar_masks.tif"
BBOX = (-71.08, -13.43, -69.04, -12.03)  # selected southeastern Peru research region
HEIGHT, WIDTH = 4000, 5800
OUTPUT = "data/madre_de_dios_mining_scar_outlines.geojson"


def build(path):
    with rasterio.open(path) as src:
        window = window_from_bounds(*BBOX, transform=src.transform).round_offsets().round_lengths()
        # The source COG overviews average time codes; treat display samples as occupancy,
        # not years. Threshold ~1000 excludes barely covered display pixels.
        raster = src.read(1, window=window, out_shape=(HEIGHT, WIDTH), resampling=Resampling.nearest)
    mask = raster >= 1000
    mask = binary_closing(mask, iterations=1)
    mask = binary_opening(mask, iterations=1)
    labels, n = label(mask)
    counts = np.bincount(labels.ravel())
    keep = counts >= 14
    keep[0] = False
    mask = keep[labels]

    affine = from_bounds(*BBOX, width=WIDTH, height=HEIGHT)
    polygons = []
    for geometry, value in shapes(mask.astype("uint8"), mask=mask, transform=affine):
        if value != 1:
            continue
        geom = shape(geometry).simplify(0.00022, preserve_topology=True)
        if geom.area < 1.3e-6:
            continue
        polygons.append(geom)
    polygons.sort(key=lambda polygon: polygon.area, reverse=True)

    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "name": "Madre de Dios mining-disturbance outlines, regional generalized display",
            "source": "Earth Genome / Amazon Mining Watch",
            "source_url": "https://source.coop/earthgenome/amazon-mining-watch",
            "raster": "amazon_basin_mining_scar_masks.tif",
            "method": "Generalized extraction at approximately 40m raster sampling; small detached patches omitted.",
            "meaning": "Model-detected mining disturbance, NOT verified illegal mining boundaries.",
            "legal_status": "unknown",
            "year": "Not attributed. Dataset includes provisional recent mining detections.",
            "bbox": list(BBOX),
        },
        "features": [
            {"type": "Feature",
             "properties": {"id": i+1, "legal_status": "unknown", "type": "model_detected_mining_disturbance"},
             "geometry": mapping(poly)}
            for i, poly in enumerate(polygons)
        ]
    }
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(collection, fh, separators=(",", ":"))
    print(f"Created {OUTPUT}: {len(polygons)} outlines, {os.path.getsize(OUTPUT)} bytes.")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as directory:
        tif_path = os.path.join(directory, "amazon_basin_mining_scar_masks.tif")
        with urllib.request.urlopen(SOURCE, timeout=240) as response, open(tif_path, "wb") as dst:
            shutil.copyfileobj(response, dst)
        build(tif_path)
