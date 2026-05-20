# Couple Moments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional long-distance couple prompt cards to special Ludo events, with mood selection, coin rewards, and saved match moments.

**Architecture:** Keep classic Ludo rules untouched. Add a focused couple-moments library for prompt selection and rewards, then wire that library into room creation, gameplay event handling, and a compact bottom-sheet UI. Persist only simple room fields and existing `moment` messages so old rooms continue to work.

**Tech Stack:** React 19, Vite, TypeScript, Firebase Firestore, Tailwind CSS, `node:test` with `tsx`.

---

## File Structure

- Create `src/lib/couple-moments.ts`
  - Owns mood defaults, prompt catalog, reward values, moment creation, and message formatting.
- Create `src/lib/couple-moments.test.ts`
  - Unit checks for default mood, prompt creation, reward values, and message formatting.
- Modify `src/lib/ludo-types.ts`
  - Adds `MomentMood`, `MomentEvent`, `CoupleMoment`, and optional `GameState` fields.
- Modify `src/components/game/Lobby.tsx`
  - Adds room mood selector and passes chosen mood to room creation.
- Create `src/components/game/MomentCard.tsx`
  - Renders compact bottom sheet with prompt, input, send, skip, and reward.
- Modify `src/hooks/useGame.ts`
  - Creates moments after special events, exposes submit/skip handlers, awards coins on submit.
- Modify `src/App.tsx`
  - Stores mood when creating rooms, passes mood selector props, renders `MomentCard`, and shows mood in waiting state.

---

### Task 1: Couple Moment Types And Pure Library

**Files:**
- Modify: `src/lib/ludo-types.ts`
- Create: `src/lib/couple-moments.ts`
- Create: `src/lib/couple-moments.test.ts`

- [ ] **Step 1: Add shared types**

In `src/lib/ludo-types.ts`, add these exports after `GameStatus`:

```ts
export type MomentMood = 'cute' | 'romantic' | 'spicy';
export type MomentEvent = 'roll_six' | 'capture' | 'safe_square' | 'finish_piece' | 'victory';

export interface CoupleMoment {
  id: string;
  event: MomentEvent;
  mood: MomentMood;
  prompt: string;
  rewardCoins: number;
  playerUid: string;
  createdAt: number;
}
```

Then extend `GameState` with:

```ts
  momentMood?: MomentMood;
  activeMoment?: CoupleMoment | null;
```

- [ ] **Step 2: Write failing unit tests**

Create `src/lib/couple-moments.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoupleMoment,
  formatMomentMessage,
  getMomentMood,
  getMomentReward,
} from './couple-moments';

test('missing mood defaults to romantic', () => {
  assert.equal(getMomentMood(undefined), 'romantic');
});

test('invalid mood defaults to romantic', () => {
  assert.equal(getMomentMood('wild' as never), 'romantic');
});

test('every event returns configured reward value', () => {
  assert.equal(getMomentReward('roll_six'), 3);
  assert.equal(getMomentReward('safe_square'), 5);
  assert.equal(getMomentReward('capture'), 8);
  assert.equal(getMomentReward('finish_piece'), 10);
  assert.equal(getMomentReward('victory'), 15);
});

test('moment creation is deterministic enough for persistence shape', () => {
  const moment = createCoupleMoment({
    event: 'capture',
    mood: 'cute',
    playerUid: 'user-1',
    now: 1710000000000,
  });

  assert.equal(moment.event, 'capture');
  assert.equal(moment.mood, 'cute');
  assert.equal(moment.playerUid, 'user-1');
  assert.equal(moment.rewardCoins, 8);
  assert.equal(moment.createdAt, 1710000000000);
  assert.match(moment.id, /^capture-user-1-1710000000000-/);
  assert.equal(typeof moment.prompt, 'string');
  assert.ok(moment.prompt.length > 10);
});

test('message formatting keeps prompt and answer compact', () => {
  const moment = createCoupleMoment({
    event: 'safe_square',
    mood: 'romantic',
    playerUid: 'user-1',
    now: 1710000000000,
  });

  assert.equal(
    formatMomentMessage(moment, 'I miss our night calls.'),
    `${moment.prompt}\nI miss our night calls.`
  );
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npx tsx --test src/lib/couple-moments.test.ts
```

Expected: FAIL because `src/lib/couple-moments.ts` does not exist.

- [ ] **Step 4: Implement couple-moments library**

Create `src/lib/couple-moments.ts`:

