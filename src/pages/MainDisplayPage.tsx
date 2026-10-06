import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import {
  subscribeToCurrentRoundForDisplay,
  subscribeToCurrentRoundVotes,
  subscribeToRegisteredCount,
} from '../services/display'
import { subscribeToFinalResult, subscribeToLeaderboard, subscribeToTiebreak } from '../services/game'
import { CHAMPIONS, EMPTY_CHAMPION_VOTE_TOTALS, championMap, type ChampionVoteTotals } from '../types/champion'
import type { FinalTopFiveEntry } from '../types/finalResult'
import type { LeaderboardEntry } from '../types/leaderboard'
import type { Round } from '../types/round'
import type { Tiebreak } from '../types/tiebreak'

// Fixed positioning escapes the width-constrained #root to fill the viewport.
const containerStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#000',
  color: '#fff',
  textAlign: 'center',
  fontFamily: 'system-ui, sans-serif',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '6vmin',
  letterSpacing: '0.1em',
}

const countStyle: CSSProperties = {
  margin: 0,
  fontSize: '40vmin',
  fontWeight: 700,
  lineHeight: 1,
}

const votesRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '1rem',
  width: 'min(1200px, 100%)',
  marginTop: '2rem',
  padding: '0 2rem',
}

const voteCardStyle: CSSProperties = {
  border: '1px solid #374151',
  borderRadius: '12px',
  padding: '1.25rem',
  background: '#111827',
}

const championNameStyle: CSSProperties = {
  margin: 0,
  fontSize: '2rem',
  letterSpacing: '0.04em',
}

const voteCountStyle: CSSProperties = {
  margin: '0.75rem 0 0',
  fontSize: '4rem',
  fontWeight: 700,
  lineHeight: 1,
}

const labelStyle: CSSProperties = {
  margin: 0,
  fontSize: '5vmin',
  letterSpacing: '0.1em',
}

const eliminatedTitleStyle: CSSProperties = {
  margin: '1.5rem 0 0',
  fontSize: '4vmin',
  letterSpacing: '0.2em',
  fontWeight: 700,
}

const eliminatedChampionStyle: CSSProperties = {
  margin: '0.5rem 0 0',
  fontSize: '10vmin',
  fontWeight: 700,
  lineHeight: 1.1,
}

const leaderboardWrapStyle: CSSProperties = {
  width: 'min(1200px, 100%)',
  marginTop: '2rem',
  padding: '0 2rem',
}

const leaderboardTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#111827',
  borderRadius: '12px',
  overflow: 'hidden',
}

const leaderboardHeaderCellStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #374151',
  fontSize: '1.4rem',
}

const leaderboardCellStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #1f2937',
  fontSize: '1.5rem',
}

const selfieStyle: CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  objectFit: 'cover',
  border: '1px solid #4b5563',
  background: '#0f172a',
}

const finalTitleStyle: CSSProperties = {
  margin: '1rem 0 0',
  fontSize: '6vmin',
  letterSpacing: '0.12em',
  fontWeight: 700,
}

const finalSubtitleStyle: CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '2.4vmin',
  letterSpacing: '0.08em',
}

