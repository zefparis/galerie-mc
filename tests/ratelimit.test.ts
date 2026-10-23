import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le pool pg est mocké : `attempts` simule la table login_attempts.
const state = vi.hoisted(() => ({
  attempts: [] as { ip: string; at: number }[],
}))

vi.mock('../lib/db', () => ({
  default: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('DELETE FROM login_attempts WHERE ip')) {
        state.attempts = state.attempts.filter((a) => a.ip !== params?.[0])
        return { rows: [], rowCount: 0 }
      }
      if (sql.startsWith('DELETE FROM login_attempts')) {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        state.attempts = state.attempts.filter((a) => a.at >= cutoff)
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes('count(*)')) {
        const cutoff = Date.now() - 15 * 60 * 1000
        const n = state.attempts.filter(
          (a) => a.ip === params?.[0] && a.at > cutoff
        ).length
        return { rows: [{ n }], rowCount: 1 }
      }
      if (sql.startsWith('INSERT INTO login_attempts')) {
        state.attempts.push({ ip: params?.[0] as string, at: Date.now() })
        return { rows: [], rowCount: 1 }
      }
      throw new Error(`SQL inattendue : ${sql}`)
    }),
  },
}))

import pool from '../lib/db'
import {
  clearLoginAttempts,
  isLoginRateLimited,
  isRateLimited,
  recordLoginFailure,
} from '../lib/ratelimit'

const queryMock = vi.mocked(pool.query)

describe('rate limit login (Postgres, login_attempts)', () => {
  beforeEach(() => {
    state.attempts = []
    queryMock.mockClear()
  })

  it('bloque à la 6e tentative échouée en 15 min', async () => {
    const ip = '1.2.3.4'
    for (let i = 0; i < 5; i++) {
      expect(await isLoginRateLimited(ip)).toBe(false)
      await recordLoginFailure(ip)
    }
    expect(await isLoginRateLimited(ip)).toBe(true)
  })

  it('remet le compteur à zéro après un succès', async () => {
    const ip = '5.6.7.8'
    for (let i = 0; i < 5; i++) await recordLoginFailure(ip)
    expect(await isLoginRateLimited(ip)).toBe(true)

    await clearLoginAttempts(ip)
    expect(await isLoginRateLimited(ip)).toBe(false)
  })

  it("ignore les échecs de plus de 15 min (fenêtre glissante)", async () => {
    const ip = '9.9.9.9'
    for (let i = 0; i < 5; i++) {
      state.attempts.push({ ip, at: Date.now() - 16 * 60 * 1000 })
    }
    expect(await isLoginRateLimited(ip)).toBe(false)
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining(`interval '15 minutes'`),
      [ip]
    )
  })

  it('isole les compteurs par IP', async () => {
    for (let i = 0; i < 5; i++) await recordLoginFailure('4.4.4.4')
    expect(await isLoginRateLimited('4.4.4.4')).toBe(true)
    expect(await isLoginRateLimited('4.4.4.5')).toBe(false)
  })

  it('purge les lignes de plus de 24 h à chaque appel', async () => {
    state.attempts.push({ ip: '3.3.3.3', at: Date.now() - 25 * 60 * 60 * 1000 })
    await isLoginRateLimited('3.3.3.3')
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining(`interval '24 hours'`)
    )
    expect(state.attempts).toHaveLength(0)
  })

  it('fail closed : une erreur DB refuse la connexion', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'))
    expect(await isLoginRateLimited('8.8.8.8')).toBe(true)
  })
})

describe('rate limit mémoire (contact, admin)', () => {
  it('bloque après la limite dans la fenêtre', () => {
    const key = `test:${Date.now()}`
    for (let i = 0; i < 5; i++) expect(isRateLimited(key, 5)).toBe(false)
    expect(isRateLimited(key, 5)).toBe(true)
  })
})