```ts
import { CoupleMoment, MomentEvent, MomentMood } from './ludo-types';

export const DEFAULT_MOMENT_MOOD: MomentMood = 'romantic';

export const MOMENT_REWARDS: Record<MomentEvent, number> = {
  roll_six: 3,
  safe_square: 5,
  capture: 8,
  finish_piece: 10,
  victory: 15,
};

const PROMPTS: Record<MomentMood, Record<MomentEvent, string[]>> = {
  cute: {
    roll_six: [
      'Send one tiny thing you miss about them right now.',
      'Tell them one small thing that made you smile today.',
    ],
    capture: [
      'Send a playful sorry in your cutest words.',
      'Give them one sweet compliment after that capture.',
    ],
    safe_square: [
      'Tell them one way they make you feel safe.',
      'Send a little protective message for their next turn.',
    ],
    finish_piece: [
      'Share one memory you want to replay together.',
      'Tell them one thing you want to do together soon.',
    ],
    victory: [
      'Send your sweetest winner or runner-up message.',
      'Pick one moment from this match you want to remember.',
    ],
  },
  romantic: {
    roll_six: [
      'Send one thing you wish you could say face to face.',
      'Tell them what you would do if they were beside you now.',
    ],
    capture: [
      'Tease them with one flirty victory line.',
      'Send a playful dare for after this match.',
    ],
    safe_square: [
      'Tell them one reason they feel like home.',
      'Send one line that would make them blush a little.',
    ],
    finish_piece: [
      'Describe one future date you want with them.',
      'Share one long-distance moment that felt worth it.',
    ],
    victory: [
      'Send the final love note of this match.',
      'Write one thing this game made you feel about them.',
    ],
  },
  spicy: {
    roll_six: [
      'Send a bold one-line promise for your next call.',
      'Tell them one thing you want them to ask you later.',
    ],
    capture: [
      'Send a spicy-but-sweet dare for the loser.',
      'Tease them with one bold line and keep it text-only.',
    ],
    safe_square: [
      'Send a protective line with a little heat.',
      'Tell them one thing you want to save for just you two.',
    ],
    finish_piece: [
      'Describe one private date-night idea in one sentence.',
      'Send a bold future-plan hint without making it too long.',
    ],
    victory: [
      'Winner sends one bold final message.',
      'Loser gets one playful text-only dare from the winner.',
    ],
  },
};

export function getMomentMood(value: MomentMood | undefined | null): MomentMood {
  return value === 'cute' || value === 'romantic' || value === 'spicy'
    ? value
    : DEFAULT_MOMENT_MOOD;
}

export function getMomentReward(event: MomentEvent): number {
  return MOMENT_REWARDS[event];
}

export function createCoupleMoment(input: {
  event: MomentEvent;
  mood?: MomentMood | null;
  playerUid: string;
  now?: number;
}): CoupleMoment {
  const mood = getMomentMood(input.mood);
  const now = input.now ?? Date.now();
  const prompts = PROMPTS[mood][input.event];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)] || prompts[0];

  return {
    id: `${input.event}-${input.playerUid}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    event: input.event,
    mood,
    prompt,
    rewardCoins: getMomentReward(input.event),
    playerUid: input.playerUid,
    createdAt: now,
  };
}

export function formatMomentMessage(moment: CoupleMoment, answer: string): string {
  return `${moment.prompt}\n${answer.trim()}`;
}
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```bash
npx tsx --test src/lib/couple-moments.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/lib/ludo-types.ts src/lib/couple-moments.ts src/lib/couple-moments.test.ts
git commit -m "feat: add couple moment prompt library"
```

---

### Task 2: Lobby Mood Selection And Room Persistence

**Files:**
- Modify: `src/components/game/Lobby.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update lobby props**

In `src/components/game/Lobby.tsx`, change imports:

```ts
import { PlayerColor, GameTheme, MomentMood } from '../../lib/ludo-types';
```

Change `LobbyProps`:

```ts
interface LobbyProps {
  user: User;
  onCreate: (color: PlayerColor, theme: GameTheme, playerCount: number, withBot: boolean, momentMood: MomentMood) => void | Promise<void>;
  onJoin: (roomId: string) => void | Promise<void>;
}
```

- [ ] **Step 2: Add mood state and options**

Inside `Lobby`, after `selectedTheme`:

```ts
  const [selectedMood, setSelectedMood] = useState<MomentMood>('romantic');
```

After `themes`, add:

```ts
  const moods: { id: MomentMood; label: string; helper: string }[] = [
    { id: 'cute', label: 'Cute', helper: 'Sweet and wholesome' },
    { id: 'romantic', label: 'Romantic', helper: 'Flirty and warm' },
    { id: 'spicy', label: 'Spicy', helper: 'Bolder text prompts' },
  ];
