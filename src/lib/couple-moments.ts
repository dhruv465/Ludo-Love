import { CoupleMoment, MomentEvent, MomentMood } from './ludo-types';

export const DEFAULT_MOMENT_MOOD: MomentMood = 'romantic';

export const MOMENT_REWARDS: Record<MomentEvent, number> = {
  roll_six: 3,
  safe_square: 5,
  capture: 8,
  finish_piece: 10,
  victory: 15,
};

export const PROMPTS: Record<MomentMood, Record<MomentEvent, string[]>> = {
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
