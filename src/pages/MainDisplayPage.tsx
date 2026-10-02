import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import {
  subscribeToCurrentRoundForDisplay,
  subscribeToCurrentRoundVotes,
  subscribeToRegisteredCount,
} from '../services/display'
import { CHAMPIONS, EMPTY_CHAMPION_VOTE_TOTALS, championMap, type ChampionVoteTotals } from '../types/champion'
import type { Round } from '../types/round'

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

function MainDisplayPage() {
  const [count, setCount] = useState(0)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [voteTotals, setVoteTotals] = useState<ChampionVoteTotals>(EMPTY_CHAMPION_VOTE_TOTALS)

  useEffect(() => subscribeToRegisteredCount(setCount), [])
  useEffect(() => subscribeToCurrentRoundForDisplay(setCurrentRound), [])
  useEffect(() => subscribeToCurrentRoundVotes(setVoteTotals), [])

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
      const eliminatedName = currentRound.eliminatedChampion
        ? championMap[currentRound.eliminatedChampion].displayName
        : 'Pending'

      return (
        <>
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
