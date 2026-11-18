# Solmar City

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/toirant/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/toirant/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for the make.fun **gta6-01** bounty ("Make GTA 6").
Play as Mara Voss in Solmar City — a sun-soaked coastal city of her own, with traffic,
pedestrians, cars to steal, police who chase, three story missions, combat, a HUD with a
live minimap, saves, and synthesised sound and music. Nothing here comes from any
commercial game: the city, characters, vehicles, names, story, art and music are all
invented for this entry.

## Play

Serve `game/` with any static file server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

No network is needed at runtime — every script, style and asset is a file under `game/`.

## Controls

- **WASD** — move / drive · **mouse** — camera
- **E** — enter / exit a car (parked cars are free; traffic cars are a crime)
- **F** — punch · **mouse click** — fire the pistol
- **Shift** — run · **M** — start the next mission · **Esc** — pause

## The story

Mara Voss came to Solmar with $250, a borrowed pistol and a name to make. Three jobs
stand between her and the city: the Harbor Handoff at the marina, a Courier Chase
across town, and a Dragnet Escape from the Solmar PD. Wanted stars rise when she
steals, fights or shoots, and fall when she lays low.

## Structure

- `game/index.html` — the page, HUD and menus
- `game/src/world.js` — the city: streets, towers, palms, marina, beach
- `game/src/player.js` — Mara on foot: movement, camera, car entry
- `game/src/vehicles.js` — car factory and driving physics
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted stars, patrol cars, officers
- `game/src/missions.js` — the three story jobs
- `game/src/combat.js` — punching and pistol combat
- `game/src/hud.js` — HUD, minimap, menus
- `game/src/audio.js` — synthesised effects and music loop
- `game/src/save.js` — localStorage save / continue
- `game/src/shots.js` — deterministic staging for the screenshots
- `game/vendor/three.min.js` — vendored three.js r160
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`

## License

MIT — see `LICENSE`.
