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
