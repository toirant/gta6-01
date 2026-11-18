// Solmar City — deterministic screenshot staging (?shot=title|drive|chase|mission).
// Each shot puts the live game in a composed state and raises window.__shotReady
// once a few frames have rendered, so a screenshot script can capture it.

export function applyShot(game, shot) {
  const g = game;
  if (shot === 'title') {
    g.setMode('title');
    // Slow orbit around Solmar Tower for the title backdrop.
    g.titleOrbit = true;
    return;
  }
  // The other shots all start a real game.
  g.startNewGame();
  g.setMode('playing');
  if (shot === 'drive') {
    // Put Mara in a red sedan on Coral Row, traffic around her, car rolling.
    const car = g.spawnParkedCar(0, -29 + 3.5, 0, 0xc23b2e);
    g.player.x = 0; g.player.z = -29 + 3.5;
    g.player.enterCar(car);
    g.player.camYaw = 0;
    g.shotAutodrive = true;
    g.missions.startMission(0);
    g.missions.stepIndex = 0;
    g.missions.updateMarker();
  } else if (shot === 'chase') {
    const car = g.spawnParkedCar(0, 29, 0, 0x2e6fc2);
    g.player.x = 0; g.player.z = 29;
    g.player.enterCar(car);
    g.player.camYaw = 0;
    g.shotAutodrive = true;
    g.police.addHeat(55, g);
    for (let i = 0; i < 3; i++) g.police.spawnCarNear(g.player.x, g.player.z, 26 + i * 6);
    // Stage two cruisers ahead on the road, headlights toward the player,
    // so the chase reads in the frame (the third comes up from behind).
    const cops = g.police.cars;
    if (cops[0]) {
      cops[0].x = 6; cops[0].z = g.player.z + 42;
      cops[0].heading = Math.PI; cops[0].mesh.rotation.y = Math.PI;
    }
    if (cops[1]) {
      cops[1].x = -6; cops[1].z = g.player.z + 30;
      cops[1].heading = Math.PI; cops[1].mesh.rotation.y = Math.PI;
    }
    // Catch the chase early, before the cruisers close in and pass behind.
    g.shotReadyAfter = 30;
    g.missions.startMission(2);
    // Mission 3 starts with heat; keep the chase visible.
    g.police.heat = 55;
  } else if (shot === 'mission') {
    // On foot by the marina pier, pistol out, mission 1 active, peds nearby.
    // (On the sand beside the pier — the pier itself is solid.)
    g.player.x = -52; g.player.z = 228;
    g.player.heading = 0;
    g.player.camYaw = 0;
    g.missions.startMission(0);
    g.traffic.addPed(-48, 232);
    g.traffic.addPed(-56, 224);
  }
  // Let the world settle, then signal readiness.
  g.shotFrames = 0;
  if (!g.shotReadyAfter) g.shotReadyAfter = 60;
}
