// Highscores — Phase 4e
//
// Tiny localStorage-backed record of best runs. Tracks:
//   bestScore   — lowest (most under par) total score across played holes
//   bestCash    — highest cash earned in any run
//   runs        — total runs played (started + finished)
//   completions — runs that reached the final hole victory
//
// Saved as JSON under a single key. Forward-compat: unknown fields are
// preserved; missing fields fall back to defaults.

const KEY = 'wackygolf_highscores_v1';

function defaults() {
  return { bestScore: null, bestCash: null, runs: 0, completions: 0 };
}

export function loadHighscores() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return { ...defaults(), ...parsed };
  } catch (e) {
    return defaults();
  }
}

export function saveHighscores(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage may be unavailable (privacy mode, quota) — silently ignore.
  }
}

/**
 * Record a finished run and update bests.
 *   totalScore   — sum of (strokes - par) for played holes (lower = better)
 *   totalCash    — cash on hand at run end
 *   holesPlayed  — number of holes that contributed
 *   completed    — true if the player reached the victory screen (hole 9 cleared)
 *
 * Returns { newScoreBest, newCashBest, current, previous } so UI can flag
 * "NEW BEST" rings.
 */
export function recordRun({ totalScore, totalCash, holesPlayed, completed }) {
  const previous = loadHighscores();
  const validScore = holesPlayed > 0;

  const newScoreBest = validScore &&
    (previous.bestScore === null || totalScore < previous.bestScore);
  const newCashBest = totalCash !== null && totalCash !== undefined &&
    (previous.bestCash === null || totalCash > previous.bestCash);

  const next = {
    bestScore: newScoreBest ? totalScore : previous.bestScore,
    bestCash: newCashBest ? totalCash : previous.bestCash,
    runs: previous.runs + 1,
    completions: previous.completions + (completed ? 1 : 0),
  };
  saveHighscores(next);
  return { newScoreBest, newCashBest, current: next, previous };
}

/** Format a golf score: -3 → "−3", 0 → "E", +2 → "+2". */
export function formatScore(n) {
  if (n === null || n === undefined) return '—';
  if (n === 0) return 'E';
  if (n > 0) return `+${n}`;
  return `−${Math.abs(n)}`;  // typographic minus for nicer rendering
}
