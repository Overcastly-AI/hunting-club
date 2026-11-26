# Field test plan: one weekend with one club

For the owner. Goal: find out whether the app works in the woods, and what confuses people, before a wider release. The automated test `app/src/__tests__/fieldDay.test.tsx` runs the same scenarios on simulated radios; this plan checks them for real.

Group size: 3 hunters per party (the free limit), plus a 4th phone for the "party full" check. A whole club can run several parties at once.

## Before the weekend

**Radios**
- [ ] One Meshtastic radio per hunter, plus one spare. Charge everything fully.
- [ ] All radios on the same firmware, 2.6 or newer. Write the version below.
- [ ] Radios start on their own settings. The app sets up the party channel when the party starts.
- [ ] Close the official Meshtastic app on every phone. A radio talks to one phone at a time.

**Repeater (optional, recommended)**
- [ ] One Meshtastic node set to the ROUTER role, on solar power, on the highest ground with a clear view of the property.
- [ ] Do Saturday without it and Sunday with it, so you can compare range.

**Phones**
- [ ] A mix of iPhone and Android. Install the latest development build.
- [ ] On Wi-Fi at home, go through onboarding:
  - Pair the radio.
  - Enter a name and initials.
  - Allow location, Bluetooth and alerts.
  - Download the map for the property.
- [ ] If the club has a map pack (built by the admin on the website), sign in to the club on Wi-Fi so it downloads. Map layers then shows "Club map: downloaded …".
- [ ] **Club map pack check (one iPhone and one Android).** It is the first time the map reads a club pack straight from the phone, so check it before relying on it:
  - Turn on airplane mode, open the map and zoom into the property.
  - The club pack's detail shows where the pack covers, and the phone's own download (or plain background) shows outside it.
  - Write down on each phone: did the club map show, and did it look sharp at the closest zoom? If it does not show on either phone, tell the developers; the phone's own download still works.
- [ ] Bring battery packs and the charging cables for both phones and radios.

**Paper**
- [ ] Print the log sheet below, one per hunter per day, and a pencil.
- [ ] Write down the time of sunset for each day. The app shows sunrise and sunset only.

## Scenarios

Run these in order on day 1, then again on day 2 (with the repeater). Check each box, or write what happened instead.

**1. Start and join a party (at the truck, phones in airplane mode with Bluetooth on)**
- [ ] Hunter A starts a party. B and C scan A's Party QR code on the Party tab.
- [ ] All three see each other on the Party tab. A's QR code disappears once the party is full.
- [ ] A 4th phone scans a screenshot of the old code and is told the party is full.
- [ ] Each hunter's name and initials show on the others' phones, not the radio's default name.

**2. Check in (spread out to your hunting spots)**
- [ ] A checks in **At a spot**. B checks in **On the move**.
- [ ] Each sees the others on the map with the right label (spot name, or "On the move").
- [ ] Note how old each marker is when you look. The map shows how long ago each position was heard.

**3. Ask for a Hand (once per day, agreed in advance; say it's a test out loud first)**
- [ ] C taps **Ask for a Hand**.
- [ ] A and B get the alert with C's name and location.
- [ ] C's screen changes to "Seen by …" with the names of those whose phones received it. Note how long that took.
- [ ] C stops asking. Note what A's and B's phones show afterwards.

**4. Chat**
- [ ] A sends a text to the party. It changes to "Delivered to 2 of 2". Note how long it took.
- [ ] B replies with a quick reply. Try one direct message too.
- [ ] Close and reopen the app: the chat history is still there.

**5. Overdue (evening; one hunter stays checked in past sunset plus 30 minutes, safely within reach of the others)**
- [ ] At sunset plus 30 minutes, that hunter's phone asks "Still out?" first.
- [ ] They do not answer. About 10 minutes later, the other phones get the overdue alert.
- [ ] Next time, answer the prompt with **Extend**: no alert should go out.

## What to log

| What | How |
|---|---|
| Range by terrain | Distance between two hunters when texts stop arriving: open field, hardwoods, pines, across a valley or ridge. Use the map's distance, or a GPS track. |
| Battery per hour | Phone and radio battery % at check-in and at check-out. Note the phone model. |
| Position freshness | When you look at someone on the map, how old is their marker? |
| Delivery counts | For each text: "Delivered to N of M", and how many seconds it took. |
| Link drops | Times the app said "Radio out of reach", and how long until it reconnected. |
| Confusion points | Anything anyone asked about, tapped twice, or read out loud with a frown. Write down their exact words. |

## Results template

Copy this once per day.

```
Date:                Weather:              Sunset:
Repeater:  yes / no     Where:
Firmware version(s):

Hunter | Phone (model, iOS/Android) | Radio | Battery start → end (phone / radio) | Hours out
-------|----------------------------|-------|-------------------------------------|----------
A      |                            |       |                                     |
B      |                            |       |                                     |
C      |                            |       |                                     |

Scenario            | Worked? | Time taken | Notes
--------------------|---------|------------|------
1. Party            |         |            |
2. Check in         |         |            |
3. Ask for a Hand   |         |            |
4. Chat             |         |            |
5. Overdue          |         |            |

Range (terrain → distance when texts stopped):

Link drops (time, how long):

Confusion points (who, what they said):

Top 3 things to fix:
1.
2.
3.
```
