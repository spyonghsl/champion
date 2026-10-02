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

interface SubmitChampionChoiceRequest {
    gameId?: unknown;
    championId?: unknown;
}

interface GameActionRequest {
    gameId?: unknown;
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
        return;
      }

      const roundResult: RoundResultRecord = {
        status: "finalized",
        eliminatedChampion,
      };

      return roundResult;
    });

    if (!claimResult.committed) {
      throw new HttpsError(
        "failed-precondition",
        "Round is already finalized."
      );
    }

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
      "currentRound/eliminatedChampion": eliminatedChampion,
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
          eliminatedChampion,
          startedAt,
          endsAt
        );

        const existingRounds =
          scoresRaw[uid]?.rounds && typeof scoresRaw[uid].rounds === "object" ?
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
      eliminatedChampion,
    };
  }
);
