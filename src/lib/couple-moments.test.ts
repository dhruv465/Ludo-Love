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
