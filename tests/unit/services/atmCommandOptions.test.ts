import { describe, expect, it } from 'vitest'

import { ApplicationCommandOptionType } from 'discord.js'

import {
  createAtmCancelSubcommand,
  createAtmRequestSubcommandOptions,
  createAtmStatusSubcommand
} from '@/services/atm/atmCommandOptions'

describe('atmCommandOptions', () => {
  it('builds withdraw request subcommand options', () => {
    const options = createAtmRequestSubcommandOptions('withdraw')

    expect(options).toHaveLength(2)
    expect(options[0]).toMatchObject({
      name: 'amount',
      type: ApplicationCommandOptionType.String,
      required: true
    })
    expect(options[0].description).toContain('withdraw')
    expect(options[1].description).toContain('send the money to')
  })

  it('builds deposit request subcommand options', () => {
    const options = createAtmRequestSubcommandOptions('deposit')

    expect(options[0].description).toContain('deposit')
    expect(options[1].description).toContain('from which you are sending money')
  })

  it('builds withdraw status subcommand', () => {
    const subcommand = createAtmStatusSubcommand('withdraw')

    expect(subcommand).toMatchObject({
      name: 'status',
      type: ApplicationCommandOptionType.Subcommand
    })
    expect(subcommand.description).toContain('withdrawal')
    expect(subcommand.options[0]).toMatchObject({
      name: 'request',
      type: ApplicationCommandOptionType.String,
      required: false,
      autocomplete: true
    })
  })

  it('builds deposit status subcommand', () => {
    const subcommand = createAtmStatusSubcommand('deposit')

    expect(subcommand.description).toContain('deposit')
    expect(subcommand.options[0]?.description).toContain('Deposit request')
  })

  it('builds withdraw cancel subcommand', () => {
    const subcommand = createAtmCancelSubcommand('withdraw')

    expect(subcommand).toMatchObject({
      name: 'cancel',
      type: ApplicationCommandOptionType.Subcommand
    })
    expect(subcommand.description).toContain('pending withdrawal')
    expect(subcommand.options[0]).toMatchObject({
      name: 'request',
      type: ApplicationCommandOptionType.String,
      required: false,
      autocomplete: true
    })
  })

  it('builds deposit cancel subcommand', () => {
    const subcommand = createAtmCancelSubcommand('deposit')

    expect(subcommand.description).toContain('pending deposit')
    expect(subcommand.options[0]?.description).toContain('Pending deposit')
  })
})
