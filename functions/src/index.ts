import {initializeApp} from "firebase-admin/app";
import {getDatabase, ServerValue} from "firebase-admin/database";
import {setGlobalOptions} from "firebase-functions";
import {HttpsError, onCall} from "firebase-functions/v2/https";

setGlobalOptions({maxInstances: 10});

initializeApp();

type ChampionId = "heracles" | "achilles" | "perseus" | "theseus";

const CHAMPION_IDS: ChampionId[] = [
  "heracles",
  "achilles",
  "perseus",
  "theseus",
];

const SCORING_ROUNDS = [2, 3, 4] as const;
const MISSING_ELAPSED_MS_PENALTY = 20000;

interface SubmitChampionChoiceRequest {
  gameId?: unknown;
  championId?: unknown;
}

interface GameActionRequest {
  gameId?: unknown;
}

interface BuildLeaderboardRequest {
  gameId?: unknown;
}

interface SubmitTiebreakChoiceRequest {
  gameId?: unknown;
  championId?: unknown;
}

interface CurrentRound {
  roundNumber?: unknown;
  status?: unknown;
  isDemo?: unknown;
  startedAt?: unknown;
  endsAt?: unknown;
  eliminatedChampion?: unknown;
}

interface StoredSubmission {
  uid?: unknown;
  championId?: unknown;
  submittedAt?: unknown;
}

interface GameRoot {
  currentRound?: CurrentRound;
  participants?: Record<string, unknown>;
  submissions?: Record<string, Record<string, StoredSubmission>>;
  live?: {
    currentRoundVotes?: Record<string, number>;
  };
  scores?: Record<string, { total?: unknown }>;
}

interface RoundRecord {
  roundNumber: number;
  isDemo: boolean;
  status: "countdown" | "voting" | "closed" | "result" | "registration";
  startedAt: number | null;
  endsAt: number | null;
  eliminatedChampion: ChampionId | null;
}

interface RoundScoreRecord {
  championId: ChampionId | null;
  score: number;
  submittedAt: number | null;
  elapsedMs: number | null;
}

interface RoundResultRecord {
  status: "finalized";
  eliminatedChampion: ChampionId;
}

interface ParticipantProfileRecord {
  nickname?: unknown;
  selfieUrl?: unknown;
}

interface StoredLeaderboardScoreRecord {
  score?: unknown;
  elapsedMs?: unknown;
}

interface StoredLeaderboardParticipantScoreRecord {
  total?: unknown;
  rounds?: Record<string, StoredLeaderboardScoreRecord>;
}

interface LeaderboardEntryRecord {
  uid: string;
  nickname: string;
  selfieUrl: string | null;
  totalScore: number;
  cumulativeResponseMs: number;
  rank: number;
}

type FinalResultStatus = "pending" | "tiebreak_required" | "finalized";

type TiebreakStatus =
  "idle" |
  "countdown" |
  "voting" |
  "closed" |
  "result";

interface FinalTopFiveEntryRecord {
  uid: string;
  nickname: string;
  selfieUrl: string | null;
  totalScore: number;
  cumulativeResponseMs: number;
  finalRank: number;
}

interface StoredFinalResultRecord {
  status?: unknown;
  generatedAt?: unknown;
  topFive?: unknown;
  tiedUids?: unknown;
  randomDrawUsed?: unknown;
  randomDrawOrder?: unknown;
}

interface TiebreakRecord {
  status?: unknown;
  participantUids?: unknown;
  startedAt?: unknown;
  endsAt?: unknown;
  eliminatedChampion?: unknown;
  voteTotals?: unknown;
  submissions?: unknown;
}

interface TiebreakSubmissionRecord {
  uid?: unknown;
  championId?: unknown;
  submittedAt?: unknown;
}

interface TiebreakFinalizedResultRecord {
  eliminatedChampion: ChampionId;
}

/**
 * Validates champion ids accepted by the game.
 * @param {unknown} value Potential champion id.
 * @return {boolean} True when value is a valid champion id.
 */
function isChampionId(value: unknown): value is ChampionId {
  return (
    value === "heracles" ||
    value === "achilles" ||
    value === "perseus" ||
    value === "theseus"
  );
}

/**
 * Validates game ids passed by callers.
 * @param {unknown} value Potential game id.
 * @return {boolean} True when value is a valid game id.
 */
function isValidGameId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * Validates scoring round numbers.
 * @param {number} value Potential scoring round number.
 * @return {boolean} True when value is a scoring round number.
 */
function isScoringRoundNumber(value: number): value is 2 | 3 | 4 {
  return value === 2 || value === 3 || value === 4;
}

/**
 * Sleeps for the given duration.
 * @param {number} milliseconds Duration in milliseconds.
 * @return {Promise<void>} Promise resolved after the delay.
 */
function waitFor(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Parses a finite number from an unknown value.
 * @param {unknown} value Value to parse.
 * @return {number | null} Parsed finite number or null.
 */
function toFiniteNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Parses a valid elapsed response time.
 * @param {unknown} value Value to parse.
 * @return {number | null} Non-negative elapsed milliseconds or null.
 */
function toValidElapsedMs(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 0) {
    return null;
  }

  return parsed;
}

/**
 * Clamps a number to the provided range.
 * @param {number} value Input value.
 * @param {number} minimum Inclusive minimum.
 * @param {number} maximum Inclusive maximum.
 * @return {number} Clamped value.
 */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Parses leaderboard entries from an unknown value.
 * @param {unknown} value Raw leaderboard entries.
 * @return {LeaderboardEntryRecord[]} Normalized entries sorted by rank.
 */
