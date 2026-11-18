# Solmar City — an open-world crime game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/toirant/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/toirant/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar City** is an original open-world crime game built for make.fun's
["Make GTA 6"](https://make.fun/bounty/gta6-01) bounty. Mara Voss, a courier
for hire, takes three jobs across one long afternoon in the sun-soaked coastal
city of Solmar — and the whole Solmar PD comes along for the ride.

Everything is original: the city, the characters, the vehicles, the story, the
art and the music. Nothing is borrowed from any commercial game.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network
requests at runtime — the game is static files under `game/`, with three.js
vendored as `game/vendor/three.min.js`.

## The game

- **A city to explore** — six-by-six blocks of streets, towers, palms and a
  marina, on foot (WASD + mouse camera, third person) and by car.
- **Traffic and pedestrians** — cars cruise the roads, pedestrians stroll the
  sidewalks and flee when things get loud.
- **Cars to steal and drive** — walk up to a parked car (or a stopped one) and
  press E. Driving is arcade physics: acceleration, braking, steering, skids
  and crashes.
- **A wanted level** — stealing, hitting pedestrians and shooting raise your
  stars. Police cruisers and officers chase you, ram you and try to bust you.
  Lay low and the heat fades.
- **Missions and a story** — three jobs with on-screen markers, a gold beacon
  and a minimap blip: pick up a package at the marina, chase down a courier
  cab, then lose a full police dragnet. Each pays cash; progress saves.
- **Combat** — fists (F) and a pistol (click to shoot) with ammo you can buy.
- **HUD** — health, cash, wanted stars, mission objective, clock, speed, ammo
  and a live minimap showing you, traffic, police and the mission marker.
- **Menus and saving** — title screen with New Game / Continue, pause menu,
  wasted/busted screens, and automatic saving to localStorage.
- **Polish** — sun-soaked lighting, skid dust, hit particles, screen shake,
  synthesised WebAudio sound effects and a looping synth soundtrack. No
  external assets.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Orbit camera |
| E | Enter / steal / exit car, pick up |
| Click | Shoot pistol |
| F | Punch |
| R | Buy ammo ($5 a bullet) |
| Shift | Sprint |
| Space | Handbrake |
| Esc / P | Pause |

## Structure

The game's own source lives in `game/src/`, one file per job: `world.js` builds
the city, `traffic.js` runs the cars and pedestrians, `player.js` is Mara on
foot, `vehicles.js` is car physics, `police.js` is the wanted system,
`missions.js` is the three jobs, `combat.js` is fists and the pistol, `hud.js`
draws the HUD and minimap, `audio.js` synthesises every sound, `input.js`
reads the keyboard and mouse, `save.js` keeps the campaign, `shots.js` stages
the screenshots, and `main.js` ties it all together.

`main.ts` at the repository root hands the game in: it copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
kit's `buildDossier`.

## License

MIT — see [LICENSE](LICENSE).
