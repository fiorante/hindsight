import { telemetryRepository } from '../api/repositories'

/**
 * Build a Set of valid telemetry parameter names from the repository.
 * These are the canonical strings accepted by the backend.
 */
export const getRepoParameterSet = (): Set<string> => {
  const params = telemetryRepository
    .getAvailableParameters()
    .map((p) => (p.parameter || '').toLowerCase())
  return new Set(params)
}

/**
 * Normalize an arbitrary parameter string to a canonical telemetry parameter
 * recognizable by the backend. Returns null if no valid normalization exists.
 *
 * Rules:
 * - Exact match wins
 * - Motor parameters (contain a dot) are normalized to UPPERCASE (e.g., DRIVE_LF.ANGLE)
 * - Non-motor parameters are normalized to lowercase (e.g., slope, tilt, terrain)
 */
export const normalizeToTelemetryParameter = (rawParam: string, repoParamSet?: Set<string>): string | null => {
  const repoSet = repoParamSet ?? getRepoParameterSet()
  const param = (rawParam ?? '').trim()
  if (!param) return null

  // Canonical form for transit/storage is lowercase
  const lower = param.toLowerCase()
  if (repoSet.has(lower)) return lower
  return null
}

/**
 * Validate a list of parameters, returning only those that can be normalized.
 */
export const sanitizeInitialParameters = (params: string[]): string[] => {
  const repoSet = getRepoParameterSet()
  const unique: string[] = []
  const seen = new Set<string>()
  for (const p of params ?? []) {
    const normalized = normalizeToTelemetryParameter(p, repoSet)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      unique.push(normalized)
    }
  }
  return unique
}