function parseLeaderboardEntries(value: unknown): LeaderboardEntryRecord[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const entries: LeaderboardEntryRecord[] = [];

  for (const rawEntry of Object.values(value as Record<string, unknown>)) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }

    const record = rawEntry as Record<string, unknown>;
    const uid = typeof record.uid === "string" ? record.uid : "";
    const nickname = typeof record.nickname === "string" ? record.nickname : "";
    const selfieUrl =
      typeof record.selfieUrl === "string" && record.selfieUrl.trim() ?
        record.selfieUrl :
        null;
    const totalScore = toFiniteNumber(record.totalScore) ?? 0;
    const cumulativeResponseMs =
      toFiniteNumber(record.cumulativeResponseMs) ?? 0;
    const rank = toFiniteNumber(record.rank);

    if (!uid || !nickname || rank === null) {
      continue;
    }

    entries.push({
      uid,
      nickname,
      selfieUrl,
      totalScore,
      cumulativeResponseMs,
      rank,
    });
  }

  entries.sort((leftEntry, rightEntry) => {
    if (leftEntry.rank !== rightEntry.rank) {
      return leftEntry.rank - rightEntry.rank;
    }

    return leftEntry.uid.localeCompare(rightEntry.uid);
  });

  return entries;
}

/**
 * Builds the persisted top-five payload.
 * @param {LeaderboardEntryRecord[]} entries Sorted entries.
 * @return {Record<string, FinalTopFiveEntryRecord>} Stored top-five object.
 */
function buildTopFiveObject(
  entries: LeaderboardEntryRecord[]
): Record<string, FinalTopFiveEntryRecord> {
  const topFive: Record<string, FinalTopFiveEntryRecord> = {};
  entries.slice(0, 5).forEach((entry, index) => {
    topFive[String(index)] = {
      uid: entry.uid,
      nickname: entry.nickname,
      selfieUrl: entry.selfieUrl,
      totalScore: entry.totalScore,
      cumulativeResponseMs: entry.cumulativeResponseMs,
      finalRank: index + 1,
    };
  });

  return topFive;
}

/**
 * Returns tied total-score groups that affect final top-five.
 * @param {LeaderboardEntryRecord[]} sortedEntries Leaderboard entries
 * sorted by rank.
 * @return {string[]} Uids that must participate in sudden death.
 */
function collectRelevantTieUids(
  sortedEntries: LeaderboardEntryRecord[]
): string[] {
  const tiedUids = new Set<string>();

  let index = 0;
  while (index < sortedEntries.length) {
    const groupStart = index;
    const groupScore = sortedEntries[index].totalScore;
    while (
      index < sortedEntries.length &&
      sortedEntries[index].totalScore === groupScore
    ) {
      index += 1;
    }

    const groupEntries = sortedEntries.slice(groupStart, index);
    if (groupEntries.length <= 1) {
      continue;
    }

    const impactsTopFive = groupEntries.some((entry) => entry.rank <= 5);
    if (!impactsTopFive) {
      continue;
    }

    groupEntries.forEach((entry) => tiedUids.add(entry.uid));
  }

  return Array.from(tiedUids).sort((leftUid, rightUid) =>
    leftUid.localeCompare(rightUid)
  );
}

/**
 * Converts an ordered uid list into indexed storage object.
 * @param {string[]} uids Ordered uid list.
 * @return {Record<string, string>} Indexed uid object.
 */
function toIndexedUidObject(uids: string[]): Record<string, string> {
  const indexed: Record<string, string> = {};
  uids.forEach((uid, index) => {
    indexed[String(index)] = uid;
  });

  return indexed;
}

/**
 * Parses an indexed uid object.
 * @param {unknown} value Raw tied uid object.
 * @return {string[]} Sorted unique uid list.
 */
function parseIndexedUidObject(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const parsed: string[] = [];
  for (const rawUid of Object.values(value as Record<string, unknown>)) {
    if (typeof rawUid !== "string" || !rawUid) {
      continue;
    }
    parsed.push(rawUid);
  }

  return Array.from(new Set(parsed)).sort((leftUid, rightUid) =>
    leftUid.localeCompare(rightUid)
  );
}

/**
 * Converts participant uid list into membership map.
 * @param {string[]} uids Ordered uid list.
 * @return {Record<string, boolean>} Membership map.
 */
function toParticipantUidMap(uids: string[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  uids.forEach((uid) => {
    map[uid] = true;
  });
  return map;
}

/**
 * Returns true when any tied participant remains exactly tied after fallback.
 * @param {LeaderboardEntryRecord[]} entries Entries to inspect.
 * @param {Record<string, "survived" | "eliminated">} outcomes
 * Tiebreak outcomes.
 * @param {Set<string>} tiedUidSet Eligible tied participants.
 * @return {boolean} True when random draw is required.
 */
function requiresRandomDraw(
  entries: LeaderboardEntryRecord[],
  outcomes: Record<string, "survived" | "eliminated">,
  tiedUidSet: Set<string>
): boolean {
  const bucketCounts: Record<string, number> = {};

  for (const entry of entries) {
    if (!tiedUidSet.has(entry.uid)) {
      continue;
    }

    const outcome = outcomes[entry.uid] ?? "eliminated";
    const key = [
      String(entry.totalScore),
      outcome,
      String(entry.cumulativeResponseMs),
    ].join("|");

    bucketCounts[key] = (bucketCounts[key] ?? 0) + 1;
    if (bucketCounts[key] > 1) {
      return true;
    }
  }

  return false;
}

/**
 * Creates a random one-time order mapping.
 * @param {string[]} uids Uids to shuffle.
 * @return {Record<string, number>} Uid to order index.
 */
function createRandomOrderMap(uids: string[]): Record<string, number> {
  const shuffled = [...uids];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[randomIndex];
    shuffled[randomIndex] = temp;
  }

  const orderMap: Record<string, number> = {};
  shuffled.forEach((uid, index) => {
    orderMap[uid] = index;
  });

  return orderMap;
}

/**
 * Parses a random order map.
 * @param {unknown} value Raw map.
 * @return {Record<string, number>} Parsed map.
 */
function parseRandomOrderMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const parsed: Record<string, number> = {};
  for (
    const [uid, rawOrder] of Object.entries(value as Record<string, unknown>)
  ) {
    const order = toFiniteNumber(rawOrder);
    if (!uid || order === null) {
      continue;
    }
    parsed[uid] = order;
  }

  return parsed;
}

