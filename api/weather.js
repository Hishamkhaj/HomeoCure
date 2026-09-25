export default async function handler(req, res) {
  try {
    // HomeoCure clinic location: Gonda city, Uttar Pradesh.
    const latitude = 27.13366;
    const longitude = 81.96322;

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("timezone", "Asia/Kolkata");
    url.searchParams.set("forecast_days", "3");
    url.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m"
    );
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,rain_sum,weather_code"
    );

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return res.status(502).json({ error: "Weather provider unavailable" });
    }

    const data = await response.json();
    const code = Number(data.current?.weather_code);

    const description = (weatherCode) => ({
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Rime fog",
      51: "Light drizzle",
      53: "Drizzle",
      55: "Heavy drizzle",
      61: "Light rain",
      63: "Rain",
      65: "Heavy rain",
      71: "Light snow",
      73: "Snow",
      75: "Heavy snow",
      80: "Rain showers",
      81: "Rain showers",
      82: "Heavy rain showers",
      95: "Thunderstorm",
      96: "Thunderstorm with hail",
      99: "Thunderstorm with hail",
    }[weatherCode] || "Mixed conditions");

    const rainProbability = Number(data.daily?.precipitation_probability_max?.[0] ?? 0);
    const rainMm = Number((data.daily?.precipitation_sum?.[0] ?? 0).toFixed(1));

    return res.status(200).json({
      location: "Gonda",
      temperature: Math.round(Number(data.current?.temperature_2m ?? 0)),
      feels_like: Math.round(Number(data.current?.apparent_temperature ?? 0)),
      condition: description(code),
      rain_probability: rainProbability,
      precipitation_mm: Number(data.current?.precipitation ?? 0),
      wind_kmh: Math.round(Number(data.current?.wind_speed_10m ?? 0)),
      today_high: Math.round(Number(data.daily?.temperature_2m_max?.[0] ?? 0)),
      today_low: Math.round(Number(data.daily?.temperature_2m_min?.[0] ?? 0)),
      today_rain_mm: rainMm,
      today_rain_probability: rainProbability,
      advisory:
        rainProbability >= 80 || rainMm >= 20 || [95, 96, 99].includes(code)
          ? "Weather may materially affect travel and walk-in patient flow today."
          : rainProbability >= 60 || rainMm >= 8
            ? "Rain risk is elevated; patient flow may be softer during bad-weather hours."
            : null,
      source: "Open-Meteo",
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to fetch weather" });
  }
}

