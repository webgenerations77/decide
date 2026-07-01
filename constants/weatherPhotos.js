// Curated free stock photos shown behind itinerary weather cards, keyed by the bucket
// that weatherBucket() returns: clear | hot | partly | overcast | fog | rain | thunder | snow.
// An optional `default` is used when a saved plan has no usable forecast (so the card shows a
// nice scene instead of a bare gradient).
//
// HOW TO ACTIVATE (photos are bundled, so they work offline with no API key):
//   1. Drop approved images into decide-app/assets/weather/ using these filenames
//      (jpg, landscape, ~1200px wide, optimized): clear.jpg, hot.jpg, partly.jpg,
//      overcast.jpg, fog.jpg, rain.jpg, thunder.jpg, snow.jpg, default.jpg
//   2. Add the matching line below.
//
// WeatherArt falls back to its hand-drawn vector scene for any bucket with no entry here,
// so leaving some (or all) out is safe and the app still builds.
export const WEATHER_PHOTOS = {
  clear:    require('../assets/weather/clear.jpg'),
  hot:      require('../assets/weather/hot.jpg'),
  partly:   require('../assets/weather/partly.jpg'),
  overcast: require('../assets/weather/overcast.jpg'),
  fog:      require('../assets/weather/fog.jpg'),
  rain:     require('../assets/weather/rain.jpg'),
  thunder:  require('../assets/weather/thunder.jpg'),
  snow:     require('../assets/weather/snow.jpg'),
  default:  require('../assets/weather/default.jpg'),
};