/**
 * Calculates authoritative score for one participant in a scoring round.
 * @param {StoredSubmission | undefined} submission Submission payload.
 * @param {ChampionId} eliminatedChampion Eliminated champion id.
 * @param {number | null} startedAt Round started timestamp.
 * @param {number | null} endsAt Round end timestamp.
 * @return {RoundScoreRecord} Score result for the participant.
 */
function calculateRoundScore(
  submission: StoredSubmission | undefined,
  eliminatedChampion: ChampionId,
  startedAt: number | null,
  endsAt: number | null
): RoundScoreRecord {
  const championId = submission && isChampionId(submission.championId) ?
    submission.championId :
    null;
  const submittedAt = toFiniteNumber(submission?.submittedAt);

  if (!championId || championId === eliminatedChampion) {
    return {
      championId,
      score: 0,
      submittedAt,
      elapsedMs: submittedAt !== null && startedAt !== null ?
        submittedAt - startedAt :
        null,
    };
  }

  if (
    submittedAt === null ||
    startedAt === null ||
    endsAt === null ||
    endsAt <= startedAt
  ) {
    return {
      championId,
      score: 0,
      submittedAt,
      elapsedMs: submittedAt !== null && startedAt !== null ?
        submittedAt - startedAt :
        null,
    };
  }

  const elapsed = submittedAt - startedAt;
  const roundDuration = endsAt - startedAt;
  const normalized = elapsed / roundDuration;
  const rawScore = 30 + 70 * (1 - normalized);
  const score = Math.round(clamp(rawScore, 30, 100));

  return {
    championId,
    score,
    submittedAt,
    elapsedMs: elapsed,
  };
}

export const submitChampionChoice = onCall<SubmitChampionChoiceRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    const uid = request.auth.uid;
    const gameId = request.data?.gameId;
    const championId = request.data?.championId;

    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    if (!isChampionId(championId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid championId is required."
      );
    }

    const gameRef = getDatabase().ref(`games/${gameId}`);
    const gameSnapshot = await gameRef.get();
    if (!gameSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current game is available."
      );
    }

    const initialGame = gameSnapshot.val() as GameRoot;
    const initialCurrentRound = initialGame.currentRound;
    if (!initialCurrentRound || typeof initialCurrentRound !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    if (initialCurrentRound.status !== "voting") {
      throw new HttpsError(
        "failed-precondition",
        "Submissions are only allowed during voting."
      );
    }

    const initialRoundNumber = Number(initialCurrentRound.roundNumber);
    if (!Number.isFinite(initialRoundNumber)) {
      throw new HttpsError(
        "failed-precondition",
        "Current round number is invalid."
      );
    }

    let abortedBecauseAlreadySubmitted = false;

    try {
      const transactionResult = await gameRef.transaction((current) => {
        const game = (
          current && typeof current === "object" ?
            current :
            initialGame
        ) as GameRoot;
        const currentRound = game.currentRound;

        if (!currentRound || typeof currentRound !== "object") {
          throw new HttpsError(
            "failed-precondition",
            "No current round is available."
          );
        }

        if (currentRound.status !== "voting") {
          throw new HttpsError(
            "failed-precondition",
            "Submissions are only allowed during voting."
          );
        }

        const roundNumber = Number(currentRound.roundNumber);
        if (!Number.isFinite(roundNumber)) {
          throw new HttpsError(
            "failed-precondition",
            "Current round number is invalid."
          );
        }

        const roundKey = String(roundNumber);
        const roundSubmissions = game.submissions?.[roundKey] ?? {};

        if (roundSubmissions[uid]) {
          abortedBecauseAlreadySubmitted = true;
          return;
        }

        const currentVotes = game.live?.currentRoundVotes ?? {};
        const nextVotes = {
          heracles: Number(currentVotes.heracles ?? 0),
          achilles: Number(currentVotes.achilles ?? 0),
          perseus: Number(currentVotes.perseus ?? 0),
          theseus: Number(currentVotes.theseus ?? 0),
        };

        nextVotes[championId] += 1;

        return {
          ...game,
          submissions: {
            ...(game.submissions ?? {}),
            [roundKey]: {
              ...roundSubmissions,
              [uid]: {
                uid,
                championId,
                submittedAt: ServerValue.TIMESTAMP,
              },
            },
          },
          live: {
            ...(game.live ?? {}),
            currentRoundVotes: nextVotes,
          },
        };
      });

      if (!transactionResult.committed) {
        if (abortedBecauseAlreadySubmitted) {
          throw new HttpsError(
            "already-exists",
            "You already submitted a champion for this round."
          );
        }

        throw new HttpsError(
          "failed-precondition",
          "Submission could not be completed."
        );
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "failed-precondition",
        "Submission could not be completed."
      );
    }

    return {ok: true};
  }
);

export const startDemoRound = onCall<GameActionRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const gameRef = getDatabase().ref(`games/${gameId}`);
    const currentRoundRef = getDatabase().ref(`games/${gameId}/currentRound`);

    const existingRound = await currentRoundRef.get();
    if (existingRound.exists()) {
      throw new HttpsError(
        "already-exists",
        "A round is already active."
      );
    }

    const currentRound: RoundRecord = {
      roundNumber: 1,
      isDemo: true,
      status: "countdown",
      startedAt: null,
      endsAt: null,
      eliminatedChampion: null,
    };

    await gameRef.update({
      currentRound,
      "live/currentRoundVotes": {
        heracles: 0,
        achilles: 0,
        perseus: 0,
        theseus: 0,
      },
    });

    await waitFor(3000);

    const currentRoundSnapshot = await currentRoundRef.get();
    if (!currentRoundSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const snapshotValue = currentRoundSnapshot.val();
    if (!snapshotValue || typeof snapshotValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const round = snapshotValue as RoundRecord;
    if (round.status !== "countdown") {
      throw new HttpsError(
        "failed-precondition",
        "Demo round countdown could not transition to voting."
      );
    }

    const startedAt = Date.now();
    await currentRoundRef.update({
      status: "voting",
      startedAt,
      endsAt: startedAt + 20000,
    });

    return {ok: true};
  }
);

