# Mythlings

A complete, playable 2D monster-collecting RPG built with vanilla HTML, CSS and JavaScript.
Explore the Willowbrook valley, befriend 26 original creatures, and face three bosses on the
way to the Hollow Star. No frameworks, no build step, no third-party runtime dependencies.

## Play

```bash
npm start        # serves the game at http://localhost:3000
```

Any static file server works; the game uses ES modules, so open it through a server rather
than `file://`. Progress is saved automatically to `localStorage` (one journey slot) when you
rest at a clinic, win a boss battle, catch a Mythling, move between maps, or choose Save.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk |
| Space / Enter | Talk, read, interact, advance dialogue |
| M / X | Open the journey menu |
| B | Open the bag |
| 1–4 | Pick a battle command / move |
| Esc | Close menus |
| On-screen D-pad + A/B | Touch controls on phones |

## What's in the valley

- **26 original Mythlings** across eight three-stage evolution lines, with five elements
  (Fire, Water, Grass, Electric, Shadow), a full type chart, stats, learnsets, PP and status
  effects (burn, poison, paralysis, sleep).
- **A connected overworld**: Willowbrook Town, Linden Lab, clinic, market, your home,
  Fernwood Trail, Fernwood Forest, Route 2, Emberhold, the Ember Bazaar, Gloomhollow Cave
  and the Shadow Sanctum.
- **Turn-based battles** with speed order, STAB, critical hits, type effectiveness, stat
  stages, capture orbs, item use, switching, EXP, levelling, evolution, fleeing and trainer
  teams.
- **Three bosses**: Ranger Bramble, Pyromancer Cinder and Shadow Adept Umbra. Six additional
  trainers wander the routes.
- **Five quests** including the main Field Notes thread, Willow's Glowberries, the ranger's
  test, Cinder's challenge and the Hollow Star finale.
- **Full RPG layer**: party of six, storage box, collection Index, bag, shops, healing spots,
  money, save/continue, quest log, boss defeats, defeat/blackout and a post-game rift.
- **Hand-drawn pixel art generated in code**: creature sprites are built from archetypes,
  palettes and features, then outlined pixel by pixel. Terrain, buildings, NPCs, weather and
  battle effects are all drawn at a native 288×192 resolution and scaled crisply.
- **Responsive retro UI** with a canvas stage, HTML dialogue/menus, touch controls, and
  reduced-motion support.

## The bestiary

| Line | Creatures | Element |
| --- | --- | --- |
| Ember fox | Cindit → Pyrolynx → Solmara | Fire |
| Cinder drake | Ashlit → Cindrake → Volkaryx | Fire |
| River fish | Dewfin → Riptail → Tidalisk | Water |
| Marsh blob | Puddip → Marshfin → Bogsurge | Water |
| Sprout cat | Spriglin → Bramblepaw → Verdantler | Grass |
| Mushroom guardian | Sporelle → Mycelith → Fungolem | Grass |
| Storm rodent | Sparkit → Voltyx → Galvanox | Electric |
| Night wisp | Murklit → Duskwing → Nocturnyx | Shadow |

Legendaries: **Voidra** waits behind the rift in the Shadow Sanctum, and **Luminox** is a rare
encounter in Gloomhollow Cave.

## Project structure

```
index.html              page shell, HUD, dialogue, menus and overlays
css/style.css           retro design system, responsive layout and touch controls
js/main.js              boot
js/game.js              controller: movement, warps, encounters, battles, quests, save/load
js/ui.js                DOM dialogue, party/bag/Index/shop/storage/save screens
js/data/types.js        element chart and colours
js/data/moves.js        40 moves with effects
js/data/species.js      bestiary, stats, learnsets, evolutions, creature instances
js/data/items.js        orbs, potions, cures and shop stock
js/data/world.js        maps, NPCs, buildings, props, encounters and warps
js/data/quests.js       quest definitions and progress text
js/engine/art.js        procedural pixel-art creatures, people, tiles, buildings, props
js/engine/scene.js      overworld and battle rendering, camera, particles
js/engine/battle.js     turn-based battle engine (pure logic, no DOM)
js/engine/audio.js      WebAudio chiptune themes and SFX
js/engine/save.js       versioned localStorage save/load
tests/logic.test.mjs    content integrity, battle math, map connectivity, reachability
tests/smoke.mjs         optional jsdom end-to-end UI test
tools/preview.mjs       optional native-canvas art/scene preview renderer
tools/browser-playthrough.mjs  optional real-browser end-to-end playthrough
```

## Tests

```bash
npm test          # 29 headless logic tests (no dependencies)
npm run check     # syntax-check the game modules
```

Optional UI/art checks need two local tools (not runtime dependencies):

```bash
npm install --no-save jsdom @napi-rs/canvas
node tests/smoke.mjs      # boots the real UI in jsdom, starts a journey, battles, catches, shops, saves
node tools/preview.mjs    # rewrites artifacts/bestiary.png and artifacts/scenes.png
```

A full real-browser playthrough covers movement, NPCs, encounters, catching, menus, the
clinic, shop, storage, the Glowberry quest, save/Continue, all three bosses, the ending,
the post-game Voidra encounter and a touch-sized layout:

```bash
npm install --no-save playwright-core
npx playwright install chromium
node tools/browser-playthrough.mjs
```

Set `CHROME_PATH` if Chromium lives outside Playwright's cache. The script writes
screenshots to `artifacts/browser/`.

The UI smoke test verifies boot, starter selection, dialogue, lab warp, all menu tabs,
movement, a full battle, capture through the bag, the shop, healing, storage, save round-trip,
quest rewards and a clean console. It stubs the 2D context and does not replace a real browser
check, so interactive visual testing is still recommended.

## Notes

- Battle RNG uses `Math.random`; the engine accepts an injectable RNG, which the tests use for
  deterministic captures and fights.
- `window.mythlings` exposes the running game for debugging.
- All creatures, names, sprites, maps, dialogue, music and code are original to this project.