```

- [ ] **Step 3: Pass mood during room creation**

Change `handleCreate`:

```ts
      await onCreate(selectedColor, selectedTheme, playerCount, withBots, selectedMood);
```

- [ ] **Step 4: Render mood selector**

In `Lobby`, place this block after the Theme selector:

```tsx
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Couple Mood</label>
                    <div className="grid grid-cols-3 gap-2">
                       {moods.map((mood) => (
                          <button
                            key={mood.id}
                            type="button"
                            onClick={() => setSelectedMood(mood.id)}
                            className={cn(
                              "rounded-2xl border px-2 py-3 text-left transition-all",
                              selectedMood === mood.id
                                ? "border-rose-400 bg-white shadow-md shadow-rose-100"
                                : "border-rose-100 bg-white/70"
                            )}
                          >
                            <span className="block text-[11px] font-black text-slate-800">{mood.label}</span>
                            <span className="mt-1 block text-[9px] font-bold leading-tight text-slate-400">{mood.helper}</span>
                          </button>
                       ))}
                    </div>
                 </div>
```

- [ ] **Step 5: Persist mood in created room**

In `src/App.tsx`, update imports:

```ts
import { PlayerColor, GameTheme, MomentMood } from './lib/ludo-types';
```

Change `createRoom` signature:

```ts
  const createRoom = async (color: PlayerColor, theme: GameTheme, playerCount: number, withBot: boolean = false, momentMood: MomentMood = 'romantic') => {
```

In the `setDoc(roomRef, { ... })` payload, add:

```ts
      momentMood,
      activeMoment: null,
```

- [ ] **Step 6: Show mood in waiting room**

In the waiting room card, below the room code block, add:

```tsx
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-rose-300">Couple Mood</span>
                    <span className="text-sm font-black capitalize text-slate-800">{game.momentMood || 'romantic'}</span>
                  </div>
```

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/components/game/Lobby.tsx src/App.tsx
git commit -m "feat: add couple mood room setting"
```

---

### Task 3: Moment Lifecycle In Game Hook

**Files:**
- Modify: `src/hooks/useGame.ts`
- Modify: `src/lib/couple-moments.test.ts`

- [ ] **Step 1: Add pure test for compact submitted message**

Append to `src/lib/couple-moments.test.ts`:

```ts
test('message formatting trims answer whitespace', () => {
  const moment = createCoupleMoment({
    event: 'victory',
    mood: 'cute',
    playerUid: 'user-1',
    now: 1710000000000,
  });

  assert.equal(
    formatMomentMessage(moment, '  Best match ever.  '),
    `${moment.prompt}\nBest match ever.`
  );
});
```

- [ ] **Step 2: Run test to verify pass**

Run:

```bash
npx tsx --test src/lib/couple-moments.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 3: Import moment helpers**

In `src/hooks/useGame.ts`, add:

```ts
import { createCoupleMoment, formatMomentMessage, getMomentMood } from '../lib/couple-moments';
import { CoupleMoment, MomentEvent } from '../lib/ludo-types';
```

Merge this with the existing `ludo-types` import so TypeScript imports stay clean:

```ts
import { CoupleMoment, GameState, MomentEvent, Piece, Player, PlayerColor } from '../lib/ludo-types';
```

- [ ] **Step 4: Add helper to create a room moment**

Inside `useGame`, before `rollDice`, add:

```ts
  const buildMoment = (event: MomentEvent, uid: string): CoupleMoment | null => {
    if (!game || game.activeMoment) return null;
    return createCoupleMoment({
      event,
      mood: getMomentMood(game.momentMood),
      playerUid: uid,
    });
  };
```

- [ ] **Step 5: Trigger moment on six**

In `rollDice`, inside the delayed `updateDoc`, add `const nextMoment = diceValue === 6 ? buildMoment('roll_six', uid) : null;` before `await updateDoc`.

Include `activeMoment` in the update:

```ts
          activeMoment: nextMoment || game.activeMoment || null,
```

Do not create a moment when the third consecutive six cancels the move:

```ts
        const nextMoment = diceValue === 6 && !turnResult.cancelsMove ? buildMoment('roll_six', uid) : null;
```

- [ ] **Step 6: Trigger moments on capture, finish, and victory**

In `performMove`, after `const finishedPiece = ...`, add:

```ts
    const nextMoment =
      isWinner ? buildMoment('victory', uid)
      : finishedPiece ? buildMoment('finish_piece', uid)
      : collision ? buildMoment('capture', uid)
      : null;
```

In the final `updateDoc`, add:

```ts
        activeMoment: nextMoment || game.activeMoment || null,
```

- [ ] **Step 7: Trigger safe-square moment**

In `performMove`, after `const newPiece = ...`, detect safe landing without importing board layout into the UI:

```ts
    const landedOnSafeSquare = newPiece.status === 'board'
      && [0, 8, 13, 21, 26, 34, 39, 47].includes(newPiece.position);
```

Then change `nextMoment` priority:

```ts
    const nextMoment =
      isWinner ? buildMoment('victory', uid)
      : finishedPiece ? buildMoment('finish_piece', uid)
      : collision ? buildMoment('capture', uid)
      : landedOnSafeSquare ? buildMoment('safe_square', uid)
      : null;
```

- [ ] **Step 8: Add submit and skip handlers**

Before the `return` from `useGame`, add:

```ts
  const submitMoment = async (uid: string, answer: string) => {
    if (!roomId || !game?.activeMoment || game.activeMoment.playerUid !== uid) return;
    const trimmed = answer.trim();
    if (!trimmed) return;

    const moment = game.activeMoment;
    const player = [game.player1, game.player2, game.player3, game.player4].find(p => p?.uid === uid);
    const gameRef = doc(db, 'rooms', roomId);

    await updateDoc(gameRef, {
      messages: [
        ...(game.messages || []),
        {
          uid,
          sender: player?.name || 'Player',
          text: formatMomentMessage(moment, trimmed),
          type: 'moment',
          timestamp: Date.now(),
        },
      ],
      activeMoment: null,
      updatedAt: serverTimestamp(),
    });

    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentPoints = userSnap.data().points || 0;
        await updateDoc(userRef, { points: currentPoints + moment.rewardCoins });
      }
    } catch (e) {
      console.error('Failed to award moment points:', e);
    }
  };

  const skipMoment = async (uid: string) => {
    if (!roomId || !game?.activeMoment || game.activeMoment.playerUid !== uid) return;
    const gameRef = doc(db, 'rooms', roomId);
    await updateDoc(gameRef, {
      activeMoment: null,
      updatedAt: serverTimestamp(),
    });
  };