export const closeVoting = onCall<GameActionRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const currentRoundRef = getDatabase().ref(`games/${gameId}/currentRound`);
    const currentRoundSnapshot = await currentRoundRef.get();
    if (!currentRoundSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const snapshotValue = currentRoundSnapshot.val();
    if (!snapshotValue || typeof snapshotValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const snapshotRound = snapshotValue as RoundRecord;
    if (snapshotRound.status !== "voting") {
      throw new HttpsError(
        "failed-precondition",
        "Voting is not currently open."
      );
    }

    await currentRoundRef.update({status: "closed"});

    return {ok: true};
  }
);

export const startNextRound = onCall<GameActionRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const db = getDatabase();
    const gameRef = db.ref(`games/${gameId}`);
    const currentRoundRef = db.ref(`games/${gameId}/currentRound`);
    const currentRoundSnapshot = await currentRoundRef.get();

    if (!currentRoundSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const currentRoundValue = currentRoundSnapshot.val();
    if (!currentRoundValue || typeof currentRoundValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const currentRound = currentRoundValue as RoundRecord;
    if (currentRound.status !== "result") {
      throw new HttpsError(
        "failed-precondition",
        "Current round is not ready to advance."
      );
    }

    const roundNumber = Number(currentRound.roundNumber);
    let nextRoundNumber: number | null = null;
    if (roundNumber === 1) {
      nextRoundNumber = 2;
    } else if (roundNumber === 2) {
      nextRoundNumber = 3;
    } else if (roundNumber === 3) {
      nextRoundNumber = 4;
    }

    if (!nextRoundNumber) {
      throw new HttpsError(
        "failed-precondition",
        "Scoring rounds are already complete."
      );
    }

    if (roundNumber === 2 || roundNumber === 3) {
      const leaderboardSnapshot = await db
        .ref(`games/${gameId}/leaderboard/roundNumber`)
        .get();
      const leaderboardRoundNumber = toFiniteNumber(leaderboardSnapshot.val());

      if (leaderboardRoundNumber !== roundNumber) {
        throw new HttpsError(
          "failed-precondition",
          "Build leaderboard before starting the next round."
        );
      }
    }

    const nextRound: RoundRecord = {
      roundNumber: nextRoundNumber,
      isDemo: false,
      status: "countdown",
      startedAt: null,
      endsAt: null,
      eliminatedChampion: null,
    };

    await gameRef.update({
      "currentRound": nextRound,
      "live/currentRoundVotes": {
        heracles: 0,
        achilles: 0,
        perseus: 0,
        theseus: 0,
      },
    });

    await waitFor(3000);

    const verifySnapshot = await currentRoundRef.get();
    if (!verifySnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const verifyValue = verifySnapshot.val();
    if (!verifyValue || typeof verifyValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const verifyRound = verifyValue as RoundRecord;
    if (
      verifyRound.status !== "countdown" ||
      Number(verifyRound.roundNumber) !== nextRoundNumber
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Next round countdown could not transition to voting."
      );
    }

    const startedAt = Date.now();
    await currentRoundRef.update({
      status: "voting",
      startedAt,
      endsAt: startedAt + 20000,
    });

    return {ok: true, roundNumber: nextRoundNumber};
  }
);

export const finalizeRound = onCall<GameActionRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const db = getDatabase();
    const currentRoundRef = db.ref(`games/${gameId}/currentRound`);
    const currentRoundSnapshot = await currentRoundRef.get();

    if (!currentRoundSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const snapshotValue = currentRoundSnapshot.val();
    if (!snapshotValue || typeof snapshotValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const currentRound = snapshotValue as RoundRecord;
    if (currentRound.status === "result") {
      throw new HttpsError(
        "failed-precondition",
        "Round is already finalized."
      );
    }

    if (currentRound.status !== "closed") {
      throw new HttpsError(
        "failed-precondition",
        "Round is not ready to be finalized."
      );
    }

    const roundNumber = Number(currentRound.roundNumber);
    if (!Number.isFinite(roundNumber)) {
      throw new HttpsError(
        "failed-precondition",
        "Current round number is invalid."
      );
    }

    const votesRef = db.ref(`games/${gameId}/live/currentRoundVotes`);
    const votesSnapshot = await votesRef.get();
    const rawVotes = votesSnapshot.exists() &&
      votesSnapshot.val() &&
      typeof votesSnapshot.val() === "object" ?
      votesSnapshot.val() as Record<string, unknown> :
      {};

    const totals: Record<ChampionId, number> = {
      heracles: Number.isFinite(Number(rawVotes.heracles)) ?
        Number(rawVotes.heracles) :
        0,
      achilles: Number.isFinite(Number(rawVotes.achilles)) ?
        Number(rawVotes.achilles) :
        0,
      perseus: Number.isFinite(Number(rawVotes.perseus)) ?
        Number(rawVotes.perseus) :
        0,
      theseus: Number.isFinite(Number(rawVotes.theseus)) ?
        Number(rawVotes.theseus) :
        0,
    };

    const highestVotes = Math.max(
      totals.heracles,
      totals.achilles,
      totals.perseus,
      totals.theseus
    );

    const tiedChampions = CHAMPION_IDS.filter(
      (championId) => totals[championId] === highestVotes
    );

    const eliminatedChampion = tiedChampions[
      Math.floor(Math.random() * tiedChampions.length)
    ];

    const roundResultRef = db.ref(
      `games/${gameId}/roundResults/${roundNumber}`
    );
    const claimResult = await roundResultRef.transaction((current) => {
      if (current && typeof current === "object") {
        return current;
      }

      const roundResult: RoundResultRecord = {
        status: "finalized",
        eliminatedChampion,
      };

      return roundResult;
    });

    const claimSnapshotValue = claimResult.snapshot?.val();
    if (!claimSnapshotValue || typeof claimSnapshotValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "Round finalization state is invalid."
      );
    }

    const storedResult = claimSnapshotValue as RoundResultRecord;
    if (!isChampionId(storedResult.eliminatedChampion)) {
      throw new HttpsError(
        "failed-precondition",
        "Round finalization state is invalid."
      );
    }

    const authoritativeEliminatedChampion = storedResult.eliminatedChampion;

    const verifyBeforeUpdate = await currentRoundRef.get();
    if (!verifyBeforeUpdate.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const verifyValue = verifyBeforeUpdate.val();
    if (!verifyValue || typeof verifyValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const verifyRound = verifyValue as RoundRecord;
    if (verifyRound.status === "result") {
      throw new HttpsError(
        "failed-precondition",
        "Round is already finalized."
      );
    }

    if (verifyRound.status !== "closed") {
      throw new HttpsError(
        "failed-precondition",
        "Round is not ready to be finalized."
      );
    }

    const startedAt = toFiniteNumber(verifyRound.startedAt);
    const endsAt = toFiniteNumber(verifyRound.endsAt);

    const updates: Record<string, unknown> = {
      "currentRound/status": "result",
      "currentRound/eliminatedChampion": authoritativeEliminatedChampion,
    };

    const isScoringRound = !verifyRound.isDemo &&
      Number.isFinite(roundNumber) &&
      roundNumber >= 2 &&
      roundNumber <= 4;

    if (isScoringRound) {
      const participantsRef = db.ref(`games/${gameId}/participants`);
      const participantsSnapshot = await participantsRef.get();
      const participantsRaw =
        participantsSnapshot.exists() &&
          participantsSnapshot.val() &&
          typeof participantsSnapshot.val() === "object" ?
          participantsSnapshot.val() as Record<string, unknown> :
          {};

      const submissionsSnapshot = await db
        .ref(`games/${gameId}/submissions/${roundNumber}`)
        .get();
      const submissionsRaw =
        submissionsSnapshot.exists() &&
          submissionsSnapshot.val() &&
          typeof submissionsSnapshot.val() === "object" ?
          submissionsSnapshot.val() as
          Record<string, StoredSubmission> :
          {};

      const scoresSnapshot = await db.ref(`games/${gameId}/scores`).get();
      const scoresRaw =
        scoresSnapshot.exists() &&
          scoresSnapshot.val() &&
          typeof scoresSnapshot.val() === "object" ?
          scoresSnapshot.val() as
          Record<
            string,
            { rounds?: Record<string, RoundScoreRecord> }
          > :
          {};

      for (const uid of Object.keys(participantsRaw)) {
        const roundScore = calculateRoundScore(
          submissionsRaw[uid],
          authoritativeEliminatedChampion,
          startedAt,
          endsAt
        );

        const existingRounds =
          scoresRaw[uid]?.rounds &&
            typeof scoresRaw[uid].rounds === "object" ?
            scoresRaw[uid].rounds :
            {};

        let deterministicTotal = 0;
        for (const scoringRound of [2, 3, 4]) {
          if (scoringRound === roundNumber) {
            deterministicTotal += roundScore.score;
            continue;
          }

          const existingRoundScore = existingRounds[String(scoringRound)];
          const numericScore = toFiniteNumber(existingRoundScore?.score);
          deterministicTotal += numericScore !== null ? numericScore : 0;
        }

        updates[`scores/${uid}/rounds/${roundNumber}`] = roundScore;
        updates[`scores/${uid}/total`] = deterministicTotal;
      }
    }

    await db.ref(`games/${gameId}`).update(updates);

    return {
      ok: true,
      eliminatedChampion: authoritativeEliminatedChampion,
    };
  }
);

export const buildLeaderboard = onCall<BuildLeaderboardRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const db = getDatabase();
    const currentRoundSnapshot = await db
      .ref(`games/${gameId}/currentRound`)
      .get();

    if (!currentRoundSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const currentRoundValue = currentRoundSnapshot.val();
    if (!currentRoundValue || typeof currentRoundValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const currentRound = currentRoundValue as RoundRecord;
    if (currentRound.status !== "result") {
      throw new HttpsError(
        "failed-precondition",
        "Leaderboard can only be built during round result state."
      );
    }

    const roundNumber = Number(currentRound.roundNumber);
    if (!isScoringRoundNumber(roundNumber)) {
      throw new HttpsError(
        "failed-precondition",
        "Leaderboard is only available for rounds 2, 3, and 4."
      );
    }

    const roundsToInclude = SCORING_ROUNDS.filter(
      (scoringRound) => scoringRound <= roundNumber
    );

    const participantsSnapshot = await db
      .ref(`games/${gameId}/participants`)
      .get();
    const participantsRaw =
      participantsSnapshot.exists() &&
        participantsSnapshot.val() &&
        typeof participantsSnapshot.val() === "object" ?
        participantsSnapshot.val() as Record<string, ParticipantProfileRecord> :
        {};

    const scoresSnapshot = await db.ref(`games/${gameId}/scores`).get();
    const scoresRaw =
      scoresSnapshot.exists() &&
        scoresSnapshot.val() &&
        typeof scoresSnapshot.val() === "object" ?
        scoresSnapshot.val() as
        Record<string, StoredLeaderboardParticipantScoreRecord> :
        {};

    const sortedUids = Object.keys(participantsRaw).sort((leftUid, rightUid) =>
      leftUid.localeCompare(rightUid)
    );

    const leaderboardEntries: LeaderboardEntryRecord[] = [];

    for (const uid of sortedUids) {
      const profile = participantsRaw[uid];
      const nickname =
        typeof profile?.nickname === "string" && profile.nickname.trim() ?
          profile.nickname.trim() :
          uid;
      const selfieUrl =
        typeof profile?.selfieUrl === "string" && profile.selfieUrl.trim() ?
          profile.selfieUrl :
          null;

      const scoreRecord = scoresRaw[uid];
      const totalScore = toFiniteNumber(scoreRecord?.total) ?? 0;
      const scoreRounds = scoreRecord?.rounds ?? {};

      let cumulativeResponseMs = 0;
      for (const scoringRound of roundsToInclude) {
        const roundScore = scoreRounds[String(scoringRound)];
        const score = toFiniteNumber(roundScore?.score);
        const elapsedMs = toValidElapsedMs(roundScore?.elapsedMs);

        if (score === null || score <= 0 || elapsedMs === null) {
          cumulativeResponseMs += MISSING_ELAPSED_MS_PENALTY;
          continue;
        }

        cumulativeResponseMs += Math.min(
          elapsedMs,
          MISSING_ELAPSED_MS_PENALTY
        );
      }

      leaderboardEntries.push({
        uid,
        nickname,
        selfieUrl,
        totalScore,
        cumulativeResponseMs,
        rank: 0,
      });
    }

    leaderboardEntries.sort((leftEntry, rightEntry) => {
      if (leftEntry.totalScore !== rightEntry.totalScore) {
        return rightEntry.totalScore - leftEntry.totalScore;
      }

      if (leftEntry.cumulativeResponseMs !== rightEntry.cumulativeResponseMs) {
        return leftEntry.cumulativeResponseMs - rightEntry.cumulativeResponseMs;
      }

      return leftEntry.uid.localeCompare(rightEntry.uid);
    });

    const rankedEntries: LeaderboardEntryRecord[] = leaderboardEntries.map(
      (entry, index) => ({
        ...entry,
        rank: index + 1,
      })
    );

    const storedEntries: Record<string, LeaderboardEntryRecord> = {};
    rankedEntries.forEach((entry, index) => {
      storedEntries[String(index)] = entry;
    });

    await db.ref(`games/${gameId}/leaderboard`).set({
      roundNumber,
      generatedAt: ServerValue.TIMESTAMP,
      entries: storedEntries,
    });

    return {
      ok: true,
      roundNumber,
      entryCount: rankedEntries.length,
    };
  }
);

export const prepareFinalResult = onCall<GameActionRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const db = getDatabase();
    const currentRoundSnapshot = await db
      .ref(`games/${gameId}/currentRound`)
      .get();
    if (!currentRoundSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const currentRoundValue = currentRoundSnapshot.val();
    if (!currentRoundValue || typeof currentRoundValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "No current round is available."
      );
    }

    const currentRound = currentRoundValue as RoundRecord;
    if (
      Number(currentRound.roundNumber) !== 4 ||
      currentRound.status !== "result"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Final result can only be prepared after round 4 result."
      );
    }

    const leaderboardSnapshot = await db
      .ref(`games/${gameId}/leaderboard`)
      .get();
    if (!leaderboardSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "Round 4 leaderboard is required before preparing final result."
      );
    }

    const leaderboardValue = leaderboardSnapshot.val();
    if (!leaderboardValue || typeof leaderboardValue !== "object") {
      throw new HttpsError(
        "failed-precondition",
        "Round 4 leaderboard is required before preparing final result."
      );
    }

    const leaderboardRoundNumber = toFiniteNumber(
      (leaderboardValue as Record<string, unknown>).roundNumber
    );
    if (leaderboardRoundNumber !== 4) {
      throw new HttpsError(
        "failed-precondition",
        "Round 4 leaderboard is required before preparing final result."
      );
    }

    const rankedEntries = parseLeaderboardEntries(
      (leaderboardValue as Record<string, unknown>).entries
    );
    if (rankedEntries.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "Leaderboard entries are invalid."
      );
    }

    const finalResultRef = db.ref(`games/${gameId}/finalResult`);
    const existingFinalSnapshot = await finalResultRef.get();
    const existingFinalValue = existingFinalSnapshot.val() as
      StoredFinalResultRecord | null;
    const existingStatus =
      existingFinalValue && typeof existingFinalValue.status === "string" ?
        existingFinalValue.status :
        null;

    if (existingStatus === "finalized") {
      return {ok: true, status: "finalized"};
    }

    const tiedUids = collectRelevantTieUids(rankedEntries);

    if (tiedUids.length === 0) {
      await finalResultRef.set({
        status: "finalized" as FinalResultStatus,
        generatedAt: ServerValue.TIMESTAMP,
        topFive: buildTopFiveObject(rankedEntries),
        tiedUids: null,
        randomDrawUsed: false,
      });

      return {
        ok: true,
        status: "finalized",
      };
    }

    await finalResultRef.set({
      status: "tiebreak_required" as FinalResultStatus,
      generatedAt: ServerValue.TIMESTAMP,
      topFive: {},
      tiedUids: toIndexedUidObject(tiedUids),
      randomDrawUsed: false,
    });

    const tiebreakRef = db.ref(`games/${gameId}/tiebreak`);
    const tiebreakSnapshot = await tiebreakRef.get();
    const existingTiebreak = tiebreakSnapshot.val() as
      TiebreakRecord | null;
    const existingTiebreakStatus =
      existingTiebreak && typeof existingTiebreak.status === "string" ?
        existingTiebreak.status :
        null;

    if (!existingTiebreakStatus || existingTiebreakStatus === "idle") {
      await tiebreakRef.update({
        status: "idle" as TiebreakStatus,
        participantUids: toParticipantUidMap(tiedUids),
        startedAt: null,
        endsAt: null,
        eliminatedChampion: null,
        voteTotals: {
          heracles: 0,
          achilles: 0,
          perseus: 0,
          theseus: 0,
        },
        submissions: {},
      });
    }

    return {
      ok: true,
      status: "tiebreak_required",
      participantCount: tiedUids.length,
    };
  }
);

