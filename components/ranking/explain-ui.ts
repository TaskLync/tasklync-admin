// components/ranking/explain-ui.ts
import type { RankingTerm } from '@/lib/ranking-constants'

export const TERM_HELP: Record<RankingTerm, string> = {
  relevance: 'How well the worker matches the search words (name, skills, small typos). Not used when there is no search text.',
  quality: 'Star rating, smoothed so a few reviews cannot swing it. 5 stars = 100%.',
  distance: 'Closer to the customer scores higher. Not used without a location.',
  response: 'Faster average replies score higher (120 minutes or more = 0%).',
  activity: 'Seen in the app recently. Falls to 0% after 8 days.',
  availability: 'Free right now = 100%, on a job = 0%.',
  recency: 'Has a recent review (fades over 180 days).',
  reliability: 'Accepts requests and finishes the jobs they accept (recent jobs count more).',
  cancellation: 'Fewer worker cancellations and no-shows score higher.',
  satisfaction: 'Share of 4 and 5 star reviews.',
  experience: 'Jobs completed, with diminishing returns.',
  trust: 'Background verified, verified company, repeat customers.',
  newcomer: 'Extra lift for brand-new workers, fades by about 10 jobs. Never for flagged workers.',
}

export const NOT_APPLIED_TEXT: Record<string, string> = {
  NO_SEARCH_TEXT: 'Not used: no search text',
  NO_LOCATION: 'Not used: no location in this search',
  WEIGHT_ZERO: 'Not used: weight is 0 in this version',
}

export const GATE_LABEL: Record<string, string> = {
  quality: 'Quality',
  reliability: 'Reliability',
  relevance: 'Relevance to the search text',
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const REASON_TEXT: Record<string, { label: string; text: string }> = {
  NOT_VISIBLE: { label: 'Hidden from search', text: 'The worker is paused, suspended, not verified, or not seen for 8 days, so customers do not see them at all.' },
  NOT_MATCHING_FILTERS: { label: 'Does not match this search', text: 'The worker does not match the category, city, text or location typed above, so they would not appear in these results.' },
  FEATURED: { label: 'Featured', text: 'An editorial featured flag adds boost points.' },
  TOP_RATED: { label: 'Top rated badge', text: 'The Top Rated badge adds boost points.' },
  BACKGROUND_VERIFIED: { label: 'Background verified', text: 'The Background Verified badge adds boost points.' },
  PROMO_BOOST: { label: 'Offer boost', text: 'A live automatic offer adds boost points.' },
  BOOST_GATED: { label: 'Boost blocked', text: 'The worker has boost points, but quality, reliability or relevance is below the required level, so none are applied.' },
  BOOST_CAPPED: { label: 'Boost capped', text: 'Boost points hit the maximum, extra points are ignored.' },
  NEWCOMER: { label: 'Newcomer lift', text: 'A new worker gets a small extra score that fades after about 10 jobs.' },
  QUALITY_FLOOR: { label: 'Low rating penalty', text: 'The rating is below the quality floor, so the score is multiplied down.' },
  RELIABILITY_FLOOR: { label: 'Low reliability penalty', text: 'Too many rejected, cancelled or missed jobs recently, so the score is multiplied down.' },
  RANKING_FLAG_PENALTY: { label: 'Admin or system penalty', text: 'An active ranking flag lowers the score. See the flags on the worker page.' },
  RANKING_FLAG_BOOST: { label: 'Admin boost flag', text: 'An active ranking flag raises the score.' },
  BUSY_NOW: { label: 'On a job now', text: 'The worker is busy, so the availability term is 0.' },
  NO_PERFORMANCE_DATA: { label: 'No performance data yet', text: 'worker-service has not produced performance stats yet, so reliability terms use neutral defaults.' },
  DIVERSITY_MOVED_UP: { label: 'Moved up by diversity rules', text: 'The diversity pass reordered the first page and put the worker higher than their raw score position.' },
  DIVERSITY_MOVED_DOWN: { label: 'Moved down by diversity rules', text: 'Too many boosted workers were ahead, so the diversity pass pushed the worker down.' },
}

export const SEVERITY_TONE: Record<string, Tone> = { positive: 'success', negative: 'warning', info: 'info' }

export const pts = (n: number | null | undefined) => (n === null || n === undefined ? 'n/a' : n.toFixed(1))
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? 'n/a' : `${Math.round(n * 100)}%`)
export const mult = (n: number) => `x${n.toFixed(2)}`