function MainDisplayPage() {
  const [count, setCount] = useState(0)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [voteTotals, setVoteTotals] = useState<ChampionVoteTotals>(EMPTY_CHAMPION_VOTE_TOTALS)
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [leaderboardRoundNumber, setLeaderboardRoundNumber] = useState<number | null>(null)
  const [finalTopFive, setFinalTopFive] = useState<FinalTopFiveEntry[]>([])
  const [finalResultStatus, setFinalResultStatus] = useState<string | null>(null)
  const [tiebreak, setTiebreak] = useState<Tiebreak | null>(null)

  useEffect(() => subscribeToRegisteredCount(setCount), [])
  useEffect(() => subscribeToCurrentRoundForDisplay(setCurrentRound), [])
  useEffect(() => subscribeToCurrentRoundVotes(setVoteTotals), [])
  useEffect(
    () =>
      subscribeToLeaderboard((leaderboard) => {
        setLeaderboardRoundNumber(leaderboard?.roundNumber ?? null)
        setLeaderboardEntries(leaderboard?.entries ?? [])
      }),
    [],
  )
  useEffect(
    () =>
      subscribeToFinalResult((finalResult) => {
        setFinalResultStatus(finalResult?.status ?? null)
        setFinalTopFive(finalResult?.topFive ?? [])
      }),
    [],
  )
  useEffect(() => subscribeToTiebreak(setTiebreak), [])

  function isScoringRound(roundNumber: number): boolean {
    return roundNumber === 2 || roundNumber === 3 || roundNumber === 4
  }

  function renderLeaderboardTable(entries: LeaderboardEntry[]) {
    return (
      <div style={leaderboardWrapStyle}>
        <table style={leaderboardTableStyle}>
          <thead>
            <tr>
              <th style={leaderboardHeaderCellStyle}>Rank</th>
              <th style={leaderboardHeaderCellStyle}>Selfie</th>
              <th style={leaderboardHeaderCellStyle}>Nickname</th>
              <th style={leaderboardHeaderCellStyle}>Score</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.uid}>
                <td style={leaderboardCellStyle}>{entry.rank}</td>
                <td style={leaderboardCellStyle}>
                  {entry.selfieUrl
                    ? <img src={entry.selfieUrl} alt={entry.nickname} style={selfieStyle} />
                    : <div style={selfieStyle} />}
                </td>
                <td style={leaderboardCellStyle}>{entry.nickname}</td>
                <td style={leaderboardCellStyle}>{entry.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderFinalTopFiveTable(entries: FinalTopFiveEntry[]) {
    return (
      <div style={leaderboardWrapStyle}>
        <table style={leaderboardTableStyle}>
          <thead>
            <tr>
              <th style={leaderboardHeaderCellStyle}>Rank</th>
              <th style={leaderboardHeaderCellStyle}>Selfie</th>
              <th style={leaderboardHeaderCellStyle}>Nickname</th>
              <th style={leaderboardHeaderCellStyle}>Score</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.uid}>
                <td style={leaderboardCellStyle}>{entry.finalRank}</td>
                <td style={leaderboardCellStyle}>
                  {entry.selfieUrl
                    ? <img src={entry.selfieUrl} alt={entry.nickname} style={selfieStyle} />
                    : <div style={selfieStyle} />}
                </td>
                <td style={leaderboardCellStyle}>{entry.nickname}</td>
                <td style={leaderboardCellStyle}>{entry.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderTiebreakVotes() {
    const tiebreakVoteTotals = tiebreak?.voteTotals ?? EMPTY_CHAMPION_VOTE_TOTALS

    return (
      <div style={votesRowStyle}>
        {CHAMPIONS.map((champion) => (
          <article key={champion.id} style={voteCardStyle}>
            <p style={championNameStyle}>{champion.displayName}</p>
            <p style={voteCountStyle}>{tiebreakVoteTotals[champion.id] ?? 0}</p>
          </article>
        ))}
      </div>
    )
  }

  function renderVotes() {
    return (
      <div style={votesRowStyle}>
        {CHAMPIONS.map((champion) => (
          <article key={champion.id} style={voteCardStyle}>
            <p style={championNameStyle}>{champion.displayName}</p>
            <p style={voteCountStyle}>{voteTotals[champion.id] ?? 0}</p>
          </article>
        ))}
      </div>
    )
  }

  function renderRoundContent() {
    if (finalResultStatus === 'finalized' && finalTopFive.length > 0) {
      return (
        <>
          <p style={finalTitleStyle}>FINAL TOP 5</p>
          {renderFinalTopFiveTable(finalTopFive.slice(0, 5))}
        </>
      )
    }

    if (finalResultStatus === 'tiebreak_required') {
      if (tiebreak?.status === 'voting' || tiebreak?.status === 'closed') {
        return (
          <>
            <p style={finalTitleStyle}>TIEBREAK REQUIRED</p>
            <p style={finalSubtitleStyle}>Live Tiebreak Votes</p>
            {renderTiebreakVotes()}
          </>
        )
      }

      if (tiebreak?.status === 'countdown') {
        return (
          <>
            <p style={finalTitleStyle}>TIEBREAK REQUIRED</p>
            <p style={finalSubtitleStyle}>Tiebreak starts in...</p>
          </>
        )
      }

      return (
        <>
          <p style={finalTitleStyle}>TIEBREAK REQUIRED</p>
          <p style={finalSubtitleStyle}>Preparing final ranking...</p>
        </>
      )
    }

    if (!currentRound || currentRound.status === 'registration') {
      return (
        <>
          <p style={countStyle}>{count}</p>
          <p style={labelStyle}>PLAYERS REGISTERED</p>
        </>
      )
    }

    if (currentRound.status === 'countdown') {
      return <p style={labelStyle}>Get Ready</p>
    }

    if (currentRound.status === 'voting') {
      return (
        <>
          <p style={labelStyle}>Live Votes</p>
          {renderVotes()}
        </>
      )
    }

    if (currentRound.status === 'closed') {
      return (
        <>
          <p style={labelStyle}>Voting Closed</p>
          {renderVotes()}
        </>
      )
    }

    if (currentRound.status === 'result') {
      const hasLeaderboardForRound =
        isScoringRound(currentRound.roundNumber) &&
        leaderboardRoundNumber === currentRound.roundNumber

      if (hasLeaderboardForRound) {
        const topTen = leaderboardEntries.slice(0, 10)

        if (currentRound.roundNumber === 4) {
          return (
            <>
              <p style={finalTitleStyle}>FINAL LEADERBOARD</p>
              <p style={finalSubtitleStyle}>Top 5</p>
              {renderLeaderboardTable(topTen.slice(0, 5))}
            </>
          )
        }

        return (
          <>
            <p style={labelStyle}>Leaderboard</p>
            {renderLeaderboardTable(topTen)}
          </>
        )
      }

      const eliminatedName = currentRound.eliminatedChampion
        ? championMap[currentRound.eliminatedChampion].displayName
        : 'Pending'
      const roundLabel = `Round ${currentRound.roundNumber} Result`

      return (
        <>
          <p style={labelStyle}>{roundLabel}</p>
          <p style={eliminatedTitleStyle}>ELIMINATED</p>
          <p style={eliminatedChampionStyle}>{eliminatedName}</p>
          {renderVotes()}
        </>
      )
    }

    return <p style={labelStyle}>Round state unavailable</p>
  }

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>CHAMPION GAME 2026</h1>
      {renderRoundContent()}
    </div>
  )
}

export default MainDisplayPage
