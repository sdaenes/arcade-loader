/**
 * 3D Bin Packing Optimizer — Arcade Cabinets
 * Strategy: multi-pass FFD with full extreme-point grid + global retry
 */

function applyMargin(truck, marginPercent) {
  const f = 1 - marginPercent / 100;
  return {
    ...truck,
    usableWidth:  truck.width  * f,
    usableHeight: truck.height * f,
    usableDepth:  truck.depth  * f,
  };
}

function getRotations(cabinet) {
  const { width: w, height: h, depth: d } = cabinet;
  const rots = [
    { width: w, height: h, depth: d, rotation: 0 },
    { width: d, height: h, depth: w, rotation: 90 },
  ];
  if (cabinet.canTilt) {
    rots.push(
      { width: w, height: d, depth: h, rotation: 'tilt_front' },
      { width: h, height: d, depth: w, rotation: 'tilt_side' }
    );
  }
  return rots;
}

function fitsInTruck(pos, box, truck) {
  return (
    pos.x + box.width  <= truck.usableWidth  + 0.001 &&
    pos.y + box.height <= truck.usableHeight + 0.001 &&
    pos.z + box.depth  <= truck.usableDepth  + 0.001
  );
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.width  - 0.001 && a.x + a.width  > b.x + 0.001 &&
    a.y < b.y + b.height - 0.001 && a.y + a.height > b.y + 0.001 &&
    a.z < b.z + b.depth  - 0.001 && a.z + a.depth  > b.z + 0.001
  );
}

/**
 * Project a candidate position down (gravity) so the item rests on the floor
 * or on top of already-placed items.
 */
function projectDown(pos, box, placed) {
  let lowestY = 0;
  for (const p of placed) {
    const xOk = pos.x < p.x + p.width  - 0.001 && pos.x + box.width  > p.x + 0.001;
    const zOk = pos.z < p.z + p.depth  - 0.001 && pos.z + box.depth  > p.z + 0.001;
    if (xOk && zOk) lowestY = Math.max(lowestY, p.y + p.height);
  }
  return { ...pos, y: lowestY };
}

/**
 * Generate a dense set of candidate (x, y=0, z) positions using the full
 * cross-product of all x-edges × z-edges from placed items.
 * This avoids the gaps produced by only using single-face extreme points.
 */
function getCandidatePoints(placed, truck) {
  const EPS = 0.001;

  const xs = new Set([0]);
  const zs = new Set([0]);

  for (const p of placed) {
    const rx = p.x + p.width;
    const rz = p.z + p.depth;
    if (rx < truck.usableWidth  - EPS) xs.add(rx);
    if (rz < truck.usableDepth  - EPS) zs.add(rz);
    // Also include the left/front edges to catch gaps behind items
    if (p.x > EPS) xs.add(p.x);
    if (p.z > EPS) zs.add(p.z);
  }

  const points = [];
  for (const x of xs) {
    for (const z of zs) {
      if (x < truck.usableWidth - EPS && z < truck.usableDepth - EPS) {
        points.push({ x, y: 0, z });
      }
    }
  }
  return points;
}

/**
 * Try to place one cabinet in a truck.
 * Tests all rotations × all candidate positions, picks the best scoring one.
 */
