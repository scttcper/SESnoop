import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

type Source = {
  id: number
  name: string
}

type OverviewResponse = {
  source_id: number
  range: {
    from: string
    to: string
  }
  metrics: {
    sent: number
    delivered: number
    bounced: number
    complaints: number
    opens: number
    clicks: number
    sent_today: number
    unique_opens: number
    unique_clicks: number
    bounce_rate: number
    complaint_rate: number
    open_rate: number
    click_rate: number
  }
  chart: {
    days: string[]
    sent: number[]
    delivered: number[]
    bounced: number[]
  }
  bounce_breakdown: Array<{
    bounce_type: string
    count: number
  }>
}

const formatPercent = (value: number) =>
  `${(value * 100).toFixed(1)}%`

export default function DashboardPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [sourceId, setSourceId] = useState<number | null>(null)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSources = async () => {
      try {
        const response = await fetch('/api/sources')
        if (!response.ok) {
          throw new Error('Failed to load sources')
        }
        const data = (await response.json()) as Source[]
        setSources(data)
        if (data.length > 0) {
          setSourceId((prev) => prev ?? data[0].id)
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      }
    }

    void loadSources()
  }, [])

  useEffect(() => {
    const loadOverview = async () => {
      if (!sourceId) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/sources/${sourceId}/overview`)
        if (!response.ok) {
          throw new Error('Failed to load overview')
        }
        const data = (await response.json()) as OverviewResponse
        setOverview(data)
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    void loadOverview()
  }, [sourceId])

  const chartMax = useMemo(() => {
    if (!overview) {
      return 0
    }
    return Math.max(
      ...overview.chart.sent,
      ...overview.chart.delivered,
      ...overview.chart.bounced,
      1
    )
  }, [overview])

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Source overview</p>
          <h1>Dashboard metrics</h1>
        </div>
        <div className="topbar-actions">
          <Link className="button ghost" to="/events">
            Events
          </Link>
          <button
            className="button primary"
            type="button"
            onClick={() => sourceId && setSourceId(sourceId)}
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Summary</h2>
          <span className="meta">
            {loading
              ? 'Loading…'
              : overview
              ? `${overview.range.from} → ${overview.range.to}`
              : '—'}
          </span>
        </div>
        {error ? <p className="notice error">{error}</p> : null}
        <div className="filters">
          <label className="field">
            <span>Source</span>
            <select
              className="input"
              value={sourceId ?? ''}
              onChange={(event) => setSourceId(Number(event.target.value))}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {overview ? (
          <div className="overview">
            <div className="stat">
              <span className="label">Sent</span>
              <span>{overview.metrics.sent}</span>
            </div>
            <div className="stat">
              <span className="label">Delivered</span>
              <span>{overview.metrics.delivered}</span>
            </div>
            <div className="stat">
              <span className="label">Bounced</span>
              <span>{overview.metrics.bounced}</span>
            </div>
            <div className="stat">
              <span className="label">Complaints</span>
              <span>{overview.metrics.complaints}</span>
            </div>
            <div className="stat">
              <span className="label">Sent today</span>
              <span>{overview.metrics.sent_today}</span>
            </div>
            <div className="stat">
              <span className="label">Bounce rate</span>
              <span>{formatPercent(overview.metrics.bounce_rate)}</span>
            </div>
          </div>
        ) : null}
      </section>

      {overview ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Daily volume</h2>
          </div>
          <div className="chart">
            {overview.chart.days.map((day, index) => (
              <div key={day} className="chart-col">
                <div
                  className="chart-bar sent"
                  style={{ height: `${(overview.chart.sent[index] / chartMax) * 100}%` }}
                  title={`Sent ${overview.chart.sent[index]}`}
                />
                <div
                  className="chart-bar delivered"
                  style={{ height: `${(overview.chart.delivered[index] / chartMax) * 100}%` }}
                  title={`Delivered ${overview.chart.delivered[index]}`}
                />
                <div
                  className="chart-bar bounced"
                  style={{ height: `${(overview.chart.bounced[index] / chartMax) * 100}%` }}
                  title={`Bounced ${overview.chart.bounced[index]}`}
                />
                <span className="chart-label">{day.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {overview ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Engagement</h2>
          </div>
          <div className="overview">
            <div className="stat">
              <span className="label">Opens</span>
              <span>{overview.metrics.opens}</span>
            </div>
            <div className="stat">
              <span className="label">Clicks</span>
              <span>{overview.metrics.clicks}</span>
            </div>
            <div className="stat">
              <span className="label">Unique opens</span>
              <span>{overview.metrics.unique_opens}</span>
            </div>
            <div className="stat">
              <span className="label">Unique clicks</span>
              <span>{overview.metrics.unique_clicks}</span>
            </div>
            <div className="stat">
              <span className="label">Open rate</span>
              <span>{formatPercent(overview.metrics.open_rate)}</span>
            </div>
            <div className="stat">
              <span className="label">Click rate</span>
              <span>{formatPercent(overview.metrics.click_rate)}</span>
            </div>
          </div>
        </section>
      ) : null}

      {overview ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Bounce breakdown</h2>
          </div>
          <div className="breakdown">
            {overview.bounce_breakdown.map((row) => (
              <div key={row.bounce_type} className="breakdown-row">
                <span>{row.bounce_type}</span>
                <div className="breakdown-bar">
                  <div
                    style={{
                      width: `${overview.metrics.bounced ? (row.count / overview.metrics.bounced) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span>{row.count}</span>
              </div>
            ))}
            {overview.bounce_breakdown.length === 0 ? (
              <div className="empty">
                <p>No bounce events in this range.</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
