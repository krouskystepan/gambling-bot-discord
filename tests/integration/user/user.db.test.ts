import { describe, expect, it, vi } from 'vitest'

import {
  createUserIfNotExists,
  forceCreateUser,
  forceDeleteUser,
  getGuildUserIds,
  getUser,
  previewWithdraw,
  resetUserBalance,
  updateUserBalanceAtomic
} from '@/services/db/user.db'

import { User, createTestUser, setupMongoTests } from '../../helpers/mongo'

setupMongoTests()

describe('user.db', () => {
  it('getUser returns stored user', async () => {
    await createTestUser({ balance: 42 })

    const user = await getUser({ userId: 'user-1', guildId: 'guild-1' })
    expect(user?.balance).toBe(42)
  })

  it('getGuildUserIds returns user ids for a guild', async () => {
    await createTestUser({ userId: 'u-a', guildId: 'guild-1' })
    await createTestUser({ userId: 'u-b', guildId: 'guild-1' })
    await createTestUser({ userId: 'other', guildId: 'guild-2' })

    const ids = await getGuildUserIds({ guildId: 'guild-1' })

    expect(ids).toHaveLength(2)
    expect(ids).toEqual(expect.arrayContaining(['u-a', 'u-b']))
  })

  it('resetUserBalance zeros balances', async () => {
    await createTestUser({ balance: 100, lockedBalance: 20, bonusBalance: 5 })

    const updated = await resetUserBalance({
      userId: 'user-1',
      guildId: 'guild-1'
    })

    expect(updated?.balance).toBe(0)
    expect(updated?.lockedBalance).toBe(0)
    expect(updated?.bonusBalance).toBe(0)
  })

  it('forceCreateUser rethrows non-duplicate errors', async () => {
    const { default: UserModel } = await import('@/models/User')
    const spy = vi
      .spyOn(UserModel, 'create')
      .mockRejectedValueOnce(new Error('db down'))

    await expect(
      forceCreateUser({ userId: 'err-user', guildId: 'guild-1' })
    ).rejects.toThrow('db down')

    spy.mockRestore()
  })

  it('forceCreateUser creates user and returns null on duplicate', async () => {
    const created = await forceCreateUser({
      userId: 'force-user',
      guildId: 'guild-1'
    })
    expect(created?.userId).toBe('force-user')

    const duplicate = await forceCreateUser({
      userId: 'force-user',
      guildId: 'guild-1'
    })
    expect(duplicate).toBeNull()
  })

  it('forceDeleteUser removes user', async () => {
    await createTestUser({ userId: 'del-user', balance: 10 })

    const deleted = await forceDeleteUser({
      userId: 'del-user',
      guildId: 'guild-1'
    })
    expect(deleted?.userId).toBe('del-user')
    expect(await User.countDocuments({ userId: 'del-user' })).toBe(0)
  })

  it('forceDeleteUser returns null when user missing', async () => {
    const deleted = await forceDeleteUser({
      userId: 'missing',
      guildId: 'guild-1'
    })
    expect(deleted).toBeNull()
  })

  describe('previewWithdraw', () => {
    it('returns NO_USER when missing', async () => {
      const result = await previewWithdraw({
        userId: 'missing',
        guildId: 'guild-1',
        amount: 50
      })
      expect(result).toEqual({ ok: false, reason: 'NO_USER' })
    })

    it('returns INSUFFICIENT_BALANCE', async () => {
      await createTestUser({ balance: 30, lockedBalance: 0 })

      const result = await previewWithdraw({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 50
      })
      expect(result).toEqual({
        ok: false,
        reason: 'INSUFFICIENT_BALANCE',
        balance: 30
      })
    })

    it('returns INSUFFICIENT_WITHDRAWABLE when funds are locked', async () => {
      await createTestUser({ balance: 100, lockedBalance: 80 })

      const result = await previewWithdraw({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 50
      })
      expect(result).toEqual({
        ok: false,
        reason: 'INSUFFICIENT_WITHDRAWABLE',
        withdrawable: 20,
        locked: 80
      })
    })

    it('returns ok when withdrawable amount is available', async () => {
      await createTestUser({ balance: 100, lockedBalance: 20 })

      const result = await previewWithdraw({
        userId: 'user-1',
        guildId: 'guild-1',
        amount: 50
      })
      expect(result).toEqual({ ok: true })
    })
  })

  describe('updateUserBalanceAtomic', () => {
    it('increments balance on deposit', async () => {
      await createTestUser({ balance: 100, lockedBalance: 0 })

      const updated = await updateUserBalanceAtomic({
        userId: 'user-1',
        guildId: 'guild-1',
        balanceDelta: 50
      })

      expect(updated?.balance).toBe(150)
      expect(updated!.lockedBalance).toBeLessThanOrEqual(updated!.balance)
    })

    it('withdraws with requireAvailableGte', async () => {
      await createTestUser({ balance: 100, lockedBalance: 20 })

      const updated = await updateUserBalanceAtomic({
        userId: 'user-1',
        guildId: 'guild-1',
        balanceDelta: -40,
        requireAvailableGte: 40
      })

      expect(updated?.balance).toBe(60)
      expect(updated?.lockedBalance).toBe(20)
    })

    it('returns null when available balance is insufficient', async () => {
      await createTestUser({ balance: 100, lockedBalance: 90 })

      const updated = await updateUserBalanceAtomic({
        userId: 'user-1',
        guildId: 'guild-1',
        balanceDelta: -50,
        requireAvailableGte: 50
      })

      expect(updated).toBeNull()

      const user = await User.findOne({ userId: 'user-1', guildId: 'guild-1' })
      expect(user?.balance).toBe(100)
    })
  })

  describe('createUserIfNotExists', () => {
    it('creates user once on first call', async () => {
      const created = await createUserIfNotExists({
        userId: 'new-user',
        guildId: 'guild-1'
      })
      expect(created).toBe(true)
      expect(await User.countDocuments({ userId: 'new-user' })).toBe(1)
    })

    it('does not duplicate on second call', async () => {
      await createUserIfNotExists({ userId: 'new-user-2', guildId: 'guild-1' })
      const createdAgain = await createUserIfNotExists({
        userId: 'new-user-2',
        guildId: 'guild-1'
      })
      expect(createdAgain).toBe(false)
      expect(await User.countDocuments({ userId: 'new-user-2' })).toBe(1)
    })
  })
})