function tryPlace(cabinet, placed, truck) {
  const rotations = getRotations(cabinet);
  const candidates = getCandidatePoints(placed, truck);

  // Sort candidates: prefer low z (fill front first), then low x, then low y
  candidates.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);

  let best = null;
  let bestScore = Infinity;

  for (const rot of rotations) {
    for (const pt of candidates) {
      const pos = projectDown(pt, rot, placed);
      const candidate = { ...pos, ...rot };

      if (!fitsInTruck(candidate, rot, truck)) continue;
      if (placed.some((p) => overlaps(candidate, p))) continue;

      // Score: penalise height heavily (keep items on floor), then z, then x
      const score = pos.y * 10000 + pos.z * 100 + pos.x;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  if (!best) return null;

  return {
    cabinetId:     cabinet.id,
    cabinetName:   cabinet.name,
    x: best.x, y: best.y, z: best.z,
    width: best.width, height: best.height, depth: best.depth,
    rotation:      best.rotation,
    originalWidth:  cabinet.width,
    originalHeight: cabinet.height,
    originalDepth:  cabinet.depth,
    color:         cabinet.color,
    unitIndex:     cabinet.unitIndex,
  };
}

/**
 * Pack a list of cabinet units into one truck using a given sort order.
 */
function packTruck(units, truck) {
  const placed = [];
  const unplaced = [];

  for (const cabinet of units) {
    const p = tryPlace(cabinet, placed, truck);
    if (p) placed.push(p);
    else unplaced.push(cabinet);
  }

  return { placements: placed, unplaced };
}

/**
 * Try packing with several sort strategies and return the best result
 * (most items placed).
 */
const SORT_STRATEGIES = [
  // Largest volume first (classic FFD)
  (a, b) => b.width * b.height * b.depth - a.width * a.height * a.depth,
  // Largest floor footprint first
  (a, b) => b.width * b.depth - a.width * a.depth,
  // Tallest first
  (a, b) => b.height - a.height || b.width * b.depth - a.width * a.depth,
  // Widest first
  (a, b) => Math.max(b.width, b.depth) - Math.max(a.width, a.depth),
  // Thinnest first (try fitting awkward narrow items early)
  (a, b) => Math.min(a.width, a.depth) - Math.min(b.width, b.depth),
];

function bestPackTruck(units, truck) {
  let best = { placements: [], unplaced: [...units] };

  for (const sortFn of SORT_STRATEGIES) {
    const sorted = [...units].sort(sortFn);
    const result = packTruck(sorted, truck);
    if (result.placements.length > best.placements.length) {
      best = result;
    }
    if (best.unplaced.length === 0) break; // perfect fill, stop early
  }

  return best;
}

function expandCabinets(cabinets) {
  const expanded = [];
  for (const cab of cabinets) {
    const qty = cab.quantity || 1;
    for (let i = 0; i < qty; i++) {
      expanded.push({ ...cab, unitIndex: i + 1, id: `${cab.id}_${i + 1}` });
    }
  }
  return expanded;
}

function buildTruckResult(truck, placements) {
  const usedVolume = placements.reduce((s, p) => s + p.width * p.height * p.depth, 0);
  const totalVolume = truck.usableWidth * truck.usableHeight * truck.usableDepth;
  return {
    truckId:      truck.id,
    truckName:    truck.name,
    placements,
    cabinetCount: placements.length,
    usedVolume:   Math.round(usedVolume * 1000) / 1000,
    totalVolume:  Math.round(totalVolume * 1000) / 1000,
    fillRate:     Math.round((usedVolume / totalVolume) * 1000) / 10,
    dimensions: {
      width:         truck.usableWidth,
      height:        truck.usableHeight,
      depth:         truck.usableDepth,
      originalWidth:  truck.width,
      originalHeight: truck.height,
      originalDepth:  truck.depth,
    },
  };
}

/**
 * Main optimizer.
 *
 * Phase 1 — greedy multi-strategy fill: trucks are filled one by one, each
 *            time testing all sort strategies and keeping the best.
 *
 * Phase 2 — global retry: remaining unplaced items are tested against ALL
 *            trucks (including already-started ones) to fill in gaps.
 *
 * Phase 3 — balance pass: if some trucks are very uneven, try moving items
 *            from the last truck to gaps in earlier trucks.
 */
function optimizeLoading(cabinets, trucks, errorMargin = 5) {
  const allUnits = expandCabinets(cabinets);
  const trucksM  = trucks.map((t) => applyMargin(t, errorMargin));

  // ── Phase 1: greedy fill ────────────────────────────────────────────────
  const truckPlacements = trucksM.map(() => []); // per-truck placements
  let remaining = [...allUnits];

  for (let i = 0; i < trucksM.length; i++) {
    if (remaining.length === 0) break;
    const { placements, unplaced } = bestPackTruck(remaining, trucksM[i]);
    truckPlacements[i] = placements;
    remaining = unplaced;
  }

  // ── Phase 2: global retry — try fitting leftovers into any truck's gaps ─
  if (remaining.length > 0) {
    const stillLeft = [];
    for (const unit of remaining) {
      let placed = false;
      for (let i = 0; i < trucksM.length; i++) {
        const p = tryPlace(unit, truckPlacements[i], trucksM[i]);
        if (p) {
          truckPlacements[i].push(p);
          placed = true;
          break;
        }
      }
      if (!placed) stillLeft.push(unit);
    }
    remaining = stillLeft;
  }

  // ── Phase 3: balance pass — try moving items from last used truck to
  //             gaps in earlier trucks to consolidate loads ────────────────
  for (let src = trucksM.length - 1; src > 0; src--) {
    if (truckPlacements[src].length === 0) continue;
    const moved = [];
    const stayInSrc = [];

    for (const item of truckPlacements[src]) {
      let fitsEarlier = false;
      for (let dst = 0; dst < src; dst++) {
        // Temporarily remove this item from src to try dst
        const p = tryPlace(item, truckPlacements[dst], trucksM[dst]);
        if (p) {
          truckPlacements[dst].push(p);
          moved.push(item);
          fitsEarlier = true;
          break;
        }
      }
      if (!fitsEarlier) stayInSrc.push(item);
    }

    // Only accept the balance move if it results in fewer trucks used overall
    const srcEmpty = stayInSrc.length === 0;
    if (srcEmpty) {
      truckPlacements[src] = [];
    } else {
      // Rollback dst additions for items we moved but src isn't empty
      // (partial moves don't save a truck — revert)
      for (let dst = 0; dst < src; dst++) {
        truckPlacements[dst] = truckPlacements[dst].filter(
          (p) => !moved.some((m) => m.id === p.cabinetId && m.unitIndex === p.unitIndex)
        );
      }
    }
  }

  // ── Build results ───────────────────────────────────────────────────────
  const truckResults = trucksM.map((truck, i) =>
    buildTruckResult(truck, truckPlacements[i])
  );

  const placedCount = truckResults.reduce((s, t) => s + t.cabinetCount, 0);
  const success = remaining.length === 0;

  const summary = {
    success,
    totalCabinets:    allUnits.length,
    placedCabinets:   placedCount,
    unplacedCabinets: remaining.length,
    unplacedList:     remaining.map((c) => ({ id: c.id, name: c.name, unitIndex: c.unitIndex })),
    errorMargin,
    trucksUsed:  truckResults.filter((t) => t.cabinetCount > 0).length,
    totalTrucks: trucks.length,
    trucks:      truckResults,
    tips: [],
  };

  if (!success) {
    summary.tips.push(`⚠️ ${remaining.length} borne(s) n'ont pas pu être placées. Réduisez la marge d'erreur ou ajoutez un camion.`);
  }
  if (errorMargin > 15) {
    summary.tips.push(`💡 Marge d'erreur élevée (${errorMargin}%). Réduire à 5-10% pour un meilleur remplissage.`);
  }
  const activeTrucks = truckResults.filter((t) => t.cabinetCount > 0);
  const avgFill = activeTrucks.reduce((s, t) => s + t.fillRate, 0) / (activeTrucks.length || 1);
  if (avgFill < 50 && success) {
    summary.tips.push(`📦 Taux de remplissage moyen de ${Math.round(avgFill)}% — vous pourriez réduire le nombre de camions.`);
  }

  return summary;
}

module.exports = { optimizeLoading };
