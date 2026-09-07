/**
 * Sequence-similarity ratio (Ratcliff-Obershelp / "SequenceMatcher").
 *
 * WHAT THIS FILE IS FOR (plain-language summary):
 * This is a small, dependency-free re-implementation of the same
 * algorithm behind Python's `difflib.SequenceMatcher.ratio()`: given two
 * strings, it finds the longest stretch of characters they share, then
 * recursively does the same thing on whatever's left on either side of
 * that stretch, and turns the total amount of matched text into a
 * similarity score from 0 (nothing alike) to 1 (identical).
 *
 * It's used by `utils/schemeNameMatchingUtils.js` to match a fund name
 * from a WBR22 file (e.g. "Aditya Birla Sun Life Multi Asset Allocation
 * Fund-Reg Growth") against the closest name in the master scheme list
 * (e.g. "ADITYA BIRLA SUN LIFE MULTI ASSET ALLOCATION FUND"), when the
 * two spellings are close but not identical.
 */

/**
 * Find the single longest run of matching characters between
 * `a[aStart..aEnd)` and `b[bStart..bEnd)`.
 *
 * Uses a dynamic-programming table (one row of the classic
 * longest-common-substring DP, kept rolling to save memory) so this
 * runs in O((aEnd-aStart) * (bEnd-bStart)) time rather than the naive
 * O(n^3) triple-nested-loop version.
 *
 * @returns {{i: number, j: number, size: number}} the match's start
 *          index in `a`, start index in `b`, and its length (size 0
 *          means no match at all was found in this window)
 */
function findLongestMatch(a, b, aStart, aEnd, bStart, bEnd) {
    let bestI = aStart;
    let bestJ = bStart;
    let bestSize = 0;

    let previousRow = new Array(bEnd - bStart + 1).fill(0);

    for (let i = aStart; i < aEnd; i++) {
        const currentRow = new Array(bEnd - bStart + 1).fill(0);

        for (let j = bStart; j < bEnd; j++) {
            const col = j - bStart + 1;

            if (a[i] === b[j]) {
                currentRow[col] = previousRow[col - 1] + 1;

                if (currentRow[col] > bestSize) {
                    bestSize = currentRow[col];
                    bestI = i - bestSize + 1;
                    bestJ = j - bestSize + 1;
                }
            } else {
                currentRow[col] = 0;
            }
        }

        previousRow = currentRow;
    }

    return { i: bestI, j: bestJ, size: bestSize };
}

/**
 * Recursively sum up every matching block between the two windows: the
 * single longest match, plus whatever matches exist to its left and to
 * its right.
 */
function countMatchingCharacters(a, b, aStart, aEnd, bStart, bEnd) {
    if (aStart >= aEnd || bStart >= bEnd) {
        return 0;
    }

    const match = findLongestMatch(a, b, aStart, aEnd, bStart, bEnd);

    if (match.size === 0) {
        return 0;
    }

    return (
        match.size +
        countMatchingCharacters(a, b, aStart, match.i, bStart, match.j) +
        countMatchingCharacters(a, b, match.i + match.size, aEnd, match.j + match.size, bEnd)
    );
}

/**
 * Compute the Ratcliff-Obershelp similarity ratio between two strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} a similarity score from 0 (completely different) to
 *          1 (identical); two empty strings are treated as identical
 */
function sequenceMatcherRatio(a, b) {
    const left = String(a || "");
    const right = String(b || "");

    if (left.length === 0 && right.length === 0) {
        return 1;
    }

    const matches = countMatchingCharacters(left, right, 0, left.length, 0, right.length);

    return (2 * matches) / (left.length + right.length);
}

module.exports = { sequenceMatcherRatio };
