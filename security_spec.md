# Security Specification - Ludo Love

## Data Invariants
1. A room cannot be updated by anyone other than the two players assigned to it.
2. A player can only move their own pieces.
3. Pieces can only move if the dice has been rolled in the current turn.
4. The turn can only change after a valid move or if no moves are possible.
5. Dice values must be between 1 and 6.
6. Identity (UID) in the payload must match `request.auth.uid`.

## The Dirty Dozen Payloads (Attack Vectors)
1. **Unauthorized Room Takeover**: User A tries to change `player2` in User B's room.
2. **Double Move**: User A tries to move a piece twice without rolling again.
3. **Identity Spoofing**: User A sends `currentTurn: "UserB"` to skip User B's turn.
4. **Invalid Dice**: User A sends `lastDiceValue: 10`.
5. **Teleportation**: User A updates `piece.position` to 58 (finished) directly from base.
6. **Shadow Update**: Adding `isAdmin: true` to the room document.
7. **Resource Poisoning**: Sending a 1MB string as the `roomId`.
8. **PII Leak**: Reading `users` collection without being authenticated or as the owner.
9. **State Shortcutting**: Changing `status` from 'waiting' to 'finished' without playing.
10. **Orphaned Moves**: Updating pieces while the room `status` is 'waiting'.
11. **Winner Forgery**: Setting `winner` manually during a normal move.
12. **Timestamp Forgery**: Sending a fake `updatedAt` value.

## Test Runner (Logic Overview)
The `firestore.rules` will be validated against these scenarios. Tests will ensure `PERMISSION_DENIED` for all invalid actions.