export const startTiebreak = onCall<GameActionRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const db = getDatabase();
    const finalResultSnapshot = await db
      .ref(`games/${gameId}/finalResult`)
      .get();
    if (!finalResultSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "Final result is not prepared."
      );
    }

    const finalResult = finalResultSnapshot.val() as StoredFinalResultRecord;
    if (finalResult.status !== "tiebreak_required") {
      throw new HttpsError("failed-precondition", "Tiebreak is not required.");
    }

    const tiedUids = parseIndexedUidObject(finalResult.tiedUids);
    if (tiedUids.length < 2) {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak participants are invalid."
      );
    }

    const tiebreakRef = db.ref(`games/${gameId}/tiebreak`);
    const tiebreakSnapshot = await tiebreakRef.get();
    const tiebreakValue = tiebreakSnapshot.val() as TiebreakRecord | null;
    const status =
      tiebreakValue && typeof tiebreakValue.status === "string" ?
        tiebreakValue.status :
        "idle";

    if (status !== "idle") {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak is already in progress."
      );
    }

    await tiebreakRef.update({
      status: "countdown" as TiebreakStatus,
      participantUids: toParticipantUidMap(tiedUids),
      startedAt: null,
      endsAt: null,
      eliminatedChampion: null,
      voteTotals: {
        heracles: 0,
        achilles: 0,
        perseus: 0,
        theseus: 0,
      },
      submissions: {},
    });

    await waitFor(3000);

    const verifySnapshot = await tiebreakRef.get();
    const verifyValue = verifySnapshot.val() as TiebreakRecord | null;
    if (!verifyValue || verifyValue.status !== "countdown") {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak countdown could not transition to voting."
      );
    }

    const startedAt = Date.now();
    await tiebreakRef.update({
      status: "voting" as TiebreakStatus,
      startedAt,
      endsAt: startedAt + 20000,
    });

    return {ok: true};
  }
);

