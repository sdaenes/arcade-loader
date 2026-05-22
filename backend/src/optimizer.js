/**
 * 3D Bin Packing Optimizer for Arcade Cabinets
 * Uses a First Fit Decreasing (FFD) heuristic with rotation support
 * and an extreme points placement strategy.
 */

/**
 * Apply error margin to truck dimensions (shrink usable space)
 */
function applyMargin(truck, marginPercent) {
  const factor = 1 - marginPercent / 100;
  return {
    ...truck,
    usableWidth: truck.width * factor,
    usableHeight: truck.height * factor,
    usableDepth: truck.depth * factor,
    usableVolume: truck.width * truck.depth * truck.height * factor * factor * factor,
  };
}

/**
 * Get all valid rotations of a cabinet
 * For arcade cabinets, we limit rotations to keep them upright (no flipping on side unless specified)
 * Rotations: original, rotated 90° on horizontal plane
 */
function getRotations(cabinet) {
  const { width: w, height: h, depth: d } = cabinet;
  // Keep cabinet upright (height stays height), rotate on horizontal plane only
  const rotations = [
    { width: w, height: h, depth: d, rotation: 0 },
    { width: d, height: h, depth: w, rotation: 90 },
  ];
  // Optionally allow laying on side if canTilt is true
  if (cabinet.canTilt) {
    rotations.push(
      { width: w, height: d, depth: h, rotation: 'tilt_front' },
      { width: h, height: d, depth: w, rotation: 'tilt_side' }
    );
  }
  return rotations;
}

/**
 * Check if a box fits at a given position within truck bounds
 */
function fitsInTruck(pos, box, truck) {
  return (
    pos.x + box.width <= truck.usableWidth + 0.001 &&
    pos.y + box.height <= truck.usableHeight + 0.001 &&
    pos.z + box.depth <= truck.usableDepth + 0.001
  );
}

/**
 * Check if two boxes (with positions) overlap
 */
function overlaps(a, b) {
  return (
    a.x < b.x + b.width - 0.001 &&
    a.x + a.width > b.x + 0.001 &&
    a.y < b.y + b.height - 0.001 &&
    a.y + a.height > b.y + 0.001 &&
    a.z < b.z + b.depth - 0.001 &&
    a.z + a.depth > b.z + 0.001
  );
}

/**
 * Generate extreme points for next placement based on placed items
 * Extreme points are candidate corners generated from placed box edges
 */
function getExtremePoints(placed, truck) {
  const points = [{ x: 0, y: 0, z: 0 }];

  for (const p of placed) {
    // Generate 3 candidate points at each box face
    points.push({ x: p.x + p.width, y: p.y, z: p.z });
    points.push({ x: p.x, y: p.y + p.height, z: p.z });
    points.push({ x: p.x, y: p.y, z: p.z + p.depth });
  }

  // Filter to only points within truck bounds
  return points.filter(
    (pt) =>
      pt.x < truck.usableWidth - 0.001 &&
      pt.y < truck.usableHeight - 0.001 &&
      pt.z < truck.usableDepth - 0.001
  );
}

/**
 * Project a point to the lowest valid position (gravity simulation)
 * Items fall to y=0 or rest on top of other items
 */
function projectDown(pos, box, placed) {
  let lowestY = 0;
  for (const p of placed) {
    // Check horizontal overlap
    const xOverlap = pos.x < p.x + p.width - 0.001 && pos.x + box.width > p.x + 0.001;
    const zOverlap = pos.z < p.z + p.depth - 0.001 && pos.z + box.depth > p.z + 0.001;
    if (xOverlap && zOverlap) {
      lowestY = Math.max(lowestY, p.y + p.height);
    }
  }
  return { ...pos, y: lowestY };
}

/**
 * Try to place a cabinet (with all rotations) into a truck
 * Returns placement info or null
 */
function tryPlace(cabinet, placed, truck) {
  const rotations = getRotations(cabinet);
  const extremePoints = getExtremePoints(placed, truck);

  // Sort points: front-left-bottom first (z, x, y priority)
  extremePoints.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);

  let bestPlacement = null;
  let bestScore = Infinity;

  for (const rot of rotations) {
    for (const pt of extremePoints) {
      const pos = projectDown(pt, rot, placed);
      const candidate = { ...pos, ...rot };

      if (!fitsInTruck(candidate, rot, truck)) continue;

      const hasOverlap = placed.some((p) => overlaps(candidate, p));
      if (hasOverlap) continue;

      // Score: prefer lower y (stable), then lower z (fill front first), then lower x
      const score = pos.y * 1000 + pos.z * 10 + pos.x;
      if (score < bestScore) {
        bestScore = score;
        bestPlacement = {
          cabinetId: cabinet.id,
          cabinetName: cabinet.name,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          width: rot.width,
          height: rot.height,
          depth: rot.depth,
          rotation: rot.rotation,
          originalWidth: cabinet.width,
          originalHeight: cabinet.height,
          originalDepth: cabinet.depth,
          color: cabinet.color,
          quantity: cabinet.quantity,
          unitIndex: cabinet.unitIndex,
        };
      }
    }
  }

  return bestPlacement;
}

