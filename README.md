# Discord Gamble Bot

## User Commands

### ATM

```
/register
```

Register yourself in the system.

```
/deposit amount:100k account:123
```

Deposit money to your account.

```
/withdraw amount:100k account:123
```

Withdraw money from your account.

### CASINO

```
/blackjack bet:10k
```

Play blackjack.

```
/rps player:@user bet:10k
```

Play rock, paper, scissors with another user.

```
/coin-flip bet:10k side:Heads flips:10 show-balance:True
```

Flip a coin.

```
/dice bet:10k side:4 rolls:10 show-balance:True
```

Play a dice game.

```
/goldenjackpot bet:10k entries:10 show-balance:True
```

Try your luck at the Golden Jackpot.

```
/lottery bet:10k numbers:1,7,43,2,34 entries:10 show-balance:True
```

Play the lottery! Pick 5 numbers and see if you win.

```
/slots bet:10k spins:10 show-balance:True
```

Spin the slot machine.

### UTILS

```
/balance
```

Check your current balance.

```
/ping
```

Check the bot latency.

## Admin commands:

### AUTH

```
/force-register user:@user
```

Force register a user.

```
/force-unregister user:@user
```

Unregister a user (delete from DB).

### CONFIG

```
/setup-manager
```

Manage the manager role.

- `set role:@role`

  - Set the manager role.

- `remove`

  - Remove the manager role.

```
/setup-admin
```

Manage the admin channels.

- `add channel:#channel`

  - Set a channel for using admin commands.

- `remove channel-id:ID`

  - Remove a channel from admin commands using its ID.

```
/setup-casino
```

Manage the casino channels.

- `add channel:#channel`

  - Set a channel for using casino bets.

- `remove channel-id:ID`

  - Remove a channel from admin commands using its ID.

```
/setup-atm
```

Manage ATM actions and log channels.

- `add-actions channel:#channel`

  - Set a channel for ATM transactions (deposits and withdrawals).

- `remove-actions channel-id:ID`

  - Remove a channel for ATM transactions using its ID (deposits and withdrawals).

- `add-logs channel:#channel`

  - Set a channel for ATM logs (transaction logs).

- `remove-logs channel-id:ID`

  - Remove a channel for ATM logs using its ID (transaction logs).

```
/setup-settings
```

Edit bot settings

- `edit game:Dice key:Maximum Bet Amount value:10k`

  - Edit settings for individual game.

- `reset game:Dice`

  - Reset settings to default value (you can reset all settings too).

### UTILS

```
/casino-info
```

Get information about the casino.

```
/role-info role:@role
```

Display information about a role.

```
/who-is user:@user
```

Get information about a user.

```
/money-manager
```

Create an embed for manage balance.

- `give-balance amount:100k`

  - Create an embed for giving money.

- `reset-balance `

  - Create an embed for reseting money.

```
/manage-balance
```

Manage user balances.

- `deposit user:@user amount:250k`

  - Add money to a user.

- `withdraw user:@user amount:250k`

  - Remove money from a user.

- `check user:@user`

  - Check a user’s balance.

- `list`

  - Check the balance of all users.

### TEST

```
/simulate-dice rolls:1m bet:100 wins-losses-count:True win-losses-series:True multipliers:True
```

Simulate X dice rolls. WARNING: May take a long time.

```
/simulate-coin-flip flips:1m bet:100 wins-losses-count:True win-losses-series:True multipliers:True
```

Simulate X coin flips. WARNING: May take a long time.

```
/simulate-lottery entries:1m bet:100 details:True wins-losses-count:True win-losses-series:True multipliers:True
```

Simulate X lottery entries. WARNING: May take a long time.

```
/simulate-goldenjackpot entries:1m bet:100 details:True wins-losses-count:True win-losses-series:True multipliers:True
```

Simulate X goldenjackpot entries. WARNING: May take a long time.

```
/simulate-slots spins:1m bet:100 details:True wins-losses-count:True win-losses-series:True multipliers:True weights:True
```

Simulate X spins on a slot machine. WARNING: May take a long time.
