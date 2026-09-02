import React, { useEffect, useMemo, useState } from 'react'

const WEATHER_CODE_EMOJI = new Map([
  [0, '☀️'], [1, '🌤️'], [2, '⛅'], [3, '☁️'],
  [45, '🌫️'], [48, '🌫️'],
  [51, '🌦️'], [53, '🌦️'], [55, '🌧️'], [56, '🌧️'], [57, '🌧️'],
  [61, '🌧️'], [63, '🌧️'], [65, '🌧️'], [66, '🌧️'], [67, '🌧️'],
  [71, '🌨️'], [73, '🌨️'], [75, '❄️'], [77, '❄️'],
  [80, '🌦️'], [81, '🌧️'], [82, '⛈️'],
  [85, '🌨️'], [86, '🌨️'],
  [95, '⛈️'], [96, '⛈️'], [99, '⛈️'],
])

const weatherEmoji = (code) => WEATHER_CODE_EMOJI.get(code) || '☀️'

const TIMEZONE = 'Asia/Shanghai'
const LOCATION = { name: '西安', lat: 34.3416, lon: 108.9398 }

const tzParts = (date) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'long',
  })
  const parts = fmt.formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: get('weekday'),
  }
}

const Clock = ({ isDashboard = false, mirrored = false }) => {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState({ temp: '--', emoji: '☀️', loaded: false })

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let active = true
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}&current_weather=true`
        )
        const data = await res.json()
        if (data?.current_weather && active) {
          setWeather({
            temp: Math.round(data.current_weather.temperature),
            emoji: weatherEmoji(data.current_weather.weathercode),
            loaded: true,
          })
        }
      } catch (err) {
        if (active) console.warn('Weather fetch failed:', err)
      }
    }
    fetchWeather()
    const id = setInterval(fetchWeather, 10 * 60 * 1000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const t = useMemo(() => tzParts(now), [now])

  const hoursMinutes = useMemo(() => {
    return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
  }, [t.hour, t.minute])

  const bottomDateStr = useMemo(() => {
    return `${t.weekday} ${t.year}`
  }, [t.weekday, t.year])

  return (
    <div
      className={`absolute bottom-10 pointer-events-auto z-20 select-none font-gilroy awwwards-motion ${
        mirrored ? 'right-10 origin-bottom-right items-end text-right' : 'left-10 origin-bottom-left items-start text-left'
      } ${isDashboard ? 'scale-[0.48]' : 'scale-100'} flex flex-col`}
    >
      {/*
        Time digits: glass effect on the glyphs themselves.
        - No box, no border, no shadow halo (the text-shadow blur that made
          the digits "glow" is gone — clean glass, not neon).
        - The gradient is clipped to the glyphs so each character looks like a
          piece of frosted glass letting the wallpaper show through.
        - Tracking is subtle (0.01em) — the user found 0.08em too airy.
      */}
      <h1
        className='font-heathergreen text-[36vh] leading-[0.9] clock-time'
        style={{
          color: 'rgba(255, 255, 255, 0.62)',
          letterSpacing: '0.01em',
          backgroundImage:
            'linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.35) 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 500,
        }}
      >
        {hoursMinutes}
      </h1>

      <div className='clock-sub flex items-center gap-4 mt-1.5 text-sm md:text-base font-gilroy-medium'>
        <span>{bottomDateStr}</span>
        <div className='flex items-center gap-1.5'>
          <span>{weather.emoji}</span>
          <span>{weather.temp}°C</span>
          <span className='text-[10px] opacity-70 ml-1'>{LOCATION.name}</span>
        </div>
      </div>
    </div>
  )
}

export default Clock
