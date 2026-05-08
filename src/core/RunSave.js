// RunSave — Phase 4i
//
// localStorage-backed snapshot of an in-progress run so an accidental refresh
// (or browser crash, or "wait, I want to switch tabs") doesn't wipe out 20
// minutes of progress.
//
// Snapshot captures:
//   • everything in `run` that doesn't change mid-shot (cash, holeNumber,
//     items, ball, score, streak)
//   • the bag's owned clubs + active selection + total-use counters (so
//     Phoenix Iron's remaining swings survive a refresh)
//
// Snapshot does NOT capture mid-shot state:
//   • strokes count for the current hole
//   • ball physics position
//   • per-hole use counters (Cannon resets to 1/hole on restore)
//   • boss club lock
//
// Result: refreshing during a shot puts you back at the START of the
// current hole with full cash + items. You replay one hole at most.
//
// Save is cleared when:
//   • run completes (victory or bust)
//   • player quits via pause menu
//   • player starts a new run from the title screen

const KEY = 'wackygolf_save_v1';
const SCHEMA_VERSION = 1;

/** Write the current state to localStorage. Skipped if the run isn't actively
 *  being played (we don't want to overwrite a valid save with a hole-out
 *  transient state). */
export function save(run, bag) {
  if (!run || run.status !== 'playing') return;
  try {
    const data = {
      v: SCHEMA_VERSION,
      run: {
        cash: run.cash,
        holeNumber: run.holeNumber,
        items: run.items.slice(),
        ball: run.ball,
        totalScore: run.totalScore,
        holesPlayed: run.holesPlayed,
        birdieStreak: run.birdieStreak,
      },
      bag: {
        ownedIds: [...bag.ownedIds],
        activeId: bag.activeId,
        usesTotalLeft: Object.fromEntries(bag.usesTotalLeft),
      },
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (_) {
    // Quota / privacy mode — silently ignore.
  }
}

/** Read the saved snapshot if any, else null. */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== SCHEMA_VERSION) return null;
    return data;
  } catch (_) {
    return null;
  }
}

/** Forget the saved run. */
export function clear() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}

/** True if there's a resumable run on disk. */
export function has() {
  return load() !== null;
}

/**
 * Hydrate a Run + Bag from a snapshot. Caller is responsible for
 * subsequently calling loadCurrentHole({ restoring: true }) so the 3D
 * world matches the restored holeNumber.
 */
export function applyTo(run, bag, data) {
  if (!data) return false;

  // Run state
  run.cash         = data.run.cash;
  run.holeNumber   = data.run.holeNumber;
  run.items        = data.run.items.slice();
  run.ball         = data.run.ball;
  run.totalScore   = data.run.totalScore;
  run.holesPlayed  = data.run.holesPlayed;
  run.birdieStreak = data.run.birdieStreak;
  run.status       = 'playing';
  run.strokes      = 0;
  run.lastResult   = null;

  // Bag state — re-init then overlay saved usesTotal so Phoenix Iron's
  // total-use progress is preserved across the refresh.
  bag.ownedIds         = new Set(data.bag.ownedIds);
  bag.usesPerHoleLeft  = new Map();
  bag.usesTotalLeft    = new Map();
  bag.lockedClubId     = null;
  for (const club of bag.ownedClubs()) {
    if (club.usesPerHole !== undefined) bag.usesPerHoleLeft.set(club.id, club.usesPerHole);
    if (club.usesTotal   !== undefined) bag.usesTotalLeft.set(club.id, club.usesTotal);
  }
  for (const [id, val] of Object.entries(data.bag.usesTotalLeft || {})) {
    bag.usesTotalLeft.set(id, val);
  }
  // Active id falls back to first owned club if the saved one is gone.
  bag.activeId = bag.ownedIds.has(data.bag.activeId)
    ? data.bag.activeId
    : (bag.ownedClubs()[0] ? bag.ownedClubs()[0].id : null);

  return true;
}
