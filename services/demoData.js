// Hardcoded demo dataset — Eastern Shore & Chesapeake Bay, MD. Zero API calls.
// 7 itinerary sets covering all preference combinations; 5-category spin pool.

// ─── Itinerary pool ───────────────────────────────────────────────────────────

const DEMO_ITINERARIES = [

  // ── SET 1: Berlin, MD — Saturday · Sunny 74°F · Moderate · $$ · Couple ──────
  {
    weather: { emoji: '☀️', condition: 'Sunny', temp_f: '74', wind_speed_mph: '8' },
    meta: {
      day_of_week: 'Saturday', date: 'June 14, 2025',
      time_window: '11:00 AM – 8:00 PM',
      preferences: { pace: 'moderate', budget: '$$', group_type: 'couple' },
      city: 'Berlin, MD',
    },
    isFallback: false,
    itinerary: [
      {
        time: '11:00 AM', duration_mins: 90, category: 'outdoor',
        name: 'Assateague Island National Seashore', place_id: 'demo_assateague',
        address: '7206 National Seashore Ln, Berlin, MD 21811',
        lat: 38.2354, lng: -75.1605, rating: 4.9, distance: '8.1 mi',
        reason: "Wild horses have roamed these barrier island beaches for centuries — a genuinely rare experience just 15 minutes from Berlin. On a sunny 74°F morning, the north beach is uncrowded and the ponies are most active near the shoreline. Perfect romantic start for a couple who wants something memorable.",
        excitement_score: 96,
        highlights: [
          { type: 'feature', text: 'Wild ponies roam freely — most active at north beach 11am' },
          { type: 'feature', text: 'Pristine Atlantic barrier island, zero development' },
          { type: 'special', text: '$25/vehicle day pass — no reservation needed' },
          { type: 'buzz',    text: 'National Geographic top US beach experience' },
        ],
      },
      {
        time: '1:00 PM', duration_mins: 60, category: 'food',
        name: 'The Globe Theatre & Restaurant', place_id: 'demo_globe',
        address: '12 Broad St, Berlin, MD 21811',
        lat: 38.3226, lng: -75.2179, rating: 4.7, distance: '0.3 mi',
        phone: '+14106410784', website: 'https://theglobetheatrerestaurant.com',
        reason: "This restored 1908 vaudeville theatre is the beating heart of Berlin — farm-to-table food sourced from local Eastern Shore farms, with craft beers brewed down the street at Burley Oak. Saturday afternoon means live acoustic music, and the crab cake sandwich is the best $14 you'll spend all day.",
        excitement_score: 91,
        highlights: [
          { type: 'entertainment', text: 'Live acoustic music every Saturday afternoon' },
          { type: 'feature',       text: 'Restored 1908 vaudeville theatre — stunning interior' },
          { type: 'special',       text: 'Local crab cake sandwich — $14, best in Berlin' },
          { type: 'buzz',          text: 'Southern Living "Best Small Town Restaurant"' },
        ],
      },
      {
        time: '2:30 PM', duration_mins: 75, category: 'activity',
        name: 'Downtown Berlin Historic District', place_id: 'demo_berlin_downtown',
        address: 'Main St, Berlin, MD 21811',
        lat: 38.3230, lng: -75.2183, rating: 4.6, distance: '0.1 mi',
        reason: "Voted Coolest Small Town in America — Victorian storefronts housing independent bookshops, art galleries, and antique stores with zero chain stores in sight. This is where Runaway Bride was filmed, and on weekends the farmers market fills Main Street with local vendors.",
        excitement_score: 88,
        highlights: [
          { type: 'buzz',          text: "Voted 'Coolest Small Town in America' — Budget Travel" },
          { type: 'feature',       text: 'Film location for Runaway Bride (1999)' },
          { type: 'entertainment', text: 'Weekend farmers market with local vendors and food' },
          { type: 'feature',       text: 'Zero chain stores — all independent local businesses' },
        ],
      },
      {
        time: '4:00 PM', duration_mins: 60, category: 'outdoor',
        name: 'Turville Creek Water Trail', place_id: 'demo_turville',
        address: 'Public Landing Rd, Berlin, MD 21811',
        lat: 38.3050, lng: -75.1900, rating: 4.5, distance: '2.4 mi',
        reason: "Paddle through one of Maryland's most pristine coastal wetland systems as the afternoon light turns golden — osprey and great blue herons are nearly guaranteed sightings. Kayak rentals are right at the landing with no reservation needed, and the sunset paddle route is marked and beginner-friendly.",
        excitement_score: 84,
        highlights: [
          { type: 'feature', text: 'Osprey and great blue herons — nearly guaranteed sightings' },
          { type: 'special', text: 'Walk-up kayak rentals right at the landing' },
          { type: 'feature', text: 'Marked sunset paddle route — perfect for beginners' },
          { type: 'buzz',    text: "Maryland DNR 'Premier Paddle Trail' designation" },
        ],
      },
      {
        time: '5:30 PM', duration_mins: 45, category: 'shopping',
        name: 'Burley Oak Brewing Company', place_id: 'demo_burley_oak',
        address: '10016 Old Ocean City Blvd, Berlin, MD 21811',
        lat: 38.3260, lng: -75.2210, rating: 4.8, distance: '1.2 mi',
        phone: '+14102510118', website: 'https://burleyoak.com',
        reason: "Maryland's most decorated craft brewery in a converted 1930s building, with a sprawling outdoor beer garden that fills up with locals on Saturday evenings. The live music starts at 6pm and this is exactly the kind of place that makes you want to move to a small town.",
        excitement_score: 89,
        highlights: [
          { type: 'entertainment', text: 'Live music Saturdays at 6pm in the beer garden' },
          { type: 'feature',       text: 'Dogs welcome — outdoor beer garden with fire pits' },
          { type: 'buzz',          text: 'Multiple Great American Beer Festival medals' },
          { type: 'special',       text: 'Taproom flight: 5 beers for $12' },
        ],
      },
      {
        time: '7:00 PM', duration_mins: 90, category: 'food',
        name: "Fager's Island Restaurant", place_id: 'demo_fagers',
        address: '60th St, Ocean City, MD 21842',
        lat: 38.3789, lng: -75.0666, rating: 4.7, distance: '12.3 mi',
        phone: '+14102898400', website: 'https://fagers.com',
        reason: "An Ocean City institution since 1975, Fager's has the best bay sunset view on the entire Eastern Shore — the deck faces due west and at 7pm in June the light is extraordinary. Live band plays nightly and the raw bar happy hour runs until 7pm.",
        excitement_score: 94,
        highlights: [
          { type: 'entertainment', text: 'Live band nightly on the bay deck' },
          { type: 'special',       text: 'Raw bar happy hour until 7pm — half-price oysters' },
          { type: 'feature',       text: 'Bay deck faces due west — perfect June sunset at 7pm' },
          { type: 'buzz',          text: 'Ocean City institution since 1975' },
        ],
      },
    ],
  },

  // ── SET 2: Ocean City, MD — Sunday · Partly Cloudy 66°F · Relaxed · $ · Solo ─
  {
    weather: { emoji: '🌤', condition: 'Partly Cloudy', temp_f: '66', wind_speed_mph: '12' },
    meta: {
      day_of_week: 'Sunday', date: 'June 15, 2025',
      time_window: '11:00 AM – 8:30 PM',
      preferences: { pace: 'relaxed', budget: '$', group_type: 'solo' },
      city: 'Ocean City, MD',
    },
    isFallback: false,
    itinerary: [
      {
        time: '11:00 AM', duration_mins: 60, category: 'outdoor',
        name: 'Ocean City Boardwalk Morning Walk', place_id: 'demo_oc_boardwalk_am',
        address: 'Atlantic Ave & Boardwalk, Ocean City, MD 21842',
        lat: 38.3365, lng: -75.0849, rating: 4.6, distance: '0.1 mi',
        reason: "Starting the morning with a solo boardwalk walk hits different before the crowd arrives — three miles of Atlantic views with just the sound of waves and early-rising joggers. The shops don't open until noon, which makes it the perfect meditative start to a relaxed Sunday.",
        excitement_score: 82,
        highlights: [
          { type: 'feature', text: 'Three miles of boardwalk — entirely flat and walkable' },
          { type: 'feature', text: 'Uncrowded before noon on Sundays' },
          { type: 'buzz',    text: "One of the East Coast's longest continuous boardwalks" },
        ],
      },
      {
        time: '12:30 PM', duration_mins: 60, category: 'food',
        name: "Dumser's Dairyland", place_id: 'demo_dumsers',
        address: '49th St & Coastal Hwy, Ocean City, MD 21842',
        lat: 38.3634, lng: -75.0716, rating: 4.5, distance: '2.1 mi',
        reason: "An OC institution since 1939, Dumser's serves the kind of enormous slightly-messy ice cream you feel vaguely guilty about and completely don't regret. The lunch counter also does cheap, solid diner food — a $10 lunch with dessert included is unbeatable for a solo budget day.",
        excitement_score: 84,
        highlights: [
          { type: 'buzz',    text: 'OC institution since 1939 — five generations, same family' },
          { type: 'special', text: 'Lunch combo + ice cream under $10' },
          { type: 'feature', text: 'Hand-packed pints to take home' },
        ],
      },
      {
        time: '2:00 PM', duration_mins: 90, category: 'activity',
        name: 'Ocean City Life-Saving Station Museum', place_id: 'demo_lifesaving_museum',
        address: '813 S Atlantic Ave, Ocean City, MD 21842',
        lat: 38.3258, lng: -75.0851, rating: 4.4, distance: '1.8 mi',
        reason: "Housed in an actual 1891 rescue station right on the beach, this small museum tells the story of surfmen who risked their lives to pull sailors from shipwrecked boats. Usually quiet on Sundays — perfect for a solo wander through OC history.",
        excitement_score: 79,
        highlights: [
          { type: 'feature',       text: 'Original 1891 life-saving station building — still standing' },
          { type: 'special',       text: 'Free admission on Sundays' },
          { type: 'buzz',          text: 'Smithsonian affiliate collection' },
          { type: 'entertainment', text: 'Live rescue demonstrations on summer weekends' },
        ],
      },
      {
        time: '4:00 PM', duration_mins: 90, category: 'outdoor',
        name: 'Assateague Island South Entrance', place_id: 'demo_assateague_south',
        address: '7206 National Seashore Ln, Berlin, MD 21811',
        lat: 38.2354, lng: -75.1605, rating: 4.9, distance: '10.4 mi',
        reason: "The south entrance to Assateague is less visited than the north beach — more space to decompress and a better chance of a private pony encounter. Late afternoon light on the Atlantic in June is golden and the water is warm enough for wading.",
        excitement_score: 88,
        highlights: [
          { type: 'feature', text: 'South beach has fewer visitors — more space to yourself' },
          { type: 'feature', text: 'Wild ponies frequently near south beach dunes late afternoon' },
          { type: 'special', text: 'Same day pass as morning — already paid' },
        ],
      },
      {
        time: '6:00 PM', duration_mins: 30, category: 'food',
        name: 'Fractured Prune Ocean City', place_id: 'demo_fractured_prune',
        address: '507 S Atlantic Ave, Ocean City, MD 21842',
        lat: 38.3267, lng: -75.0851, rating: 4.3, distance: '2.2 mi',
        reason: "Fractured Prune's made-to-order hot glazed donuts are one of OC's most iconic things — you pick your glaze and topping and watch them made fresh. A $6 half-dozen to eat on a boardwalk bench is one of the best solo travel snacks on the East Coast.",
        excitement_score: 81,
        highlights: [
          { type: 'feature', text: 'Custom-glazed donuts made to order — endless combos' },
          { type: 'special', text: '6 donuts for $6 — best boardwalk value' },
          { type: 'buzz',    text: 'Featured on Food Network and multiple travel lists' },
        ],
      },
      {
        time: '7:30 PM', duration_mins: 90, category: 'food',
        name: 'Ropewalk Restaurant', place_id: 'demo_ropewalk',
        address: '201 S Atlantic Ave, Ocean City, MD 21842',
        lat: 38.3311, lng: -75.0850, rating: 4.5, distance: '1.4 mi',
        phone: '+14102891996', website: 'https://theropewalkok.com',
        reason: "Ropewalk's open-air rooftop deck has some of the best Atlantic views in Ocean City — a solo dinner here watching the ocean at sunset is genuinely great. The raw bar is strong and the craft beer list is better than anywhere else in OC.",
        excitement_score: 87,
        highlights: [
          { type: 'feature',       text: 'Open-air rooftop deck with direct Atlantic views' },
          { type: 'special',       text: 'Half-price raw bar 4–6pm daily' },
          { type: 'entertainment', text: 'Live acoustic music Sunday evenings' },
          { type: 'buzz',          text: 'Best craft beer list in Ocean City' },
        ],
      },
    ],
  },

  // ── SET 3: Annapolis, MD — Saturday · Clear 78°F · Packed · $$$ · Friends ────
  {
    weather: { emoji: '☀️', condition: 'Clear', temp_f: '78', wind_speed_mph: '10' },
    meta: {
      day_of_week: 'Saturday', date: 'June 21, 2025',
      time_window: '10:00 AM – 9:00 PM',
      preferences: { pace: 'packed', budget: '$$$', group_type: 'friends' },
      city: 'Annapolis, MD',
    },
    isFallback: false,
    itinerary: [
      {
        time: '10:00 AM', duration_mins: 75, category: 'activity',
        name: 'U.S. Naval Academy Grounds Tour', place_id: 'demo_naval_academy',
        address: '121 Blake Rd, Annapolis, MD 21402',
        lat: 38.9897, lng: -76.4843, rating: 4.8, distance: '1.2 mi',
        reason: "Walking through the Naval Academy with a group is one of those experiences that stops conversation — the architecture is stunning, the parade ground is massive, and midshipmen sailing on the Severn in the background makes for incredible photos. The free walking tour covers the full campus in under 90 minutes.",
        excitement_score: 91,
        highlights: [
          { type: 'feature', text: 'Bancroft Hall — largest dormitory in the world' },
          { type: 'feature', text: 'Midshipmen sailing drills visible from the seawall' },
          { type: 'special', text: 'Free self-guided tour — show ID at the gate' },
          { type: 'buzz',    text: "Top 5 most-visited sites in Maryland" },
        ],
      },
      {
        time: '12:00 PM', duration_mins: 75, category: 'food',
        name: "Carrol's Creek Café", place_id: 'demo_carrolscreek',
        address: '410 Severn Ave, Annapolis, MD 21403',
        lat: 38.9765, lng: -76.4881, rating: 4.6, distance: '0.8 mi',
        phone: '+14102636323', website: 'https://carrolscreek.com',
        reason: "Sitting on the waterfront at Carrol's Creek with Annapolis City Dock behind you is the definitive Annapolis experience — this is where locals take visitors when they want to impress. The Maryland cream of crab soup is the benchmark recipe and the outdoor deck fills fast.",
        excitement_score: 89,
        highlights: [
          { type: 'feature',       text: 'Waterfront deck with full City Dock panorama' },
          { type: 'special',       text: 'Maryland Cream of Crab soup — the benchmark recipe' },
          { type: 'entertainment', text: 'Live jazz Saturday brunch' },
          { type: 'buzz',          text: "Annapolis's most consistently reviewed restaurant" },
        ],
      },
      {
        time: '2:00 PM', duration_mins: 90, category: 'outdoor',
        name: 'Ego Alley & City Dock', place_id: 'demo_ego_alley',
        address: 'City Dock, Annapolis, MD 21401',
        lat: 38.9784, lng: -76.4832, rating: 4.7, distance: '0.6 mi',
        reason: "Ego Alley is Annapolis's famous narrow inlet where boat owners parade their yachts — watching million-dollar boats attempt tight U-turns while crowds cheer from the dock is legitimately entertaining. This is the social heart of the city and the best place to experience the sailing culture that defines Annapolis.",
        excitement_score: 85,
        highlights: [
          { type: 'entertainment', text: 'Watch yachts perform U-turns to audience applause' },
          { type: 'feature',       text: 'Historic market house and waterfront square' },
          { type: 'buzz',          text: "Called the 'Sailing Capital of the US' for good reason" },
        ],
      },
      {
        time: '4:00 PM', duration_mins: 75, category: 'shopping',
        name: 'Maryland Avenue Historic District', place_id: 'demo_maryland_ave',
        address: 'Maryland Ave, Annapolis, MD 21401',
        lat: 38.9793, lng: -76.4913, rating: 4.5, distance: '0.3 mi',
        reason: "Maryland Avenue is Annapolis's gallery row — independent art dealers, antique shops, and jewelers in 18th-century brick buildings. For a group it's the best place to split up and reconvene — some people want antiques, others galleries, everyone finds something unexpected.",
        excitement_score: 82,
        highlights: [
          { type: 'feature', text: "Densest concentration of independent galleries in MD" },
          { type: 'feature', text: '18th century brick row houses — unchanged streetscape' },
          { type: 'special', text: 'Several shops do free gift wrapping and local shipping' },
        ],
      },
      {
        time: '5:30 PM', duration_mins: 60, category: 'food',
        name: 'Galway Bay Irish Restaurant', place_id: 'demo_galway_bay',
        address: '63 Maryland Ave, Annapolis, MD 21401',
        lat: 38.9793, lng: -76.4916, rating: 4.5, distance: '0.1 mi',
        phone: '+14102635396', website: 'https://galwaybaymd.com',
        reason: "Galway Bay has anchored Maryland Avenue for over 30 years — solid Irish-American food, a serious whiskey selection, and happy hour 4–7pm that's one of the best deals in Annapolis. The long communal tables in the bar room are perfect for a group.",
        excitement_score: 86,
        highlights: [
          { type: 'special',       text: 'Happy hour 4–7pm — $5 drafts, half-price apps' },
          { type: 'entertainment', text: 'Traditional Irish music Friday and Saturday evenings' },
          { type: 'feature',       text: '100+ whiskeys from Ireland, Scotland, and the US' },
          { type: 'buzz',          text: 'Maryland Avenue institution since 1990' },
        ],
      },
      {
        time: '7:30 PM', duration_mins: 90, category: 'outdoor',
        name: 'Annapolis Harbor Sunset Sail', place_id: 'demo_harbor_sail',
        address: 'City Dock, Annapolis, MD 21401',
        lat: 38.9784, lng: -76.4832, rating: 4.8, distance: '0.5 mi',
        reason: "A two-hour sunset sail out of Annapolis City Dock is the perfect end to a packed friends day — Chesapeake Bay at dusk, drinks on deck, and the Annapolis skyline behind you. Schooner sails run nightly through summer and this will be the photo everyone posts.",
        excitement_score: 95,
        highlights: [
          { type: 'entertainment', text: 'Two-hour sunset sail on a classic schooner' },
          { type: 'special',       text: 'BYO drinks allowed on evening sails' },
          { type: 'feature',       text: 'Chesapeake Bay at dusk — color photography guaranteed' },
          { type: 'buzz',          text: 'TripAdvisor Top Experience in Maryland' },
        ],
      },
    ],
  },

  // ── SET 4: Ocean City, MD — Saturday · Rainy 58°F · Moderate · $$ · Family ──
  {
    weather: { emoji: '🌧', condition: 'Rainy', temp_f: '58', wind_speed_mph: '18' },
    meta: {
      day_of_week: 'Saturday', date: 'June 7, 2025',
      time_window: '10:00 AM – 7:30 PM',
      preferences: { pace: 'moderate', budget: '$$', group_type: 'family' },
      city: 'Ocean City, MD',
    },
    isFallback: false,
    itinerary: [
      {
        time: '10:00 AM', duration_mins: 90, category: 'activity',
        name: "Ripley's Believe It or Not! Ocean City", place_id: 'demo_ripleys',
        address: '401 S Atlantic Ave, Ocean City, MD 21842',
        lat: 38.3273, lng: -75.0851, rating: 4.2, distance: '0.2 mi',
        reason: "Ripley's is genuinely excellent rainy day family content — exhibits are weird enough for teenagers and approachable for younger kids, with constant 'wait, is that real?' moments. The laser maze and mirror maze sections alone justify admission for families.",
        excitement_score: 83,
        highlights: [
          { type: 'feature',       text: 'Laser maze, mirror maze, and moving theater — all included' },
          { type: 'entertainment', text: 'Interactive exhibits hold all age groups' },
          { type: 'special',       text: 'Family 4-pack saves $20 vs individual admission' },
          { type: 'buzz',          text: "Kids' Choice Award winner — OC's top rainy day pick" },
        ],
      },
      {
        time: '12:00 PM', duration_mins: 60, category: 'food',
        name: 'Galaxy 66 Bar & Grille', place_id: 'demo_galaxy66',
        address: '6601 Coastal Hwy, Ocean City, MD 21842',
        lat: 38.3920, lng: -75.0658, rating: 4.4, distance: '1.8 mi',
        reason: "Galaxy 66 does generous American portions that satisfy everyone from picky kids to adults — the fish tacos and crab dip are the orders. Booth seating fits a family comfortably and the family-sized appetizer plates make sharing easy.",
        excitement_score: 78,
        highlights: [
          { type: 'special', text: 'Kids eat free Sunday lunch with adult entrée' },
          { type: 'feature', text: 'Large booth seating — great for groups and families' },
          { type: 'feature', text: 'OC crab dip — crowd-pleaser for all ages' },
        ],
      },
      {
        time: '1:30 PM', duration_mins: 90, category: 'activity',
        name: 'Jolly Roger Amusement Park Arcade', place_id: 'demo_jolly_roger',
        address: '30th St & Coastal Hwy, Ocean City, MD 21842',
        lat: 38.3520, lng: -75.0760, rating: 4.3, distance: '1.4 mi',
        reason: "The Jolly Roger Arcade is a full indoor entertainment complex with bowling, laser tag, and 300+ arcade games — designed for exactly this weather situation. Kids burn energy on games while parents use the bar, and the prize redemption at the end is a ritual every kid loves.",
        excitement_score: 86,
        highlights: [
          { type: 'entertainment', text: 'Indoor bowling, laser tag, and 300+ arcade games' },
          { type: 'feature',       text: "Adults-only bar inside — parents sorted" },
          { type: 'special',       text: 'Unlimited game card $25/person for 90 minutes' },
        ],
      },
      {
        time: '3:30 PM', duration_mins: 60, category: 'shopping',
        name: "Trimper's Rides & Boardwalk Shops", place_id: 'demo_trimpers',
        address: 'S Division St & Boardwalk, Ocean City, MD 21842',
        lat: 38.3268, lng: -75.0851, rating: 4.1, distance: '1.2 mi',
        reason: "Trimper's has been the classic OC family ride experience since 1893 — the covered carousel with hand-carved horses is genuinely beautiful and worth the stop. The covered boardwalk section stays dry in rain and adjacent souvenir shops let everyone stock up on OC magnets and salt water taffy.",
        excitement_score: 76,
        highlights: [
          { type: 'feature',       text: '1902 carousel with hand-carved horses — National Historic Landmark' },
          { type: 'entertainment', text: 'Covered rides stay open in light rain' },
          { type: 'special',       text: 'Classic boardwalk taffy and fudge shops' },
          { type: 'buzz',          text: 'Operating continuously since 1893' },
        ],
      },
      {
        time: '5:00 PM', duration_mins: 90, category: 'food',
        name: 'Phillips Seafood Restaurant', place_id: 'demo_phillips',
        address: '21st St & Philadelphia Ave, Ocean City, MD 21842',
        lat: 38.3421, lng: -75.0786, rating: 4.3, distance: '0.9 mi',
        phone: '+14102891191', website: 'https://phillipsseafood.com',
        reason: "Phillips is the classic family seafood experience in Ocean City — enormous portions, a kid-friendly menu, and the Chesapeake steamed crab tradition done right in a setting large enough that nobody worries about noise levels. The all-you-can-eat crab legs is the move for families.",
        excitement_score: 84,
        highlights: [
          { type: 'feature', text: 'All-you-can-eat Dungeness crab legs option available' },
          { type: 'special', text: "Kids' menu with hand-breaded fish fingers — not frozen" },
          { type: 'buzz',    text: 'OC seafood institution since 1956' },
        ],
      },
      {
        time: '7:00 PM', duration_mins: 60, category: 'activity',
        name: 'OC Escape Room Experience', place_id: 'demo_escape_room',
        address: '7200 Coastal Hwy, Ocean City, MD 21842',
        lat: 38.3990, lng: -75.0640, rating: 4.5, distance: '2.1 mi',
        reason: "An escape room is the perfect rainy evening family activity — it requires real teamwork, keeps everyone engaged, and produces memories that get retold for years. OC escape rooms have family-rated options designed to be solvable with kids in the group.",
        excitement_score: 87,
        highlights: [
          { type: 'entertainment', text: 'Family-rated rooms designed for mixed-age groups' },
          { type: 'feature',       text: 'Private 60-minute room — just your family' },
          { type: 'special',       text: 'Book online for 15% off walk-in price' },
        ],
      },
    ],
  },

  // ── SET 5: Eastern Shore — Wednesday · Sunny 71°F · Relaxed · $ · Solo ───────
  {
    weather: { emoji: '☀️', condition: 'Sunny', temp_f: '71', wind_speed_mph: '7' },
    meta: {
      day_of_week: 'Wednesday', date: 'June 18, 2025',
      time_window: '11:00 AM – 8:00 PM',
      preferences: { pace: 'relaxed', budget: '$', group_type: 'solo' },
      city: 'Berlin, MD',
    },
    isFallback: false,
    itinerary: [
      {
        time: '11:00 AM', duration_mins: 60, category: 'food',
        name: 'Blacksmith Restaurant', place_id: 'demo_blacksmith',
        address: '111 N Main St, Berlin, MD 21811',
        lat: 38.3228, lng: -75.2180, rating: 4.5, distance: '0.1 mi',
        reason: "The Blacksmith is a converted late 19th-century forge that never lost its bones — exposed brick, original tools on the walls, and farm-to-table food that showcases whatever's growing on the Eastern Shore right now. A solo weekday lunch here is a genuinely unhurried experience.",
        excitement_score: 85,
        highlights: [
          { type: 'feature', text: 'Original forge and tools displayed in the dining room' },
          { type: 'special', text: 'Weekday lunch specials under $12 with local ingredients' },
          { type: 'buzz',    text: "Maryland's Best Farm-to-Table — Eastern Shore Living" },
        ],
      },
      {
        time: '12:30 PM', duration_mins: 60, category: 'activity',
        name: 'Berlin Main Street & Antique Walk', place_id: 'demo_berlin_main',
        address: 'Main St, Berlin, MD 21811',
        lat: 38.3228, lng: -75.2180, rating: 4.6, distance: '0.0 mi',
        reason: "Berlin on a weekday is when you can actually have a conversation with the shop owners — the antique dealers know exactly what they have and love talking about it. No tourist crowds midweek means you actually discover things.",
        excitement_score: 80,
        highlights: [
          { type: 'feature',       text: "Rayne's Reef Books — excellent used and rare selection" },
          { type: 'entertainment', text: 'Shop owners tell the history of what they sell' },
          { type: 'buzz',          text: 'Most intact Victorian commercial streetscape in Maryland' },
        ],
      },
      {
        time: '2:00 PM', duration_mins: 120, category: 'outdoor',
        name: 'Pocomoke State Forest — Nassawango Trail', place_id: 'demo_pocomoke',
        address: '3036 Nassawango Rd, Pocomoke City, MD 21851',
        lat: 38.0752, lng: -75.4386, rating: 4.7, distance: '18.2 mi',
        reason: "The Nassawango cypress swamp trail is one of the most otherworldly environments in the mid-Atlantic — ancient bald cypress rising from dark water, complete silence, and a forest floor that feels prehistoric. Solo hiking here midweek means you may not see another person for two hours.",
        excitement_score: 88,
        highlights: [
          { type: 'feature', text: 'Ancient bald cypress swamp — trees over 600 years old' },
          { type: 'feature', text: 'Boardwalk trail through standing water — no mud' },
          { type: 'buzz',    text: "Nature Conservancy's most biodiverse site in Maryland" },
          { type: 'feature', text: 'Prothonotary warblers nest here May–August' },
        ],
      },
      {
        time: '4:30 PM', duration_mins: 60, category: 'outdoor',
        name: 'Snow Hill Historic Riverfront', place_id: 'demo_snow_hill',
        address: 'Green St, Snow Hill, MD 21863',
        lat: 38.1784, lng: -75.3904, rating: 4.4, distance: '8.6 mi',
        reason: "Snow Hill is Berlin's quieter neighbor on the Pocomoke River — an 18th century courthouse still in use and a riverside park where you can sit and watch the water without another tourist in sight. The kind of place you stumble upon and immediately think 'why doesn't anyone know about this'.",
        excitement_score: 79,
        highlights: [
          { type: 'feature', text: 'Working 18th century courthouse — still in use' },
          { type: 'feature', text: 'Pocomoke River waterfront — perfect for quiet reflection' },
          { type: 'buzz',    text: "'10 Hidden Gems of the Mid-Atlantic' — Travel + Leisure" },
        ],
      },
      {
        time: '6:00 PM', duration_mins: 60, category: 'food',
        name: 'Fin City Brewing Company', place_id: 'demo_fincity',
        address: '104 W Market St, Snow Hill, MD 21863',
        lat: 38.1784, lng: -75.3910, rating: 4.4, distance: '0.2 mi',
        reason: "Fin City is Snow Hill's craft brewery and it punches above its weight — the lagers are particularly good and the food menu is simple but solid. Solo travelers often end up in a great conversation with a local by their second pint.",
        excitement_score: 83,
        highlights: [
          { type: 'feature',       text: 'Small-batch lagers brewed on-site — seasonal rotation' },
          { type: 'entertainment', text: 'Local bluegrass music on weekends' },
          { type: 'special',       text: 'Brewery tour available with advance notice' },
        ],
      },
      {
        time: '7:30 PM', duration_mins: 45, category: 'outdoor',
        name: 'Assateague Island Sunset Drive', place_id: 'demo_assateague_sunset',
        address: '7206 National Seashore Ln, Berlin, MD 21811',
        lat: 38.2354, lng: -75.1605, rating: 4.9, distance: '14.8 mi',
        reason: "A late evening drive to Assateague for the sunset is one of those solo travel experiences that stays with you — golden hour light on the dune grass with ponies silhouetted against the sky. You don't even need to leave your car; the barrier island sunset is visible from the road.",
        excitement_score: 86,
        highlights: [
          { type: 'feature', text: 'Dune grass and Atlantic horizon — peak golden hour scenery' },
          { type: 'feature', text: 'Ponies often graze roadside at dusk' },
          { type: 'special', text: 'Day pass still valid for sunset drive — no extra charge' },
        ],
      },
    ],
  },

  // ── SET 6: Ocean City, MD — Saturday · Hot 84°F · Packed · $$$$ · Couple ─────
  {
    weather: { emoji: '☀️', condition: 'Hot & Sunny', temp_f: '84', wind_speed_mph: '6' },
    meta: {
      day_of_week: 'Saturday', date: 'July 12, 2025',
      time_window: '9:00 AM – 9:00 PM',
      preferences: { pace: 'packed', budget: '$$$$', group_type: 'couple' },
      city: 'Ocean City, MD',
    },
    isFallback: false,
    itinerary: [
      {
        time: '9:00 AM', duration_mins: 90, category: 'outdoor',
        name: 'Assateague Island North Beach', place_id: 'demo_assateague_sunrise',
        address: '7206 National Seashore Ln, Berlin, MD 21811',
        lat: 38.2354, lng: -75.1605, rating: 4.9, distance: '9.2 mi',
        reason: "A packed couple's day starts at Assateague while the sand is still cool and the ponies are out — by 10:30am the Atlantic is warm enough to swim and you'll have the best beach to yourselves before the crowds arrive. The ocean at this latitude runs genuinely warm in July.",
        excitement_score: 94,
        highlights: [
          { type: 'feature', text: 'North beach deepest in the park — fewest visitors at 9am' },
          { type: 'feature', text: 'Warm Atlantic swimming by mid-morning in summer' },
          { type: 'buzz',    text: "Consistently rated Maryland's #1 beach experience" },
        ],
      },
      {
        time: '11:00 AM', duration_mins: 75, category: 'food',
        name: 'Crabcake Factory Bayside', place_id: 'demo_crabcake_factory',
        address: '12817 Harbor Rd, Ocean City, MD 21842',
        lat: 38.3926, lng: -75.0878, rating: 4.5, distance: '7.4 mi',
        phone: '+14102136600', website: 'https://crabcakefactoryusa.com',
        reason: "The Crabcake Factory's bayside location gives you direct water views from nearly every table, and the crab cakes are the real thing — jumbo lump, barely any filler. For a couple doing a proper upscale OC day, this brunch sets the tone.",
        excitement_score: 88,
        highlights: [
          { type: 'feature', text: 'Bayside tables with direct water view' },
          { type: 'special', text: 'Jumbo lump crab cake — no filler, award-winning recipe' },
          { type: 'buzz',    text: 'Maryland Seafood Festival "Best Crab Cake" multiple years' },
        ],
      },
      {
        time: '1:00 PM', duration_mins: 150, category: 'activity',
        name: 'Jolly Roger Splash Mountain Water Park', place_id: 'demo_splash_mountain',
        address: '2901 Philadelphia Ave, Ocean City, MD 21842',
        lat: 38.3520, lng: -75.0760, rating: 4.2, distance: '4.4 mi',
        reason: "Splash Mountain is the best way to spend an 84°F afternoon in OC — the lazy river alone is worth admission and the slides range from family floats to steep drops that get involuntary screaming from both of you. The private cabana upgrade is worth it for couples who want a home base.",
        excitement_score: 87,
        highlights: [
          { type: 'special',       text: 'Private cabana rental — reserved chairs, priority service' },
          { type: 'entertainment', text: 'Lazy river, wave pool, and 15+ slides' },
          { type: 'feature',       text: 'Height-unlimited access — no separate charges per ride' },
        ],
      },
      {
        time: '4:00 PM', duration_mins: 75, category: 'outdoor',
        name: 'Ocean City Sunset Sail', place_id: 'demo_oc_sunset_sail',
        address: 'Talbot Street Pier, Ocean City, MD 21842',
        lat: 38.3365, lng: -75.0849, rating: 4.7, distance: '2.2 mi',
        reason: "An OC sunset sail for two from Talbot Street Pier is a genuine romantic moment — the Maryland coast from the water looks completely different than from the beach, and the late afternoon light on the bay is a two-hour photo opportunity. Bring the champagne you planned to order at dinner.",
        excitement_score: 92,
        highlights: [
          { type: 'entertainment', text: 'Two-hour shared or private sail — booking required' },
          { type: 'feature',       text: 'Chesapeake Bay and Atlantic views on a single tack' },
          { type: 'special',       text: 'BYO wine/champagne permitted — no corkage fee' },
        ],
      },
      {
        time: '6:00 PM', duration_mins: 60, category: 'food',
        name: "Fager's Island Sunset Bar", place_id: 'demo_fagers_bar',
        address: '60th St, Ocean City, MD 21842',
        lat: 38.3789, lng: -75.0666, rating: 4.7, distance: '3.8 mi',
        phone: '+14102898400', website: 'https://fagers.com',
        reason: "Arriving at Fager's for just drinks and appetizers means you get the sunset deck without the full dinner commitment — the raw bar happy hour ends at 7pm and Chesapeake oysters with champagne at this price point is genuinely elevated. The deck faces pure west and the July sunset here is legitimately famous.",
        excitement_score: 91,
        highlights: [
          { type: 'special',       text: 'Raw bar happy hour until 7pm — half-price oysters' },
          { type: 'feature',       text: 'West-facing bay deck — best sunset seat in OC' },
          { type: 'entertainment', text: 'Live jazz on the deck Friday and Saturday evenings' },
        ],
      },
      {
        time: '7:30 PM', duration_mins: 90, category: 'food',
        name: 'Crab Alley Restaurant', place_id: 'demo_crab_alley',
        address: '9703 Golf Course Rd, Ocean City, MD 21842',
        lat: 38.3912, lng: -75.0867, rating: 4.4, distance: '4.8 mi',
        phone: '+14102134577', website: 'https://craballey.com',
        reason: "Crab Alley is where OC locals go for serious seafood without the boardwalk tourist markup — the all-you-can-eat blue crab nights are a genuine Maryland tradition requiring newspaper tablecloths, wooden mallets, and no sense of dignity about making a mess.",
        excitement_score: 89,
        highlights: [
          { type: 'entertainment', text: 'All-you-can-eat steamed blue crab nights — the full experience' },
          { type: 'feature',       text: 'Newspaper tablecloths and wooden mallets — no pretense' },
          { type: 'buzz',          text: "Voted OC's #1 local seafood restaurant 8 years running" },
          { type: 'special',       text: 'BYOB — no corkage fee' },
        ],
      },
    ],
  },

  // ── SET 7: Salisbury, MD — Sunday · Overcast 64°F · Moderate · $$ · Friends ──
  {
    weather: { emoji: '⛅', condition: 'Overcast', temp_f: '64', wind_speed_mph: '9' },
    meta: {
      day_of_week: 'Sunday', date: 'June 22, 2025',
      time_window: '11:00 AM – 8:30 PM',
      preferences: { pace: 'moderate', budget: '$$', group_type: 'friends' },
      city: 'Salisbury, MD',
    },
    isFallback: false,
    itinerary: [
      {
        time: '11:00 AM', duration_mins: 90, category: 'outdoor',
        name: 'Salisbury City Park & Zoo', place_id: 'demo_salisbury_zoo',
        address: '755 S Park Dr, Salisbury, MD 21801',
        lat: 38.3407, lng: -75.5832, rating: 4.6, distance: '1.8 mi',
        reason: "Salisbury Zoo is completely free and completely underrated — for a mid-sized city zoo it has excellent animal diversity including American black bears, red wolves, and a substantial aviary. Overcast skies mean the animals are more active than on hot sunny days.",
        excitement_score: 83,
        highlights: [
          { type: 'special',       text: 'Completely free admission — one of the last free zoos on the East Coast' },
          { type: 'feature',       text: 'American black bears, red wolves, and jaguars on exhibit' },
          { type: 'buzz',          text: "Maryland's Most Underrated Day Trip — Baltimore Magazine" },
          { type: 'entertainment', text: 'Keeper talks at 11am and 2pm daily' },
        ],
      },
      {
        time: '1:00 PM', duration_mins: 60, category: 'food',
        name: "Roadie Joe's", place_id: 'demo_roadie_joes',
        address: '404 W Main St, Salisbury, MD 21801',
        lat: 38.3665, lng: -75.5985, rating: 4.3, distance: '1.6 mi',
        reason: "Roadie Joe's is the kind of bar and grill every college town should have — not fancy, extremely good burgers, cold beer, and a staff that actually seems to enjoy working there. Sunday lunch here has been a Salisbury ritual for years and the nachos are the best bet for a group.",
        excitement_score: 79,
        highlights: [
          { type: 'special',       text: 'Sunday lunch specials — $8 burger and draft combo' },
          { type: 'feature',       text: 'Best nachos in Salisbury — reliably excellent' },
          { type: 'entertainment', text: 'NFL Sunday Ticket on multiple screens' },
        ],
      },
      {
        time: '2:30 PM', duration_mins: 75, category: 'activity',
        name: 'Ward Museum of Wildfowl Art', place_id: 'demo_ward_museum',
        address: '909 S Schumaker Dr, Salisbury, MD 21804',
        lat: 38.3466, lng: -75.5848, rating: 4.7, distance: '0.7 mi',
        reason: "The Ward Museum is one of the most uniquely American art museums in existence — dedicated entirely to carved wildfowl decoys elevated to fine art. The competition pieces are jaw-dropping and the Chesapeake Bay hunting culture exhibition is unexpectedly compelling.",
        excitement_score: 81,
        highlights: [
          { type: 'feature',       text: 'World-class collection of carved and painted decoy art' },
          { type: 'buzz',          text: "Smithsonian affiliate — the only museum of its kind in the world" },
          { type: 'special',       text: '$7 admission — excellent value for the quality' },
          { type: 'entertainment', text: 'Annual World Championship Carving Competition held here' },
        ],
      },
      {
        time: '4:00 PM', duration_mins: 60, category: 'outdoor',
        name: 'Pemberton Historical Park', place_id: 'demo_pemberton',
        address: 'Pemberton Dr, Salisbury, MD 21801',
        lat: 38.3516, lng: -75.6171, rating: 4.5, distance: '1.4 mi',
        reason: "Pemberton is a 262-acre park built around one of Maryland's oldest surviving brick structures — a 1741 plantation house with its original interior intact. The walking trails along the Wicomico River are a good way to stretch out after an afternoon indoors.",
        excitement_score: 77,
        highlights: [
          { type: 'feature', text: '1741 brick plantation house — original interior preserved' },
          { type: 'feature', text: 'Riverside trails with Wicomico River views' },
          { type: 'buzz',    text: 'On the National Register of Historic Places' },
        ],
      },
      {
        time: '5:30 PM', duration_mins: 60, category: 'food',
        name: 'ShoreCraft Beer Company', place_id: 'demo_shorecraft',
        address: '605 S Salisbury Blvd, Salisbury, MD 21801',
        lat: 38.3502, lng: -75.5885, rating: 4.6, distance: '0.9 mi',
        phone: '+14436442777', website: 'https://shorecraftbeer.com',
        reason: "ShoreCraft is Salisbury's best brewery and has become the Sunday evening destination for locals — the lager rotation is strong, the pretzel bites are addictive, and the taproom has the right energy for a group that wants to keep the day going without fully committing to dinner.",
        excitement_score: 84,
        highlights: [
          { type: 'entertainment', text: 'Live music Sunday evenings in the covered beer garden' },
          { type: 'feature',       text: 'On-site brewing — seasonal rotation changes monthly' },
          { type: 'special',       text: 'Tasting flight: 6 beers for $10' },
        ],
      },
      {
        time: '7:00 PM', duration_mins: 90, category: 'food',
        name: 'Brew River Restaurant & Bar', place_id: 'demo_brew_river',
        address: '502 W Main St, Salisbury, MD 21801',
        lat: 38.3665, lng: -75.6022, rating: 4.4, distance: '0.6 mi',
        phone: '+14107498837', website: 'https://brewriver.com',
        reason: "Brew River sits right on the Wicomico River with an outdoor deck that's especially good on overcast evenings — less glare, cooler air, and the river takes on a silver quality that's genuinely atmospheric. The menu is upscale American with strong crab and oyster options.",
        excitement_score: 85,
        highlights: [
          { type: 'feature',       text: 'Outdoor deck directly on the Wicomico River' },
          { type: 'entertainment', text: 'Live music Friday and Saturday evenings' },
          { type: 'special',       text: 'Happy hour until 6pm — $5 house cocktails' },
          { type: 'buzz',          text: "Salisbury's top-rated restaurant — Yelp and TripAdvisor" },
        ],
      },
    ],
  },

]; // end DEMO_ITINERARIES