```

Update hook return:

```ts
  return { game, error, rollDice, performMove, startGame, sendMessage, submitMoment, skipMoment, isRolling: localRolling };
```

- [ ] **Step 9: Run checks**

Run:

```bash
npx tsx --test src/lib/couple-moments.test.ts
npx tsx --test src/lib/ludo-engine.test.ts
npm run lint
```

Expected: all pass.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/hooks/useGame.ts src/lib/couple-moments.test.ts
git commit -m "feat: trigger couple moments from gameplay"
```

---

### Task 4: Moment Card UI

**Files:**
- Create: `src/components/game/MomentCard.tsx`

- [ ] **Step 1: Create component**

Create `src/components/game/MomentCard.tsx`:

```tsx
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Send, X } from 'lucide-react';
import { CoupleMoment } from '../../lib/ludo-types';
import { cn } from '../../lib/utils';

const EVENT_LABEL: Record<CoupleMoment['event'], string> = {
  roll_six: 'Lucky Six',
  capture: 'Captured',
  safe_square: 'Safe Spot',
  finish_piece: 'Home Stretch',
  victory: 'Victory Moment',
};

const EVENT_STYLE: Record<CoupleMoment['event'], string> = {
  roll_six: 'from-rose-500 to-pink-500',
  capture: 'from-amber-500 to-rose-500',
  safe_square: 'from-emerald-500 to-cyan-500',
  finish_piece: 'from-cyan-500 to-blue-500',
  victory: 'from-fuchsia-500 to-rose-500',
};

interface MomentCardProps {
  moment: CoupleMoment;
  disabled?: boolean;
  onSend: (answer: string) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

export function MomentCard({ moment, disabled, onSend, onSkip }: MomentCardProps) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const canSend = answer.trim().length > 0 && !busy && !disabled;

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await onSend(answer);
      setAnswer('');
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await onSkip();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      className="fixed inset-x-3 bottom-[128px] z-50 mx-auto w-[min(calc(100vw-24px),560px)] overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_18px_50px_rgba(244,63,94,0.22)]"
    >
      <div className={cn('h-1.5 bg-gradient-to-r', EVENT_STYLE[moment.event])} />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white', EVENT_STYLE[moment.event])}>
            <Heart className="h-5 w-5 fill-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">{EVENT_LABEL[moment.event]}</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">+{moment.rewardCoins} coins</span>
            </div>
            <p className="mt-1 text-sm font-semibold leading-snug text-slate-600">{moment.prompt}</p>
          </div>
        </div>

        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          maxLength={160}
          rows={2}
          placeholder="Write something short..."
          className="w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-rose-300"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={skip}
            disabled={busy || disabled}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white text-xs font-black uppercase tracking-wider text-slate-400 active:scale-95 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Skip
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="flex h-10 flex-[1.4] items-center justify-center gap-2 rounded-full bg-rose-500 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-200 active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/components/game/MomentCard.tsx
git commit -m "feat: add couple moment card"
```

