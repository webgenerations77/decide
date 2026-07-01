# Weather card photos

Drop approved landscape photos here to replace the vector weather scenes on itinerary cards.
Filenames (jpg, ~1200px wide, optimized ~50–130 KB each):

- `clear.jpg` — bright blue sky / sunny
- `hot.jpg` — hot, hazy sun / heat
- `partly.jpg` — partly cloudy, sun + clouds
- `overcast.jpg` — grey overcast sky
- `fog.jpg` — fog / mist
- `rain.jpg` — rain
- `thunder.jpg` — storm / lightning
- `snow.jpg` — snow
- `default.jpg` — a nice generic scene, used when a plan has no forecast

After adding files, add the matching line in `constants/weatherPhotos.js`.
Tip: to optimize a full-res source, resize to 1200px wide and save as JPG q≈82.
Any bucket left without a photo falls back to the hand-drawn vector scene automatically.

Use only images you have the right to ship (CC0 / Unsplash / Pexels license). Keep the
license/attribution note for each source alongside this file if required.
