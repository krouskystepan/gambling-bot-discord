import { describe, expect, it } from 'vitest'

import { command } from '@/app/commands/(misc)/(utils)/ping'

describe('ping command', () => {
  it('exports command metadata', () => {
    expect(command.name).toBe('ping')
    expect(command.description).toBeTruthy()
  })
})
