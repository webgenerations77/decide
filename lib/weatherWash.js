// weatherWash — maps a day's forecast to a FAINT two-stop gradient drawn ONLY from
// theme tokens, so the same call themes itself for light/dark (it receives `colors`
// from useTheme). Returns { colors: [from, to] } for <LinearGradient>, or null when
// there's no usable forecast — callers then render no wash and fall back to the plain
// card. Pure: no React, no imports. Tested in __tests__/verify.mjs.
//
// Buckets mirror getWeatherEmoji's substring checks so the wash agrees with the emoji
// the card already shows. The condition string (wmoToCondition) is preferred; when it's
// absent — older saved plans and demo data carry only an emoji — we fall back to that.

// Condition/emoji → bucket. Returns null when there's nothing to key off.
export function weatherBucket(weather) {
  if (!weather || weather.beyondForecast) return null;

  const text = String(weather.condition || '').toLowerCase();
  const t = Number(weather.temp_f);
  const hot = Number.isFinite(t) && t >= 85;

  let b = null;
  if (text) {
    if (text.includes('thunder')) b = 'thunder';
    else if (text.includes('snow') || text.includes('blizzard') || text.includes('ice')) b = 'snow';
    else if (text.includes('rain') || text.includes('drizzle') || text.includes('shower')) b = 'rain';
    else if (text.includes('fog') || text.includes('mist') || text.includes('haze')) b = 'fog';
    else if (text.includes('overcast')) b = 'overcast';
    else if (text.includes('partly') || text.includes('mostly')) b = 'partly';
    else if (text.includes('cloud')) b = 'overcast';
    else if (text.includes('clear') || text.includes('sunny')) b = 'clear';
  }

  if (!b) {
    switch (weather.emoji) {
      case '⛈': b = 'thunder'; break;
      case '❄️': b = 'snow'; break;
      case '🌧': b = 'rain'; break;
      case '🌫': b = 'fog'; break;
      case '☁️': b = 'overcast'; break;
      case '⛅':
      case '🌤': b = 'partly'; break;
      case '☀️': b = 'clear'; break;
      default: b = null;
    }
  }

  if (b === 'clear' && hot) b = 'hot';
  return b;
}

// weather + theme colors → gradient config for <LinearGradient colors={...} />, or null.
export function weatherWash(weather, colors) {
  if (!colors) return null;
  switch (weatherBucket(weather)) {
    case 'thunder':  return { colors: [colors.sky300, colors.sky200] };
    case 'snow':     return { colors: [colors.borderLight, colors.surface] };
    case 'rain':     return { colors: [colors.sky200, colors.sky100] };
    case 'fog':      return { colors: [colors.surfaceAlt, colors.border] };
    case 'overcast': return { colors: [colors.surfaceAlt, colors.border] };
    case 'partly':   return { colors: [colors.sky100, colors.surfaceAlt] };
    case 'clear':    return { colors: [colors.sky100, colors.surface] };
    case 'hot':      return { colors: [colors.surfaceAlt, colors.gold + '33'] };
    default:         return null;
  }
}
