# Weather card photos

Drop approved landscape photos here to replace the vector weather scenes on itinerary cards.
Filenames (png, ~1200px wide is plenty):

- `clear.png` — bright blue sky / sunny
- `hot.png` — hot, hazy sun / heat
- `partly.png` — partly cloudy, sun + clouds
- `overcast.png` — grey overcast sky
- `fog.png` — fog / mist
- `rain.png` — rain
- `thunder.png` — storm / lightning
- `snow.png` — snow
- `default.png` — a nice generic scene, used when a plan has no forecast

After adding files, uncomment the matching lines in `constants/weatherPhotos.js`.
Any bucket left without a photo falls back to the hand-drawn vector scene automatically.

Use only images you have the right to ship (CC0 / Unsplash / Pexels license). Keep the
license/attribution note for each source alongside this file if required.
