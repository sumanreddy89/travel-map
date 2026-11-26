# Launch notes: hosted-render fake door

Drafts for the launch posts, in the order they go out: **the Reel first, then r/selfhosted and r/SideProject, then directories, and Show HN last.** The 3-week test (`docs/hosted-test.md`) starts with the first post. Fill in the date and link when each goes out, and copy them into the results table there.

**The gate, the same everywhere:** pass if 10 or more people ask for a film, by joining the waitlist or clicking "I'd pay for this" (either button counts; a person counts once).

The hook is the year film: **paste your cities, get your year film.** Each post leads with what people can make today, free and open source, and asks about the hosted version as a question, never as a product that exists.

---

## 1. Reel (Instagram, and TikTok if you like)

- **Date posted:**
- **Link:**

Use the 16-second vertical clip: `demo-year-reels.mp4` from the [v5 release](https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-year-reels.mp4). It's silent, so add a sound from the app's library.

**Caption:** My year in travel, from a list of seven cities. Made with an open-source tool; a no-setup version might be next. Link in bio if you'd make yours.

Put https://sumanreddy89.github.io/travel-map/hosted/ in the bio for the 3 weeks.

---

## 2a. Reddit, r/selfhosted

- **Date posted:**
- **Link:**

Read the sidebar rules on the day: r/selfhosted asks that posts be about software you run yourself, so lead with that and don't make the hosted version the point.

**Title:** TravelMap: turn a text file of the cities you visited into an animated year-in-travel film, rendered locally with no API keys

**Body:**

> One city per line (`Madrid | 2026-03-20 | train`), `npm run year -- my-year.txt`, and it renders an MP4 on your machine: stats counting up, the year flown city by city, a share card at the end.
>
> - No API keys and no accounts. A small map and a list of about 1,250 cities are bundled (Natural Earth, public domain), so nothing is looked up online.
> - The render runs with the network blocked; the only calls are installing packages, a one-time headless-browser download, and OSRM road routes for car and train legs.
> - Fresh clone to first film is about two minutes on a laptop.
>
> Code (MIT): https://github.com/sumanreddy89/travel-map
>
> I'm also asking whether a hosted version would be worth it for people who'd rather not run Node: https://sumanreddy89.github.io/travel-map/hosted/

---

## 2b. Reddit, r/SideProject

- **Date posted:**
- **Link:**

Check the subreddit's self-promotion rules on the day. r/travel and most travel subreddits don't allow self-promotion, so don't post this there.

**Title:** I made a tool that turns a list of the cities you visited into an animated "year in travel" film

**Body:**

> Write your cities one per line (with dates, and plane/train/car if you like) and it renders a film: your countries, cities, kilometres and flights counting up, then the whole year flown on a map, ending on a share card. Free, open source, no API keys.
>
> Attach the 16-second clip (https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-year-reels.mp4).
>
> Code (MIT): https://github.com/sumanreddy89/travel-map
>
> Running it yourself needs Node and a terminal, so I'm testing whether a hosted version is worth building: paste your cities, get the MP4. Not live, nothing is charged; there's a waitlist if you'd use it: https://sumanreddy89.github.io/travel-map/hosted/
>
> Which cities would be on yours?

---

---

## 3. Directories

- **Dates and links:**

Submit the repo to a few open-source and side-project directories, one line each. Check each directory's rules first; skip any that want a paid listing.

**One line:** Paste the cities you visited, get an animated film of your year. Open source, runs locally, no API keys.

**Tags:** travel, maps, video, open source, Remotion, year in review

**Link:** https://github.com/sumanreddy89/travel-map (the waitlist page only where a directory asks for a website)

---

## 4. Show HN (last)

- **Date posted:**
- **Link:**

**Title:** Show HN: TravelMap – paste the cities you visited, get an animated film of your year

**URL:** https://github.com/sumanreddy89/travel-map

**First comment:**

> End of the year is when people post their travel recaps, so I built the version I wanted: you write the cities you went to, one per line ("Madrid | 2026-03-20 | train"), and TravelMap renders a film. It counts up your countries, cities, kilometres and flights, flies the route city by city with a plane, train or car on each leg, and ends on a card you can share. Portrait for phones, landscape for everything else.
>
> It's Remotion, Natural Earth terrain and OpenStreetMap routes, with no API keys: cities come from a bundled public-domain list, so nothing is looked up online, and the sample year renders with the network blocked. `npm run year -- my-year.txt` makes your own; a small map is bundled, so there's nothing else to download.
>
> Sample (48 s): https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-year-portrait.mp4
>
> It also does single trips with your own photos at each stop. Running it still means installing Node and using a terminal, so I'm testing whether a hosted version is worth building (paste your cities, get the MP4 by email; 3 free, then about €3 a film). It doesn't exist yet; there's a waitlist if you'd use it: https://sumanreddy89.github.io/travel-map/hosted/
>
> Code is MIT. Happy to answer anything about the rendering.
