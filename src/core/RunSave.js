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
// v2 — bag layout switched from a Set + Map to a parallel-array indexed
// instance model so duplicate clubs can live in the bag. Saves from v1
// are quietly discarded on load (player loses one in-progress run).
const SCHEMA_VERSION = 2;

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
        owned: bag.owned.slice(),
        activeIndex: bag.activeIndex,
        // Per-instance counters. Infinity isn't valid JSON, so encode as null.
        usesTotalLeft: bag.usesTotalLeft.map((n) => (n === Infinity ? null : n)),
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

  // Bag state — restore the indexed instance arrays. usesPerHoleLeft is
  // re-initialized to fresh per-hole counts (mid-hole counters aren't
  // persisted by design); usesTotalLeft IS persisted so Phoenix Iron's
  // remaining swings survive a refresh.
  bag.owned           = (data.bag.owned || []).slice();
  bag.lockedClubId    = null;
  bag._initUsesForAll();
  const savedTotals   = data.bag.usesTotalLeft || [];
  for (let i = 0; i < bag.owned.length; i++) {
    const v = savedTotals[i];
    if (v === null || v === undefined) continue;     // unlimited / missing
    bag.usesTotalLeft[i] = v;
  }
  // Clamp activeIndex to a valid slot (saved index might be stale).
  const savedIdx = data.bag.activeIndex;
  bag.activeIndex = (savedIdx !== undefined && savedIdx >= 0 && savedIdx < bag.owned.length)
    ? savedIdx : 0;

  return true;
}