---

### Task 5: Wire Moment Card Into Active Game

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import MomentCard**

In `src/App.tsx`, add:

```ts
import { MomentCard } from './components/game/MomentCard';
```

- [ ] **Step 2: Pull handlers from hook**

Change:

```ts
  const { game, rollDice, performMove, startGame, isRolling } = useGame(activeRoomId || '', user?.uid);
```

to:

```ts
  const { game, rollDice, performMove, startGame, submitMoment, skipMoment, isRolling } = useGame(activeRoomId || '', user?.uid);
```

- [ ] **Step 3: Render active moment card**

Inside the active game return, just before the fixed bottom dock, add:

```tsx
        <AnimatePresence>
          {game.activeMoment && game.activeMoment.playerUid === user.uid && (
            <MomentCard
              moment={game.activeMoment}
              onSend={(answer) => submitMoment(user.uid, answer)}
              onSkip={() => skipMoment(user.uid)}
            />
          )}
        </AnimatePresence>
```

- [ ] **Step 4: Add small mood label in top status card**

In the top status card right column under Goal dots, add:

```tsx
                 <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-300">
                   {(game.momentMood || 'romantic')} mood
                 </div>
```

- [ ] **Step 5: Run full checks**

Run:

```bash
npx tsx --test src/lib/couple-moments.test.ts
npx tsx --test src/lib/ludo-engine.test.ts
npm run lint
npm run build
```

Expected: all pass. `npm run build` may keep the existing Vite large chunk warning.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/App.tsx
git commit -m "feat: show couple moments in active game"
```

---

### Task 6: Browser QA And Final Polish

**Files:**
- Modify only files needed for defects found during QA.

- [ ] **Step 1: Start or verify local dev server**

Run:

```bash
npm run dev
```

Expected: Vite serves on `http://localhost:3000/`. If it is already running, keep the existing server.

- [ ] **Step 2: QA lobby mood selection**

In the browser at `http://localhost:3000/`:

- Create a room.
- Confirm Cute, Romantic, and Spicy options appear.
- Select Spicy, host room, and verify waiting room shows `spicy`.
- Cancel room.

- [ ] **Step 3: QA bot room moment flow**

In the browser:

- Create a 2-player bot room.
- Roll until a six or use dev state editing if needed.
- Confirm a compact moment card appears above the dice dock.
- Enter a short answer.
- Press Send.
- Confirm card clears and no board movement/layout break occurs.

- [ ] **Step 4: QA skip flow**

In the browser:

- Trigger another moment.
- Press Skip.
- Confirm card clears.
- Confirm coins do not visibly increase from skip.

- [ ] **Step 5: QA responsive layout**

Use browser viewport widths `360`, `390`, and `430`:

- Board remains usable.
- Moment card does not cover dice button.
- Bottom dock remains readable.
- No text overlaps inside card actions.

- [ ] **Step 6: Fix QA defects with focused patches**

For each defect, patch only the relevant file. Example for card overlap:

```tsx
className="fixed inset-x-3 bottom-[132px] z-50 mx-auto w-[min(calc(100vw-24px),560px)] ..."
```

Then rerun:

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 7: Final commit**

If QA produced patches, run:

```bash
git add src
git commit -m "fix: polish couple moment experience"
```

If QA produced no patches, do not create an empty commit.

---

## Final Verification

Run:

```bash
npx tsx --test src/lib/couple-moments.test.ts
npx tsx --test src/lib/ludo-engine.test.ts
npm run lint
npm run build
git status --short --branch
```

Expected:

- Couple moment tests pass.
- Existing Ludo engine tests pass.
- Typecheck passes.
- Production build passes.
- Branch shows only intentional commits and no uncommitted changes.

## Spec Coverage Review

- Mood selector: Task 2.
- Prompt library: Task 1.
- Special event triggers: Task 3.
- Bottom-sheet UI: Task 4 and Task 5.
- Submit/skip flow: Task 3 and Task 5.
- Coin reward on submit only: Task 3.
- Match history/message storage: Task 3.
- Classic Ludo rules remain isolated: Task 1 file boundary and Task 3 hook-only integration.
- Mobile QA: Task 6.
