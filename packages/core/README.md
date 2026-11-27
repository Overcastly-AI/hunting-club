# @huntclub/core

Pure TypeScript hunting domain logic that the app's screens call. It is built on `@huntclub/mesh`: enums, message types and the codec are imported from there, never redefined. No React Native code.

```sh
npm test          # Jest in Node, multi-phone scenarios over mesh's FakeAir
npm run typecheck
```

| Module             | What                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config.ts`        | `CORE_CONFIG`: every tunable in one place                                                                                                                                                                                                                                            |
| `checkIn.ts`       | `CheckInController`: our check-in, one open at a time, mode switching without check-out, CheckIn/CheckOut messages, `sharingLocation`. `CheckInBoard`: everyone else's open check-ins                                                                                                |
| `overdue.ts`       | `overdueAt()` (sunset + grace, or a later extension) and `OverdueMonitor`. At our own deadline it prompts first (`selfPrompt`; answer with `extend()` or check-out) and alerts after `selfPromptMinutes` of silence. Other phones wait `othersDelayMinutes`, then one of them alerts |
| `help.ts`          | `HelpRequester`: Ask for a Hand. Retries with the same message id until the first Receipt or `cancel()`, with airtime-aware backoff                                                                                                                                                  |
| `receipts.ts`      | `ReceiptService` (de-duplicated, per-sender rate-limited, jittered receipts) and `DeliveryTracker` ("Delivered to N of M")                                                                                                                                                           |
| `party.ts`         | `FREE_PARTY_MAX_MEMBERS` (3), `canJoinParty`, `assertCanJoinParty`, `shouldShowPartyQr`                                                                                                                                                                                              |
| `partyService.ts`  | `PartyService`: create a party, join from a scanned link (app or web form), leave, roster from what the radio hears on the party channel, party-full refusal and `overCapacity`                                                                                                      |
| `partyStore.ts`    | `PartyStore` port the app implements (SQLite plus secure storage for the join link), and `MemoryPartyStore`                                                                                                                                                                          |
| `testing/party.ts` | Test harness: a party of phones on one FakeAir with the core services running                                                                                                                                                                                                        |

All tunables (receipt rate limits, help backoff, overdue grace, prompt and wait times) live in one object, `CORE_CONFIG` in `config.ts`; services accept partial overrides.

Every service takes a `CoreContext` (`client`, plus optional `random`, `timers` and `now`), so tests can drive time and randomness.

Sunrise and sunset are computed on the device by `sun.ts` in `@huntclub/shared` (`SUN`, `sunTimes`, `localCalendarDay`), which this package re-exports. `OverdueMonitor` uses `SUN` by default; tests pass a fixed `SunApi` instead.

Position freshness (fresh under 2 min, stale to 10 min, faded after: `FRESHNESS_THRESHOLDS_MS`, `classifyFreshness`, `describeFreshness`) lives in `freshness.ts` in `@huntclub/shared`, so the app, the web admin and the site legend read it the same way; this package re-exports it. The time units (`MINUTE_MS` and so on) come from `@huntclub/shared` too.
