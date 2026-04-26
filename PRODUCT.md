# Frame Shifter — Product

## What it is

A visual multi-city flight itinerary planner. Browse cheap flights on a map, click markers to chain a route, book the whole trip.

## Value proposition

No existing tool combines map-with-prices + click-to-chain route building + booking in one flow. Closest competitors each have one or two pieces:

| Tool | Map with prices | Multi-city chaining | Booking |
|------|:-:|:-:|:-:|
| **Frame Shifter** | Yes | Yes (click markers) | Yes (deep links) |
| Kiwi Nomad | No (form-based) | Yes (form-based) | Yes |
| Airwander | No | Partial (stopovers) | Yes |
| Google Flights Explore | Yes | No (single leg) | Yes |
| KAYAK Explore | Yes | No (single leg) | Yes |
| Escape (greatescape.co) | Yes | No (single leg) | No |
| FlyHop | No | Yes (generated routes) | Yes |

## Roadmap

Product phases and checkboxes live below. **Technical structure targets** (thin pages, map decomposition, SSR boundaries, shared types, trustworthiness-first) live in [`.cursor/rules/architecture-roadmap.mdc`](.cursor/rules/architecture-roadmap.mdc). Agents and contributors should align implementation with that roadmap or explicitly note why not.

### Phase 1: Trustworthy — "I'd show this to a friend"
- [ ] Real-time or near-real-time prices (solve caching strategy)
- [ ] Price freshness indicator / "prices may have changed" disclaimer
- [x] Return leg — close the loop back to origin
- [ ] Configurable stay duration per city (replace hardcoded +3 days)
- [ ] Error resilience — clear UX when Tequila is down, rate-limited, or returns empty

### Phase 2: Usable — "A stranger can figure it out"
- [ ] Onboarding — coach marks or ghost animation for first-time users
- [ ] Marker clustering / zoom handling
- [ ] Itinerary sidebar or summary strip (route as list with dates + per-leg prices)
- [ ] Mobile polish — fat-finger tolerance, scroll-vs-pan, marker tap targets
- [ ] Share / export itinerary (link or calendar)

### Phase 3: Complete — "Why would I use Kiwi instead"
- [ ] Flexible date search per leg ("cheapest this week")
- [ ] Filters — direct flights, max price, airline preferences
- [ ] Running total trip cost visible as legs accumulate
- [ ] Booking comparison — multiple providers, not just Kiwi deep links
- [ ] User accounts — saved itineraries, price alerts

### Phase 4: Defensible — "Why can't Google just copy this"
- [ ] Community-curated routes
- [ ] Editorial content ("best 2-week Europe loops under 500 EUR")
- [ ] SEO on long-tail multi-city queries
- [ ] White-label widget for other travel sites

## Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-09 | Phase 1 first, no UX polish until data layer is solid | Stale prices kill trust on first use — nothing else matters if "Book Now" shows a different price |
| 2026-02-09 | Keep week-long cache for development only | Protects Tequila rate limits during dev; production caching strategy TBD |
| 2026-02-09 | Deep link to Kiwi for booking (affiliate) | Simplest path to bookable results; own booking layer is out of scope for now |
| 2026-02-12 | Finishing route stays on map, doesn't auto-navigate to bookings | Users need to see their completed route (icons, path) before leaving; prevents disorientation when navigating back |
| 2026-04-26 | Architecture roadmap in `.cursor/rules/architecture-roadmap.mdc` | Keeps Nuxt/Vue structure and review checklist in always-applied rules so future work aligns or surfaces gaps |
