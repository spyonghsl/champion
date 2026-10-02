import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { subscribeToRegisteredCount } from '../services/display'

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

const labelStyle: CSSProperties = {
  margin: 0,
  fontSize: '5vmin',
  letterSpacing: '0.1em',
}

function MainDisplayPage() {
  const [count, setCount] = useState(0)

  useEffect(() => subscribeToRegisteredCount(setCount), [])

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>CHAMPION GAME 2026</h1>
      <p style={countStyle}>{count}</p>
      <p style={labelStyle}>PLAYERS REGISTERED</p>
    </div>
  )
}

export default MainDisplayPage