// ─── Spin pool ────────────────────────────────────────────────────────────────

const DEMO_SPIN_POOL = {
  food: [
    { name: 'Blacksmith Restaurant',          address: '111 N Main St, Berlin, MD 21811',            reason: 'Farm-to-table in a converted Berlin blacksmith shop — the crab cake eggs benedict is legendary on weekends.',                           excitement_score: 87 },
    { name: 'The Globe Theatre & Restaurant', address: '12 Broad St, Berlin, MD 21811',              reason: 'Restored 1908 vaudeville theatre with live acoustic music Saturday afternoons and the best $14 crab cake sandwich on the Eastern Shore.', excitement_score: 91 },
    { name: "Fager's Island Restaurant",      address: '60th St, Ocean City, MD 21842',              reason: 'OC institution since 1975 with a bay deck that faces due west — the June sunset from here is legitimately famous.',                     excitement_score: 94 },
    { name: "Dumser's Dairyland",             address: '49th St & Coastal Hwy, Ocean City, MD',      reason: "OC institution since 1939 serving enormous hand-dipped ice cream and cheap diner food — lunch + dessert under $10.",                     excitement_score: 81 },
    { name: "Carrol's Creek Café",            address: '410 Severn Ave, Annapolis, MD 21403',        reason: 'Waterfront brunch with a full City Dock panorama and the benchmark Maryland cream of crab soup.',                                      excitement_score: 89 },
    { name: 'Brew River Restaurant',          address: '502 W Main St, Salisbury, MD 21801',         reason: 'Outdoor deck directly on the Wicomico River — upscale American with strong crab and oyster options.',                                  excitement_score: 85 },
    { name: 'Ropewalk Restaurant',            address: '201 S Atlantic Ave, Ocean City, MD',         reason: 'Open-air rooftop deck with the best Atlantic view in OC and the strongest craft beer list on the island.',                              excitement_score: 87 },
  ],
  activity: [
    { name: 'Downtown Berlin Historic District',      address: 'Main St, Berlin, MD 21811',              reason: "Voted Coolest Small Town in America — Victorian storefronts, zero chain stores, and the filming location for Runaway Bride.",     excitement_score: 88 },
    { name: 'U.S. Naval Academy Grounds Tour',        address: '121 Blake Rd, Annapolis, MD 21402',      reason: 'Free walking tour of the most architecturally dramatic campus on the East Coast — midshipmen sailing the Severn in the background.', excitement_score: 91 },
    { name: "Ripley's Believe It or Not! Ocean City", address: '401 S Atlantic Ave, Ocean City, MD',     reason: 'Laser maze, mirror maze, and moving theater — relentlessly entertaining for all ages and perfect for a rainy hour.',               excitement_score: 83 },
    { name: 'Ward Museum of Wildfowl Art',            address: '909 S Schumaker Dr, Salisbury, MD',      reason: 'The only museum of its kind in the world — carved decoy art elevated to jaw-dropping fine art craftsmanship.',                     excitement_score: 81 },
    { name: 'Ocean City Life-Saving Station Museum',  address: '813 S Atlantic Ave, Ocean City, MD',     reason: 'Actual 1891 rescue station on the beach — free Sundays and genuinely fascinating history of the surfmen who saved shipwrecked sailors.', excitement_score: 79 },
    { name: 'Jolly Roger Amusement Park Arcade',      address: '30th St & Coastal Hwy, Ocean City, MD',  reason: 'Indoor bowling, laser tag, and 300+ arcade games in one complex — the intended-for-rainy-days OC experience.',                    excitement_score: 86 },
  ],
  outdoor: [
    { name: 'Assateague Island National Seashore', address: '7206 National Seashore Ln, Berlin, MD', reason: 'Wild ponies on pristine Atlantic beaches — one of the genuinely rare experiences within 2 hours of DC or Baltimore.',  excitement_score: 96 },
    { name: 'Turville Creek Water Trail',          address: 'Public Landing Rd, Berlin, MD',         reason: 'Kayak through coastal wetlands with walk-up rentals, no reservation needed — osprey and herons nearly guaranteed.',    excitement_score: 84 },
    { name: 'Ocean City Boardwalk',                address: 'Boardwalk, Ocean City, MD 21842',       reason: 'Three miles of iconic American boardwalk on the Atlantic — best experienced at sunrise or after 8pm.',               excitement_score: 82 },
    { name: 'Pocomoke State Forest Nassawango Trail', address: '3036 Nassawango Rd, Pocomoke City, MD', reason: 'Ancient bald cypress swamp trail — one of the most biodiverse and otherworldly environments in the mid-Atlantic.', excitement_score: 88 },
    { name: 'Pemberton Historical Park',           address: 'Pemberton Dr, Salisbury, MD',           reason: 'Riverside trails around a 1741 plantation house on the Wicomico River — peaceful and completely under-visited.',      excitement_score: 77 },
    { name: 'Annapolis City Dock Waterfront',      address: 'City Dock, Annapolis, MD 21401',        reason: 'The best free afternoon in Annapolis — watch yacht parade in Ego Alley and enjoy the sailing capital atmosphere.',    excitement_score: 83 },
  ],
  shopping: [
    { name: 'Burley Oak Brewing Company',         address: '10016 Old Ocean City Blvd, Berlin, MD', reason: "Maryland's most decorated craft brewery — taproom flights, live music Saturday evenings, dogs welcome.",              excitement_score: 89 },
    { name: 'Berlin Main Street Boutiques',       address: 'Main St, Berlin, MD 21811',             reason: 'Independent bookshops, antique dealers, and art galleries in a perfectly preserved Victorian streetscape.',           excitement_score: 82 },
    { name: 'Maryland Avenue Galleries, Annapolis', address: 'Maryland Ave, Annapolis, MD',          reason: 'Gallery row in 18th-century brick buildings — densest concentration of independent art dealers in Maryland.',        excitement_score: 83 },
    { name: 'Ocean City Boardwalk Shops',         address: 'Boardwalk, Ocean City, MD',             reason: 'Three miles of classic boardwalk retail — salt water taffy, fudge, and OC souvenirs done the old-fashioned way.',    excitement_score: 78 },
    { name: 'ShoreCraft Beer Company',            address: '605 S Salisbury Blvd, Salisbury, MD',   reason: "Salisbury's best taproom with an on-site bottle shop and a covered beer garden that fills up on Sunday evenings.",   excitement_score: 84 },
  ],
  other: [
    { name: 'Annapolis Harbor Sunset Sail',       address: 'City Dock, Annapolis, MD 21401',         reason: 'Two-hour schooner sail at dusk from City Dock — Chesapeake Bay turns gold, BYO drinks, and TripAdvisor top-rated experience in Maryland.', excitement_score: 95 },
    { name: 'Ocean City Boardwalk Night Walk',    address: 'Boardwalk, Ocean City, MD 21842',        reason: 'Three miles of lit-up boardwalk after 9pm is completely different energy from daytime — Funnel cake, amusements, and ocean air.', excitement_score: 86 },
    { name: 'Ego Alley Yacht Parade, Annapolis',  address: 'City Dock, Annapolis, MD 21401',         reason: "Watching million-dollar yachts attempt U-turns to audience applause in a narrow inlet is free, absurd, and genuinely great.",       excitement_score: 85 },
    { name: "Trimper's Rides 1902 Carousel",      address: 'S Division St, Ocean City, MD 21842',    reason: 'A National Historic Landmark carousel with hand-carved horses operating continuously since 1893 — only $2 a ride.',               excitement_score: 76 },
    { name: 'Assateague Island Sunset Drive',     address: '7206 National Seashore Ln, Berlin, MD',  reason: 'Drive to the barrier island at golden hour for ponies silhouetted against the Atlantic — no hiking required, drive-by magic.',      excitement_score: 86 },
    { name: 'Jolly Roger Splash Mountain',        address: '2901 Philadelphia Ave, Ocean City, MD',  reason: 'Full water park on the hottest days — lazy river, wave pool, and slides worth the $30 admission when it hits 85°F.',               excitement_score: 87 },
  ],
};

