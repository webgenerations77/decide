// Curated free stock photos shown behind itinerary weather cards, keyed by the bucket
// that weatherBucket() returns: clear | hot | partly | overcast | fog | rain | thunder | snow.
// An optional `default` is used when a saved plan has no usable forecast (so the card shows a
// nice scene instead of a bare gradient).
//
// HOW TO ACTIVATE (photos are bundled, so they work offline with no API key):
//   1. Drop approved images into decide-app/assets/weather/ using these filenames
//      (png, landscape, ~1200px wide is plenty): clear.png, hot.png, partly.png,
//      overcast.png, fog.png, rain.png, thunder.png, snow.png, default.png
//   2. Uncomment the matching lines below.
//
// WeatherArt falls back to its hand-drawn vector scene for any bucket with no entry here,
// so leaving some (or all) commented out is safe and the app still builds.
export const WEATHER_PHOTOS = {
  clear:    require('../assets/weather/clear.png'),
  hot:      require('../assets/weather/hot.png'),
  partly:   require('../assets/weather/partly.png'),
  overcast: require('../assets/weather/overcast.png'),
  // fog: add assets/weather/fog.png then uncomment — falls back to the vector fog scene until then.
  rain:     require('../assets/weather/rain.png'),
  thunder:  require('../assets/weather/thunder.png'),
  snow:     require('../assets/weather/snow.png'),
  default:  require('../assets/weather/default.png'),
};
