# Weather

Wind and temperature for the map's conditions panel and your scent cone.

## Source: National Weather Service

- `api.weather.gov` is free, needs no key, and covers the US only. The phone calls it directly; it never goes through our backend.
- Requests send `User-Agent: HuntClubMesh/<app version>` (`NWS_USER_AGENT` in `nwsClient.ts`). No contact details or user data are sent.
- There are two requests. First `GET /points/{lat},{lon}`, with the coordinates rounded to 4 decimals (NWS redirects when there are more). Then `GET` the `properties.forecastHourly` URL that response returns.
- From each hour, `nws.ts` keeps the wind speed in mph, the direction the wind blows **from** in degrees, and the temperature in °F. A calm hour arrives as `"0 mph"` with direction `""`, which becomes `null`.
- `nwsClient.ts` never throws. It returns `ok`, `outsideCoverage` (the points request answered 404) or `failed`.

## Cache rules (`FORECAST_POLICY` in `forecast.ts`)

- The cache is one JSON file, `documents/weather/forecast.json`, written with `storage/documents.ts`. It holds the fetch time, the place it was fetched for, and the hours.
- It keeps up to **18 hours** that haven't ended. That is enough for a morning sync to cover the evening sit with the phone offline all day.
- It refreshes when online and the forecast is older than **1 hour**, when you have moved **5 km**, or when nothing usable is cached.
- A cached forecast applies within **40 km** of where it was fetched.
- Attempts are spaced at least **1 min** apart, and **5 min** after a failure, so panning the map can't flood NWS with requests.
- Once the forecast is over 1 hour old, the panel adds "Updated N hr ago".

## When the panel shows "—"

- Outside the US (NWS has no data for the point).
- Offline, or after an API failure, with no usable cache.
- More than 40 km from where the cached forecast was fetched.
- Every cached hour has ended. An old hour is never shown as the current one.

"Calm" (the speed rounds to 0 mph) shows no arrow and no scent cone. A speed with no direction shows the speed only.

## Using it

Call `useConditions(place, now)`. It returns a `WeatherNow` (see `display.ts`): the forecast hour's raw wind and temperature. The map passes it to `conditionsReadout()` in `@huntclub/shared` (`readout.ts`), which words the readout strip (sunrise, sunset, wind from, temperature) and gives `YouMarker` its `wind.fromDeg` for the scent cone. The downwind direction always comes from `downwindBearing()` (`compass.ts`).