/**
 * Pack a list of cabinets into a single truck
 * Returns { placements, unplaced }
 */
function packTruck(cabinets, truck) {
  const placed = [];
  const unplaced = [];

  // Sort by volume descending (largest first) for better packing
  const sorted = [...cabinets].sort(
    (a, b) => b.width * b.height * b.depth - a.width * a.height * a.depth
  );

  for (const cabinet of sorted) {
    const placement = tryPlace(cabinet, placed, truck);
    if (placement) {
      placed.push(placement);
    } else {
      unplaced.push(cabinet);
    }
  }

  return { placements: placed, unplaced };
}

/**
 * Expand cabinets by quantity into individual units
 */
function expandCabinets(cabinets) {
  const expanded = [];
  for (const cab of cabinets) {
    const qty = cab.quantity || 1;
    for (let i = 0; i < qty; i++) {
      expanded.push({
        ...cab,
        unitIndex: i + 1,
        id: `${cab.id}_${i + 1}`,
        instanceId: `${cab.id}_${i + 1}`,
      });
    }
  }
  return expanded;
}

/**
 * Main optimizer: distribute cabinets across multiple trucks
 * Strategy: First Fit Decreasing across trucks
 */
function optimizeLoading(cabinets, trucks, errorMargin = 5) {
  // Expand quantities
  const allUnits = expandCabinets(cabinets);
  
  // Apply margin to all trucks
  const trucksWithMargin = trucks.map((t) => applyMargin(t, errorMargin));

  // Try to pack everything into available trucks
  // Strategy: fill trucks one by one (greedy)
  const truckResults = [];
  let remaining = [...allUnits];

  for (let i = 0; i < trucksWithMargin.length; i++) {
    const truck = trucksWithMargin[i];
    const { placements, unplaced } = packTruck(remaining, truck);
    
    const usedVolume = placements.reduce((sum, p) => sum + p.width * p.height * p.depth, 0);
    const totalVolume = truck.usableWidth * truck.usableHeight * truck.usableDepth;
    
    truckResults.push({
      truckId: truck.id,
      truckName: truck.name,
      placements,
      usedVolume: Math.round(usedVolume * 1000) / 1000,
      totalVolume: Math.round(totalVolume * 1000) / 1000,
      fillRate: Math.round((usedVolume / totalVolume) * 100 * 10) / 10,
      cabinetCount: placements.length,
      dimensions: {
        width: truck.usableWidth,
        height: truck.usableHeight,
        depth: truck.usableDepth,
        originalWidth: truck.width,
        originalHeight: truck.height,
        originalDepth: truck.depth,
      },
    });

    remaining = unplaced;
    if (remaining.length === 0) break;
  }

  const totalCabinets = allUnits.length;
  const placedCount = totalCabinets - remaining.length;
  const success = remaining.length === 0;

  // Build summary
  const summary = {
    success,
    totalCabinets,
    placedCabinets: placedCount,
    unplacedCabinets: remaining.length,
    unplacedList: remaining.map((c) => ({ id: c.id, name: c.name, unitIndex: c.unitIndex })),
    errorMargin,
    trucksUsed: truckResults.filter((t) => t.cabinetCount > 0).length,
    totalTrucks: trucks.length,
    trucks: truckResults,
    tips: [],
  };

  // Generate tips
  if (!success) {
    summary.tips.push(`⚠️ ${remaining.length} borne(s) n'ont pas pu être placées. Réduisez la marge d'erreur ou ajoutez un camion.`);
  }
  if (errorMargin > 15) {
    summary.tips.push(`💡 Marge d'erreur élevée (${errorMargin}%). Réduire à 5-10% pour un meilleur remplissage.`);
  }
  const avgFill = truckResults.reduce((s, t) => s + t.fillRate, 0) / (truckResults.length || 1);
  if (avgFill < 50 && success) {
    summary.tips.push(`📦 Taux de remplissage moyen de ${Math.round(avgFill)}% — vous pourriez réduire le nombre de camions.`);
  }

  return summary;
}

module.exports = { optimizeLoading };