export const closeTiebreakVoting = onCall<GameActionRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const tiebreakRef = getDatabase().ref(`games/${gameId}/tiebreak`);
    const tiebreakSnapshot = await tiebreakRef.get();
    if (!tiebreakSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak is not initialized."
      );
    }

    const tiebreakValue = tiebreakSnapshot.val() as TiebreakRecord;
    if (tiebreakValue.status !== "voting") {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak voting is not open."
      );
    }

    await tiebreakRef.update({status: "closed" as TiebreakStatus});

    return {ok: true};
  }
);

export const submitTiebreakChoice = onCall<SubmitTiebreakChoiceRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    const uid = request.auth.uid;
    const gameId = request.data?.gameId;
    const championId = request.data?.championId;

    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    if (!isChampionId(championId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid championId is required."
      );
    }

    const db = getDatabase();
    const finalResultSnapshot = await db
      .ref(`games/${gameId}/finalResult`)
      .get();
    if (!finalResultSnapshot.exists()) {
      throw new HttpsError("failed-precondition", "Tiebreak is not available.");
    }

    const finalResult = finalResultSnapshot.val() as StoredFinalResultRecord;
    if (finalResult.status !== "tiebreak_required") {
      throw new HttpsError("failed-precondition", "Tiebreak is not available.");
    }

    const tiedUids = parseIndexedUidObject(finalResult.tiedUids);
    if (!tiedUids.includes(uid)) {
      throw new HttpsError(
        "permission-denied",
        "You are not eligible to submit in this tiebreak."
      );
    }

    const tiebreakRef = db.ref(`games/${gameId}/tiebreak`);
    let duplicateSubmission = false;

    const transactionResult = await tiebreakRef.transaction((current) => {
      if (!current || typeof current !== "object") {
        throw new HttpsError(
          "failed-precondition",
          "Tiebreak is not initialized."
        );
      }

      const tiebreak = current as Record<string, unknown>;
      if (tiebreak.status !== "voting") {
        throw new HttpsError(
          "failed-precondition",
          "Tiebreak voting is not open."
        );
      }

      const participantUids =
        tiebreak.participantUids &&
          typeof tiebreak.participantUids === "object" ?
          tiebreak.participantUids as Record<string, unknown> :
          {};

      if (participantUids[uid] !== true) {
        throw new HttpsError(
          "permission-denied",
          "You are not eligible to submit in this tiebreak."
        );
      }

      const submissions =
        tiebreak.submissions && typeof tiebreak.submissions === "object" ?
          tiebreak.submissions as Record<string, unknown> :
          {};

      if (submissions[uid]) {
        duplicateSubmission = true;
        return;
      }

      const voteTotalsRaw =
        tiebreak.voteTotals && typeof tiebreak.voteTotals === "object" ?
          tiebreak.voteTotals as Record<string, unknown> :
          {};

      const voteTotals = {
        heracles: Number(voteTotalsRaw.heracles ?? 0),
        achilles: Number(voteTotalsRaw.achilles ?? 0),
        perseus: Number(voteTotalsRaw.perseus ?? 0),
        theseus: Number(voteTotalsRaw.theseus ?? 0),
      };

      voteTotals[championId] += 1;

      return {
        ...tiebreak,
        submissions: {
          ...submissions,
          [uid]: {
            uid,
            championId,
            submittedAt: ServerValue.TIMESTAMP,
          },
        },
        voteTotals,
      };
    });

    if (!transactionResult.committed) {
      if (duplicateSubmission) {
        throw new HttpsError(
          "already-exists",
          "You already submitted for tiebreak."
        );
      }

      throw new HttpsError(
        "failed-precondition",
        "Tiebreak submission failed."
      );
    }

    return {ok: true};
  }
);

