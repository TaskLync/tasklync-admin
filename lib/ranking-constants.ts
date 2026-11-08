// lib/ranking-constants.ts  (edge safe)
// Mirrors RANKING_TERMS / DEFAULT_PARAMS in search-service (03 §6). search-service clamps everything again.

export const RANKING_TERMS = [
  'relevance', 'quality', 'distance', 'response', 'activity', 'availability', 'recency',
  'reliability', 'cancellation', 'satisfaction', 'experience', 'trust', 'newcomer',
] as const
export type RankingTerm = (typeof RANKING_TERMS)[number]

export const TERM_LABEL: Record<RankingTerm, string> = {
  relevance: 'Relevance (text match)', quality: 'Quality (Bayesian rating)', distance: 'Distance',
  response: 'Response time', activity: 'Recent activity', availability: 'Availability',
  recency: 'Review recency', reliability: 'Reliability (acceptance + completion)',
  cancellation: 'Cancellation / no-show', satisfaction: 'Satisfaction (4+ star share)',
  experience: 'Experience (jobs done)', trust: 'Trust (badges, repeat customers)', newcomer: 'Newcomer lift',
}

/** version 2 seed from search migration 007 */
export const DEFAULT_WEIGHTS: Record<RankingTerm, number> = {
  relevance: 0.22, quality: 0.16, distance: 0.16, reliability: 0.08, cancellation: 0.05, satisfaction: 0.05,
  response: 0.05, activity: 0.05, availability: 0.04, recency: 0.03, experience: 0.04, trust: 0.04, newcomer: 0.03,
}

export interface ParamField {
  path: string // dot path inside params
  group: string
  label: string
  def: number
  min: number
  max: number
  step: number
}

const f = (group: string, path: string, label: string, def: number, min: number, max: number, step: number): ParamField =>
  ({ group, path, label, def, min, max, step })

export const PARAM_FIELDS: ParamField[] = [
  f('Boost (points of 100)', 'boost.capPoints', 'Total boost cap', 8, 0, 15, 0.5),
  f('Boost (points of 100)', 'boost.promoPointsPerPct', 'Points per 1% effective discount', 0.4, 0, 2, 0.05),
  f('Boost (points of 100)', 'boost.featured', 'Featured worker', 3, 0, 15, 0.5),
  f('Boost (points of 100)', 'boost.topRated', 'Top rated badge', 2, 0, 15, 0.5),
  f('Boost (points of 100)', 'boost.backgroundVerified', 'Background verified badge', 1, 0, 15, 0.5),
  f('Boost gate (boost only applies above)', 'gate.quality', 'Quality at least', 0.7, 0, 1, 0.01),
  f('Boost gate (boost only applies above)', 'gate.reliability', 'Reliability at least', 0.7, 0, 1, 0.01),
  f('Boost gate (boost only applies above)', 'gate.relevance', 'Relevance at least (text search)', 0.15, 0, 1, 0.01),
  f('Diversity (first page)', 'diversity.window', 'Re-ordered window (results)', 40, 10, 100, 5),
  f('Diversity (first page)', 'diversity.topN', 'Top N checked', 10, 3, 20, 1),
  f('Diversity (first page)', 'diversity.maxBoostedInTopN', 'Max boosted in top N', 4, 0, 20, 1),
  f('Diversity (first page)', 'diversity.maxNewcomerBoostedInTop3', 'Max boosted newcomers in top 3', 1, 0, 3, 1),
  f('Quality floors', 'floors.minReviews', 'Minimum reviews before floors apply', 5, 0, 100, 1),
  f('Quality floors', 'floors.quality.below', 'Soft floor below quality', 0.7, 0, 1, 0.01),
  f('Quality floors', 'floors.quality.multiplier', 'Soft floor multiplier', 0.85, 0.2, 1, 0.01),
  f('Quality floors', 'floors.hardQuality.below', 'Hard floor below quality', 0.6, 0, 1, 0.01),
  f('Quality floors', 'floors.hardQuality.multiplier', 'Hard floor multiplier', 0.65, 0.2, 1, 0.01),
  f('Reliability floor', 'floors.reliability.below', 'Floor below reliability', 0.7, 0, 1, 0.01),
  f('Reliability floor', 'floors.reliability.multiplier', 'Floor multiplier', 0.85, 0.2, 1, 0.01),
  f('Reliability floor', 'floors.reliability.minDecided', 'Minimum recent jobs before it applies', 5, 0, 100, 1),
  f('Priors (Bayesian smoothing)', 'reliability.acceptancePrior', 'Acceptance prior', 0.85, 0, 1, 0.01),
  f('Priors (Bayesian smoothing)', 'reliability.completionPrior', 'Completion prior', 0.95, 0, 1, 0.01),
  f('Priors (Bayesian smoothing)', 'reliability.priorWeight', 'Reliability prior weight', 8, 0, 100, 1),
  f('Priors (Bayesian smoothing)', 'cancellation.priorRate', 'Cancellation prior rate', 0.03, 0, 1, 0.01),
  f('Priors (Bayesian smoothing)', 'cancellation.priorWeight', 'Cancellation prior weight', 8, 0, 100, 1),
  f('Priors (Bayesian smoothing)', 'cancellation.badAtRate', 'Cancellation rate that scores 0', 0.25, 0.05, 1, 0.01),
  f('Priors (Bayesian smoothing)', 'satisfaction.priorMean', 'Satisfaction prior', 0.85, 0, 1, 0.01),
  f('Priors (Bayesian smoothing)', 'satisfaction.priorWeight', 'Satisfaction prior weight', 6, 0, 100, 1),
  f('Experience and newcomers', 'experience.fullAtJobs', 'Jobs for full experience score', 100, 10, 2000, 10),
  f('Experience and newcomers', 'newcomer.untilJobs', 'Newcomer until this many jobs', 10, 1, 100, 1),
]

export const PARAM_GROUPS = Array.from(new Set(PARAM_FIELDS.map((p) => p.group)))

// ---- tiny path helpers (params are nested objects) ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPath(obj: any, path: string): unknown {
  return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}
export function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cur[keys[i]]
    cur[keys[i]] = next && typeof next === 'object' ? next : {}
    cur = cur[keys[i]] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
}

export const FLAG_TYPES = ['EDITORIAL_BOOST', 'QUALITY_PENALTY', 'FRAUD_SUSPECT', 'COLLUSION_SUSPECT', 'MANUAL_OTHER'] as const
export type FlagType = (typeof FLAG_TYPES)[number]
export const FLAG_LABEL: Record<FlagType, string> = {
  EDITORIAL_BOOST: 'Editorial boost', QUALITY_PENALTY: 'Quality penalty', FRAUD_SUSPECT: 'Fraud suspect',
  COLLUSION_SUSPECT: 'Collusion suspect', MANUAL_OTHER: 'Other (manual)',
}