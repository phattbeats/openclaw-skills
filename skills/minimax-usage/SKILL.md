---
name: minimax-usage
description: Check MiniMax Coding Plan usage (requests used / remaining, reset time). Use when asked about MiniMax token usage, plan limits, or how much of the coding plan is left.
---

# minimax-usage

Check MiniMax Coding Plan usage via browser automation.

## Credentials (already set in environment)
- Email: `$MINIMAX_EMAIL` (Caramel7332+85z9h0hs@protonmail.com)
- Password: `$MINIMAX_PASSWORD`

## Steps

1. Open `https://platform.minimax.io/user-center/payment/token-plan` in browserless profile
2. If redirected to login, fill email + password fields and sign in
3. Wait for page load, snapshot the page
4. Extract:
   - Plan name (e.g. "Starter")
   - Usage: X/1500 requests used
   - Percentage
   - Time until reset
5. Return: `Plan: Starter | Used: 36/1500 (2%) | Resets in: 4h 49m`

## Notes
- Session persists in browserless — no re-login needed if browserless is already authenticated
- Usage resets every 5 hours
- Brandon's current plan: Starter (1500 requests / 5 hours)
