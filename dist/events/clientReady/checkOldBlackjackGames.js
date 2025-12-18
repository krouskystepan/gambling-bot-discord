// import { getAllOldBlackjackGames } from '@/services'
// import { calculateHandValue, revealDealerCards } from '@/utils/casino/blackjack'
// import {
//   formatNumberToReadableString,
//   parseReadableStringToNumber
// } from '@/utils/common/utils'
export default async (_client) => {
    console.log('❌ TODO >>> 👀 Blackjack auto-stand listener started');
    // setInterval(async () => {
    //   const oldGames = await getAllOldBlackjackGames(1)
    //   for (const game of oldGames) {
    //     try {
    //       const guild = await client.guilds.fetch(game.guildId).catch(() => null)
    //       if (!guild) continue
    //       const channel = await guild.channels
    //         .fetch(game.channelId)
    //         .catch(() => null)
    //       if (!channel || !(channel instanceof TextChannel)) continue
    //       const message = await channel.messages
    //         .fetch(game.messageId)
    //         .catch(() => null)
    //       if (!message) continue
    //       const dealerTotal = calculateHandValue(game.dealerCards)
    //       const playerTotal = calculateHandValue(game.playerCards)
    //       await revealDealerCards(
    //         formatNumberToReadableString(game.betAmount),
    //         message,
    //         game.dealerCards,
    //         dealerTotal,
    //         game.playerCards,
    //         playerTotal,
    //         game.deck,
    //         game.gameIndex,
    //         game.user,
    //         game.guildId,
    //         game._id,
    //         false,
    //         game.betId
    //       )
    //       console.log(`🃏 Auto-stand executed | gameId=${game._id}`)
    //     } catch (err) {
    //       console.error('Auto-stand failed:', err)
    //     }
    //   }
    // }, 60_000)
};