export const finalizeTiebreak = onCall<GameActionRequest>(
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    // TODO: Restrict this action to authorized GM users before production.
    const gameId = request.data?.gameId;
    if (!isValidGameId(gameId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid gameId is required."
      );
    }

    const db = getDatabase();
    const finalResultRef = db.ref(`games/${gameId}/finalResult`);
    const finalResultSnapshot = await finalResultRef.get();
    if (!finalResultSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "Final result is not prepared."
      );
    }

    const finalResult = finalResultSnapshot.val() as StoredFinalResultRecord;
    if (finalResult.status === "finalized") {
      return {ok: true, status: "finalized"};
    }

    if (finalResult.status !== "tiebreak_required") {
      throw new HttpsError("failed-precondition", "Tiebreak is not required.");
    }

    const tiedUids = parseIndexedUidObject(finalResult.tiedUids);
    if (tiedUids.length < 2) {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak participants are invalid."
      );
    }

    const tiebreakRef = db.ref(`games/${gameId}/tiebreak`);
    const tiebreakSnapshot = await tiebreakRef.get();
    if (!tiebreakSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak is not initialized."
      );
    }

    const tiebreak = tiebreakSnapshot.val() as TiebreakRecord;
    if (tiebreak.status !== "closed" && tiebreak.status !== "result") {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak is not ready to finalize."
      );
    }

    const voteTotalsRaw =
      tiebreak.voteTotals && typeof tiebreak.voteTotals === "object" ?
        tiebreak.voteTotals as Record<string, unknown> :
        {};

    const voteTotals: Record<ChampionId, number> = {
      heracles: Number(voteTotalsRaw.heracles ?? 0),
      achilles: Number(voteTotalsRaw.achilles ?? 0),
      perseus: Number(voteTotalsRaw.perseus ?? 0),
      theseus: Number(voteTotalsRaw.theseus ?? 0),
    };

    const highestVotes = Math.max(
      voteTotals.heracles,
      voteTotals.achilles,
      voteTotals.perseus,
      voteTotals.theseus
    );

    const topChampions = CHAMPION_IDS.filter(
      (championId) => voteTotals[championId] === highestVotes
    );
    const sampledEliminatedChampion = topChampions[
      Math.floor(Math.random() * topChampions.length)
    ];

    const tiebreakResultRef = db.ref(
      `games/${gameId}/tiebreak/finalizedResult`
    );
    const claimResult = await tiebreakResultRef.transaction((current) => {
      if (current && typeof current === "object") {
        return current;
      }

      return {
        eliminatedChampion: sampledEliminatedChampion,
      } as TiebreakFinalizedResultRecord;
    });

    const claimedResult = claimResult.snapshot?.val() as
      TiebreakFinalizedResultRecord | null;
    if (!claimedResult || !isChampionId(claimedResult.eliminatedChampion)) {
      throw new HttpsError(
        "failed-precondition",
        "Tiebreak result state is invalid."
      );
    }

    const eliminatedChampion = claimedResult.eliminatedChampion;

    const submissionsRaw =
      tiebreak.submissions && typeof tiebreak.submissions === "object" ?
        tiebreak.submissions as Record<string, TiebreakSubmissionRecord> :
        {};

    const tiebreakOutcomes: Record<string, "survived" | "eliminated"> = {};
    tiedUids.forEach((uid) => {
      const chosenChampion = submissionsRaw[uid]?.championId;
      tiebreakOutcomes[uid] = isChampionId(chosenChampion) &&
        chosenChampion !== eliminatedChampion ?
        "survived" :
        "eliminated";
    });

    const leaderboardSnapshot = await db
      .ref(`games/${gameId}/leaderboard`)
      .get();
    if (!leaderboardSnapshot.exists()) {
      throw new HttpsError(
        "failed-precondition",
        "Round 4 leaderboard is required."
      );
    }

    const leaderboardValue = leaderboardSnapshot.val() as
      Record<string, unknown>;
    const leaderboardRoundNumber = toFiniteNumber(leaderboardValue.roundNumber);
    if (leaderboardRoundNumber !== 4) {
      throw new HttpsError(
        "failed-precondition",
        "Round 4 leaderboard is required."
      );
    }

    const rankedEntries = parseLeaderboardEntries(leaderboardValue.entries);
    const tiedUidSet = new Set(tiedUids);
    const shouldUseRandomDraw = requiresRandomDraw(
      rankedEntries,
      tiebreakOutcomes,
      tiedUidSet
    );

    let randomDrawOrder = parseRandomOrderMap(finalResult.randomDrawOrder);
    if (shouldUseRandomDraw && Object.keys(randomDrawOrder).length === 0) {
      const randomOrderRef = db.ref(
        `games/${gameId}/finalResult/randomDrawOrder`
      );
      const drawClaim = await randomOrderRef.transaction((current) => {
        if (current && typeof current === "object") {
          return current;
        }

        return createRandomOrderMap(tiedUids);
      });

      randomDrawOrder = parseRandomOrderMap(drawClaim.snapshot?.val());
    }

    const rankedForFinal = [...rankedEntries].sort((leftEntry, rightEntry) => {
      if (leftEntry.totalScore !== rightEntry.totalScore) {
        return rightEntry.totalScore - leftEntry.totalScore;
      }

      const leftOutcome = tiebreakOutcomes[leftEntry.uid] ?? "survived";
      const rightOutcome = tiebreakOutcomes[rightEntry.uid] ?? "survived";
      if (leftOutcome !== rightOutcome) {
        return leftOutcome === "survived" ? -1 : 1;
      }

      if (leftEntry.cumulativeResponseMs !== rightEntry.cumulativeResponseMs) {
        return leftEntry.cumulativeResponseMs - rightEntry.cumulativeResponseMs;
      }

      const leftRandom = randomDrawOrder[leftEntry.uid];
      const rightRandom = randomDrawOrder[rightEntry.uid];
      if (
        shouldUseRandomDraw &&
        leftRandom !== undefined &&
        rightRandom !== undefined &&
        leftRandom !== rightRandom
      ) {
        return leftRandom - rightRandom;
      }

      return leftEntry.uid.localeCompare(rightEntry.uid);
    });

    await db.ref(`games/${gameId}`).update({
      "tiebreak/status": "result",
      "tiebreak/eliminatedChampion": eliminatedChampion,
      "tiebreak/outcomes": tiebreakOutcomes,
      "finalResult/status": "finalized",
      "finalResult/generatedAt": ServerValue.TIMESTAMP,
      "finalResult/topFive": buildTopFiveObject(rankedForFinal),
      "finalResult/randomDrawUsed": shouldUseRandomDraw,
      "finalResult/tiedUids": toIndexedUidObject(tiedUids),
    });

    return {
      ok: true,
      status: "finalized",
      eliminatedChampion,
      randomDrawUsed: shouldUseRandomDraw,
    };
  }
);