// ─── State for avoiding immediate repeats ────────────────────────────────────
let _lastItineraryIndex = -1;
const _lastSpinIndex = {};

// ─── Exported helpers ─────────────────────────────────────────────────────────

export function getDemoItinerary({ startTime, endTime, preferences } = {}) {
  let idx;
  do {
    idx = Math.floor(Math.random() * DEMO_ITINERARIES.length);
  } while (idx === _lastItineraryIndex && DEMO_ITINERARIES.length > 1);
  _lastItineraryIndex = idx;

  const set = DEMO_ITINERARIES[idx];
  const now = new Date();
  return {
    ...set,
    meta: {
      ...set.meta,
      date:        now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
      time_window: startTime && endTime ? `${startTime} – ${endTime}` : set.meta.time_window,
      ...(preferences ? { preferences } : {}),
    },
  };
}

export function getDemoSpinResult(category) {
  const pool = DEMO_SPIN_POOL[category] ?? DEMO_SPIN_POOL.other;
  let idx;
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (idx === _lastSpinIndex[category] && pool.length > 1);
  _lastSpinIndex[category] = idx;
  return pool[idx];
}

// ─── History demo data ────────────────────────────────────────────────────────

export const DEMO_HISTORY = {
  decisions: [
    { id: 'demo_1', name: "Fager's Island Restaurant", category: 'food', reason: 'Legendary bayfront sunset dining with live music', rating: 4.7, distance: '12.3 mi', excitement_score: 94, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),   feedback: 'up' },
    { id: 'demo_2', name: 'Assateague Island National Seashore', category: 'outdoor', reason: 'Wild horses and pristine Atlantic beaches', rating: 4.9, distance: '8.1 mi', excitement_score: 96, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), feedback: 'up' },
    { id: 'demo_3', name: 'Ocean City Boardwalk', category: 'activity', reason: 'Classic boardwalk energy on a sunny afternoon', rating: 4.5, distance: '14.2 mi', excitement_score: 88, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), feedback: 'down', feedbackReason: 'Too crowded' },
    { id: 'demo_4', name: 'Burley Oak Brewing Company', category: 'activity', reason: 'Award-winning craft brewery with live music patio', rating: 4.8, distance: '1.2 mi', excitement_score: 89, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 74).toISOString(), feedback: 'up' },
    { id: 'demo_5', name: 'The Globe Theatre & Restaurant', category: 'food', reason: 'Farm-to-table lunch in a restored 1908 theatre', rating: 4.7, distance: '0.3 mi', excitement_score: 91, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 98).toISOString(), feedback: 'up' },
    { id: 'demo_6', name: 'Downtown Berlin Historic District', category: 'activity', reason: 'Victorian architecture, indie shops, and local art', rating: 4.6, distance: '0.1 mi', excitement_score: 88, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 122).toISOString(), feedback: null },
  ],
  itineraries: [
    { id: 'demo_itin_1', date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), displayDate: 'Yesterday', location: 'Berlin, MD', preferences: { pace: 'moderate', budget: '$$', group: 'couple' }, weather: { icon: '☀️', temp: '74°F' }, stopCount: 6, timeWindow: '11:00 AM – 8:00 PM', stops: ["Assateague Island", "The Globe Theatre", "Downtown Berlin", "Turville Creek", "Burley Oak Brewing", "Fager's Island"], feedback: 'up' },
    { id: 'demo_itin_2', date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), displayDate: 'Thursday', location: 'Ocean City, MD', preferences: { pace: 'packed', budget: '$$$', group: 'friends' }, weather: { icon: '🌤', temp: '69°F' }, stopCount: 5, timeWindow: '10:00 AM – 9:00 PM', stops: ["Ocean City Boardwalk", "Fractured Prune", "Jolly Roger Amusement Park", "Hooper's Crab House", "Seacrets"], feedback: 'up' },
    { id: 'demo_itin_3', date: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(), displayDate: 'Monday', location: 'Berlin, MD', preferences: { pace: 'relaxed', budget: '$', group: 'solo' }, weather: { icon: '☁️', temp: '62°F' }, stopCount: 4, timeWindow: '12:00 PM – 7:00 PM', stops: ["Blacksmith Restaurant", "Berlin Farmers Market", "Pocomoke State Forest", "Burley Oak Brewing"], feedback: 'down', feedbackReason: 'Trail was closed' },
  ],
};
