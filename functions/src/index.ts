import {initializeApp} from "firebase-admin/app";
import {getDatabase, ServerValue} from "firebase-admin/database";
import {setGlobalOptions} from "firebase-functions";
import {HttpsError, onCall} from "firebase-functions/v2/https";

setGlobalOptions({maxInstances: 10});

initializeApp();

type ChampionId = "heracles" | "achilles" | "perseus" | "theseus";

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
}

interface Submission {
    uid: string;
    championId: ChampionId;
    submittedAt: object;
}

interface GameRoot {
    currentRound?: CurrentRound;
    submissions?: Record<string, Record<string, Submission>>;
    live?: {
        currentRoundVotes?: Record<string, number>;
    };
}

interface RoundRecord {
  roundNumber: number;
  isDemo: boolean;
  status: "countdown" | "voting" | "closed" | "result" | "registration";
  startedAt: number | null;
  endsAt: number | null;
  eliminatedChampion: ChampionId | null;
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
    let abortedBecauseAlreadySubmitted = false;

    try {
      const transactionResult = await gameRef.transaction((current) => {
        const game = (current ?? {}) as GameRoot;
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
    let abortedBecauseRoundAlreadyExists = false;

    const creationResult = await gameRef.transaction((current) => {
      const game = (current ?? {}) as GameRoot;
      if (game.currentRound) {
        abortedBecauseRoundAlreadyExists = true;
        return;
      }

      const currentRound: RoundRecord = {
        roundNumber: 1,
        isDemo: true,
        status: "countdown",
        startedAt: null,
        endsAt: null,
        eliminatedChampion: null,
      };

      return {
        ...game,
        currentRound,
        live: {
          ...(game.live ?? {}),
          currentRoundVotes: {
            heracles: 0,
            achilles: 0,
            perseus: 0,
            theseus: 0,
          },
        },
      };
    });

    if (!creationResult.committed) {
      if (abortedBecauseRoundAlreadyExists) {
        throw new HttpsError(
          "already-exists",
          "A round is already active."
        );
      }

      throw new HttpsError(
        "failed-precondition",
        "Demo round could not be started."
      );
    }

    await waitFor(3000);

    const currentRoundRef = getDatabase().ref(`games/${gameId}/currentRound`);
    const votingResult = await currentRoundRef.transaction((current) => {
      if (!current || typeof current !== "object") {
        throw new HttpsError(
          "failed-precondition",
          "No current round is available."
        );
      }

      const round = current as RoundRecord;
      if (round.status !== "countdown") {
        return;
      }

      const startedAt = Date.now();
      return {
        ...round,
        status: "voting",
        startedAt,
        endsAt: startedAt + 20000,
      };
    });

    if (!votingResult.committed) {
      throw new HttpsError(
        "failed-precondition",
        "Demo round countdown could not transition to voting."
      );
    }

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
    const closeResult = await currentRoundRef.transaction((current) => {
      if (!current || typeof current !== "object") {
        throw new HttpsError(
          "failed-precondition",
          "No current round is available."
        );
      }

      const round = current as RoundRecord;
      if (round.status !== "voting") {
        throw new HttpsError(
          "failed-precondition",
          "Voting is not currently open."
        );
      }

      return {
        ...round,
        status: "closed",
      };
    });

    if (!closeResult.committed) {
      throw new HttpsError(
        "failed-precondition",
        "Voting could not be closed."
      );
    }

    return {ok: true};
  }
);
