// world.js — builds Solmar City: streets, blocks, towers, palms, marina and beach.
// All geometry is procedural three.js boxes and cylinders; no external assets.
window.G = window.G || {};
(function () {
  var G = window.G;
  var ROAD_POS = [-180, -120, -60, 0, 60, 120, 180];
  var HALF = 210;
  var BUILDING_COLORS = [0xe8dcc8, 0xd9c4a5, 0xc9b8a3, 0xf2e6d0, 0xb9c9c9, 0xd8a08a, 0xcfd8dc, 0xe6cfa8];
  var ROOF_COLORS = [0x8a6f5c, 0x5c6e7a, 0x7a5c6e, 0x6e7a5c];
  function box(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    return m;
  }
  function addCollider(list, minX, maxX, minZ, maxZ) { list.push({ minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ }); }
  G.world = {
    roads: ROAD_POS,
    half: HALF,
    colliders: [],
    markers: {
      marina: { x: 0, z: 188, label: "Solmar Marina" },
      garage: { x: 132, z: -112, label: "Rico's Garage" },
      safehouse: { x: -150, z: 166, label: "Safehouse" },
      depot: { x: -60, z: -186, label: "Courier Depot" },
      plaza: { x: 30, z: 30, label: "Palm Plaza" }
    },
    build: function (scene) {
      var colliders = this.colliders;
      var sun = new THREE.DirectionalLight(0xfff2d0, 1.35);
      sun.position.set(120, 180, 60);
      scene.add(sun);
      scene.add(new THREE.AmbientLight(0xbfd9e8, 0.75));
      scene.add(new THREE.HemisphereLight(0x9fd4ff, 0x8a6f4d, 0.5));
      scene.fog = new THREE.Fog(0xa8d4e6, 260, 520);
      scene.background = new THREE.Color(0x87c5e0);
      // Ground: city slab plus sand beach to the south and east.
      var ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 160, HALF * 2 + 160), new THREE.MeshLambertMaterial({ color: 0x9dbb7a }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 20);
      scene.add(ground);
      var sand = new THREE.Mesh(new THREE.PlaneGeometry(520, 90), new THREE.MeshLambertMaterial({ color: 0xe8d9a8 }));
      sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, 235);
      scene.add(sand);
      // Sea beyond the marina.
      var sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 120), new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.3, 320);
      scene.add(sea);
      // Roads: asphalt strips both directions, with pale centre dashes.
      ROAD_POS.forEach(function (p) {
        var hRoad = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 12), new THREE.MeshLambertMaterial({ color: 0x3a3f45 }));
        hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.02, p); scene.add(hRoad);
        var vRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, HALF * 2), new THREE.MeshLambertMaterial({ color: 0x3a3f45 }));
        vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(p, 0.02, 0); scene.add(vRoad);
        for (var d = -HALF + 10; d <= HALF - 10; d += 20) {
          var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 4), new THREE.MeshLambertMaterial({ color: 0xf5e9c8 }));
          dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.04, p); scene.add(dash);
          var dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.7), new THREE.MeshLambertMaterial({ color: 0xf5e9c8 }));
          dash2.rotation.x = -Math.PI / 2; dash2.position.set(p, 0.04, d); scene.add(dash2);
        }
      });
      // City blocks: buildings with varied heights, colours and rooftop boxes.
      for (var ix = 0; ix < ROAD_POS.length - 1; ix++) {
        for (var iz = 0; iz < ROAD_POS.length - 1; iz++) {
          var x0 = ROAD_POS[ix] + 9, x1 = ROAD_POS[ix + 1] - 9;
          var z0 = ROAD_POS[iz] + 9, z1 = ROAD_POS[iz + 1] - 9;
          var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
          var bw = (x1 - x0) * G.rand(0.55, 0.8), bd = (z1 - z0) * G.rand(0.55, 0.8);
          var bh = G.rand(8, 42);
          if (Math.abs(cx) < 45 && Math.abs(cz) < 45) continue; // keep Palm Plaza open
          var b = box(bw, bh, bd, G.pick(BUILDING_COLORS), cx, bh / 2, cz);
          scene.add(b);
          var roof = box(bw * 0.5, 2.5, bd * 0.5, G.pick(ROOF_COLORS), cx, bh + 1.2, cz);
          scene.add(roof);
          // A glowing sign band on taller towers.
          if (bh > 26) {
            var sign = box(bw * 0.7, 1.6, 0.4, 0xffd166, cx, bh - 2, cz + bd / 2 + 0.2);
            sign.material = new THREE.MeshBasicMaterial({ color: 0xffd166 });
            scene.add(sign);
          }
          addCollider(colliders, cx - bw / 2, cx + bw / 2, cz - bd / 2, cz + bd / 2);
        }
      }
      // Palm Plaza: fountain and palms at the city centre.
      var fountain = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.6, 20), new THREE.MeshLambertMaterial({ color: 0x7fb8c9 }));
      fountain.position.set(30, 0.8, 30); scene.add(fountain);
      addCollider(colliders, 20, 40, 20, 40);
      // Palm trees along the marina front and plaza.
      var palmSpots = [];
      for (var px = -180; px <= 180; px += 30) palmSpots.push([px, 196]);
      for (var pz = -150; pz <= 150; pz += 60) { palmSpots.push([48, pz]); palmSpots.push([12, pz]); }
      palmSpots.forEach(function (s) { this.addPalm(scene, s[0], s[1]); }, this);
      // Marina: wooden docks, moored boats, lighthouse.
      for (var d = 0; d < 4; d++) {
        var dock = box(4, 1, 34, 0x8a6f4d, -90 + d * 60, 0.5, 212);
        scene.add(dock);
        var boat = new THREE.Group();
        var hull = box(5, 2, 14, d % 2 ? 0xf2f2f2 : 0xd94f3d, 0, 1, 0);
        var cabin = box(3.4, 2.2, 5, 0xffffff, 0, 3, -1);
        boat.add(hull); boat.add(cabin);
        boat.position.set(-90 + d * 60 + 7, 0.4, 222);
        scene.add(boat);
      }
      var light = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 26, 10), new THREE.MeshLambertMaterial({ color: 0xf2ede4 }));
      light.position.set(-195, 13, 210); scene.add(light);
      var lampTop = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      lampTop.position.set(-195, 27, 210); scene.add(lampTop);
      addCollider(colliders, -198, -192, 207, 213);
      // Garage building (mission 1 destination) and safehouse (mission 3).
      var garage = box(26, 9, 18, 0xc25e3d, 132, 4.5, -132);
      scene.add(garage);
      addCollider(colliders, 119, 145, -141, -123);
      var safe = box(16, 7, 14, 0x5c7a8a, -150, 3.5, 150);
      scene.add(safe);
      addCollider(colliders, -158, -142, 143, 157);
      // Street lamps along the main roads.
      ROAD_POS.forEach(function (p) {
        [-150, -30, 90].forEach(function (q) {
          var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 6), new THREE.MeshLambertMaterial({ color: 0x2c3136 }));
          pole.position.set(p + 8, 3.5, q); scene.add(pole);
          var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2b8 }));
          bulb.position.set(p + 8, 7.2, q); scene.add(bulb);
        });
      });
    },
    addPalm: function (scene, x, z) {
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 7), new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
      trunk.position.set(x, 3.5, z); trunk.rotation.z = 0.08;
      scene.add(trunk);
      var leaves = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3.2, 7), new THREE.MeshLambertMaterial({ color: 0x2f9e5f }));
      leaves.position.set(x + 0.6, 8, z);
      scene.add(leaves);
    },
    collide: function (pos, radius) {
      var hit = false;
      for (var i = 0; i < this.colliders.length; i++) {
        if (G.resolveCircleVsBox(pos, radius, this.colliders[i])) hit = true;
      }
      pos.x = G.clamp(pos.x, -HALF - 30, HALF + 30);
      pos.z = G.clamp(pos.z, -HALF - 30, 262);
      return hit;
    },
    nearestRoad: function (x, z) {
      var best = ROAD_POS[0], bd = 1e9;
      ROAD_POS.forEach(function (p) {
        var d = Math.min(Math.abs(x - p), Math.abs(z - p));
        if (d < bd) { bd = d; best = p; }
      });
      return best;
    }
  };
})();
