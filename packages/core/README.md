# @huntclub/core

Pure TypeScript hunting domain logic that the app's screens call. It is built on `@huntclub/mesh`: enums, message types and the codec are imported from there, never redefined. No React Native code.

```sh
npm test          # Jest in Node, multi-phone scenarios over mesh's FakeAir
npm run typecheck
```

| Module             | What                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkIn.ts`       | `CheckInController`: our check-in, one open at a time, mode switching without check-out, CheckIn/CheckOut messages, `sharingLocation`. `CheckInBoard`: everyone else's open check-ins |
| `overdue.ts`       | `overdueAt()` (sunset + grace, default 30 min) and `OverdueMonitor` (us and others, one OverdueAlert per check-in, jittered so one phone speaks for the party)                        |
| `help.ts`          | `HelpRequester`: Ask for a Hand. Retries with the same message id until the first Receipt or `cancel()`, with airtime-aware backoff                                                   |
| `receipts.ts`      | `ReceiptService` (de-duplicated, per-sender rate-limited, jittered receipts) and `DeliveryTracker` ("Delivered to N of M")                                                            |
| `party.ts`         | `FREE_PARTY_MAX_MEMBERS` (3), `canJoinParty`, `assertCanJoinParty`, `shouldShowPartyQr`                                                                                               |
| `testing/party.ts` | Test harness: a party of phones on one FakeAir with the core services running                                                                                                         |

All tunables (receipt rate limits, help backoff, overdue grace, prompt and wait times) live in one object, `CORE_CONFIG` in `config.ts`; services accept partial overrides.

Every service takes a `CoreContext` (`client`, plus optional `random`, `timers` and `now`), so tests can drive time and randomness.

Sunrise and sunset come from the map work (`app/src/conditions/sun.ts`, PR #6) and are passed in as `SunApi`. The module can be passed as is: `new OverdueMonitor(ctx, { sun: { sunTimes, localCalendarDay }, ... })`.
