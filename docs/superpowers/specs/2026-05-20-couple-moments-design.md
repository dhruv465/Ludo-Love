# Ludo Love Couple Moments Design

## Summary

Ludo Love should stay a fair classic Ludo game while adding small, optional couple moments that make each match feel personal for long-distance partners. Special Ludo events trigger compact prompt cards. Submitting a response earns coins and saves the moment to match history. Skipping keeps the game moving with no penalty.

## Goals

- Make matches feel worth replaying for a couple, not just like a generic board game.
- Keep dice rolls, piece movement, captures, and winning rules classic and fair.
- Add emotional and playful value without blocking the board or slowing turns.
- Build a foundation for later match memories and a couple journey timeline.

## Non-Goals

- No gameplay boosts, rerolls, shields, or power-ups from couple moments.
- No photos, voice notes, or microphone/camera permissions in the first version.
- No daily quest system or full relationship timeline in the first version.
- No forced prompts. Players can skip any moment.

## Experience Direction

The first version uses a balanced tone: classic Ludo first, couple moments sprinkled in. Room mood controls the prompt style:

- `cute`: wholesome compliments, missing-you prompts, light dares.
- `romantic`: affectionate, flirty, date-night and future-plan prompts.
- `spicy`: bolder prompts, still text-only and user-controlled.

Default mood is `romantic`. Older rooms without a mood field behave as romantic rooms.

## Moment Triggers

Moment cards trigger only from meaningful gameplay events:

- Rolling a six: prompt tied to opening up or sending a quick sweet note.
- Capturing a piece: playful teasing prompt or dare.
- Landing on a safe square: caring/protective prompt.
- Reaching home or finishing a piece: memory or future-plan prompt.
- Winning the match: final recap prompt.

Each event generates at most one active moment card. If another event happens while a card is active, the first version ignores the new prompt. This avoids a prompt queue and keeps the match flow simple.

## UI Design

Show the active prompt as a compact bottom sheet above the dice dock.

The sheet includes:

- Event title, such as `Safe Spot`, `Captured`, `Home Stretch`, or `Victory`.
- One short prompt sentence.
- Optional short text input.
- `Send` and `Skip` actions.
- Small coin reward label, such as `+5 coins`.

The sheet must not cover the full board. It should feel like a quick interaction layer, not a blocking modal. On small phones, it should stay readable and avoid overlapping the dice controls.

## Rewards

Submitting a moment earns coins. Skipping earns nothing and has no penalty.

Reward values:

- Roll six moment: `+3 coins`.
- Safe square moment: `+5 coins`.
- Capture moment: `+8 coins`.
- Finish-piece moment: `+10 coins`.
- Victory moment: `+15 coins`.

Rewards update the current user's points in the existing user document. They do not affect game rules or turn order.

## Data Model

Extend room state with:

```ts
type MomentMood = 'cute' | 'romantic' | 'spicy';

interface CoupleMoment {
  id: string;
  event: 'roll_six' | 'capture' | 'safe_square' | 'finish_piece' | 'victory';
  mood: MomentMood;
  prompt: string;
  rewardCoins: number;
  playerUid: string;
  createdAt: number;
}
```

Add optional fields to `GameState`:

```ts
momentMood?: MomentMood;
activeMoment?: CoupleMoment | null;
```

Keep the existing `Message.type` shape and save submitted moment answers as `type: 'moment'`. The message text should include the prompt and the answer in a compact format. Old rooms without `momentMood` or `activeMoment` continue to work.

## Components And Boundaries

- `src/lib/couple-moments.ts`: prompt library, mood selection, event-to-prompt helper, reward values.
- `src/components/game/MomentCard.tsx`: bottom-sheet UI for send/skip.
- `src/hooks/useGame.ts`: create active moments after gameplay events, submit/skip handlers, coin reward update.
- `src/App.tsx` and lobby UI: mood selector before room creation and current mood display.
- `src/lib/ludo-types.ts`: shared moment types and optional game fields.

This keeps prompt logic separate from the Ludo rules engine. The Ludo engine should not know about couple prompts or rewards.

## Error Handling

- If reward update fails after submitting, still save the moment message when possible and log the reward error.
- If the room update fails, keep the card visible so the user can retry or skip.
- If prompt generation returns no prompt, do not show a card.
- If user leaves a room with an active card, no special cleanup is required.

## Testing

Add focused checks for:

- Mood defaults to `romantic` when missing.
- Prompt helper returns valid prompts for each event and mood.
- Rewards match expected event values.
- Submitting creates a `moment` message and clears `activeMoment`.
- Skipping clears `activeMoment` and gives no coins.
- Existing Ludo engine tests still pass.

Manual QA:

- Create a two-player room and verify mood selector is visible before start.
- Trigger a six, capture, safe square, finish, and victory in test/dev state.
- Confirm prompt card does not cover the board or dice dock on mobile widths.
- Confirm skipped prompts do not alter coins.
- Confirm submitted prompts appear in match history/messages.
