// Tulum diorama for the landing page.
//
// Renders a small voxel world with three.js: a ceiba tree with palm fronds and
// buttress roots, a flock of birds that perch in its branches, leaves that fall
// in the wind, an off-grid house with solar panels, a cenote, and scattered
// rocks and bushes, all sitting on a floating block of sand.
//
// How the tree moves: the tree is one instanced mesh of cubes ("voxels"). Every
// voxel belongs to a "bone" (the trunk, a branch, or a single frond). Each frame
// the bones bend like damped springs, pushed by the wind and by the pointer, and
// a patched vertex shader moves every voxel along with its bone.
//
// Requires the global THREE (the r159 build loaded with a plain <script> tag).
(function () {
  'use strict';

  // Everything you can tune about the scene. The scene re-reads this object on
  // every frame, so values can be tried live from the browser console, e.g.
  // `tulumScene.config.leafStyle = 'Monstera'`.
  var CONFIG = {
    // Scene
    birdCount: 50,          // 0-150
    windStrength: 0.8,      // 0-3
    leafFall: 1,            // 0-4, how often leaves drop
    shadowOpacity: 0.06,    // 0-0.4

    // Sky
    showSky: true,
    skyTopColor: '#4a8fd6',
    skyHorizonColor: '#cfe6f7',
    groundColor: '#e4cd9a',

    // Cloud
    showCloud: true,
    cloudSpeed: 2.6,
    cloudSize: 0.6,
    cloudHeight: 4,         // above the top of the tree
    cloudColor: '#f4efe2',
    cloudGlow: 0.11,

    // House
    showHouse: true,
    houseX: -40,
    houseZ: 8,
    houseSize: 1,
    houseWidth: 15,         // in voxels, 8-26
    houseWallColor: '#ecdab8',
    houseRoofColor: '#b89a6e',
    solarPanelColor: '#26303b',
    solarFrameColor: '#eeeeee',
    windowColor: '#4a4038',
    doorColor: '#7a573c',
    deckColor: '#8f6b4a',
    waterTankColor: '#6fb3cf',

    // Branches
    mainBranches: 4,        // 1-9
    branchDepth: 3,         // 0-3, how many times branches fork
    branchStyle: 'Twisted', // Spreading | Upright | Weeping | Umbrella | Twisted
    branchSpread: 1.5,
    branchLength: 1.45,
    branchThickness: 0.9,
    branchCurl: 0.3,
    branchForks: 3,         // 1-4 children per fork
    lowerBranches: true,

    // Leaves
    frondsPerCluster: 5,
    frondLength: 16,
    frondWidth: 0.8,
    leafClusterSize: 2.7,
    leafStyle: 'Palm',      // Jungle fronds | Palm | Monstera | Round puffs | Pine needles | Hanging vines
    leafArrangement: 'Radial', // Radial | Upward | Drooping | Fan
    leavesOnBranches: true,

    // Birds
    birdSize: 0.5,
    birdShape: 0.8,         // 0 = paper plane, 1 = bird

    // Flocking ("boids")
    separation: 5,
    alignment: 1.2,
    cohesion: 2,
    neighborRadius: 22,
    maxSpeed: 15,

    // Colors
    backgroundColor: '#f3efe8', // used when showSky is off
    barkColor: '#d4b989',
    rootColor: '#c3a473',
    leafColor: '#b6d84c',
    leafTipColor: '#d3ea72',
    birdColor: '#8c8c8c',

    // Page: when the overlay panels are shown, the camera shifts to make room
    showOverlay: true,

    // Light
    sunAzimuth: 47,         // degrees
    sunElevation: 48,       // degrees
    sunIntensity: 3,
    sunColor: '#fff0d0',
    ambientIntensity: 2.5,

    // Cenote
    showCenote: true,
    cenoteX: 26,
    cenoteZ: 40,
    cenoteSize: 1.95,
    cenoteDepth: 5,
    cenoteWaterColor: '#2fc1b8',
    cenoteWaterOpacity: 0.71,
    cenoteRockColor: '#cfc6b4',
    cenoteWaterLevel: 1,    // voxels below the ground

    // Camera
    cameraYaw: -7,          // degrees
    cameraPitch: 17,        // degrees
    cameraZoom: 0.6,
    cameraHeight: -8,
    cameraPanX: 1,
    cameraFov: 44,          // degrees
    cameraDrift: 1,         // slow automatic sway
    mouseParallax: 2,       // how much the camera follows the pointer

    // Horizon
    horizonStyle: 'Floating rock', // Soft fog | Ground haze | Clear | Diorama block | Floating rock
    fogDistance: 1,
    dioramaWidth: 165,
    dioramaDepth: 150,
    dioramaThickness: 14,

    // Rocks
    showRocks: true,
    rockCount: 22,
    rockSize: 0.85,
    rockColor: '#a3a39b',
    scatterSeed: 1,         // change to reshuffle rocks and bushes

    // Bushes
    showBushes: true,
    bushCount: 16,
    bushSize: 0.85,
    bushColor: '#7aa63a',
    bushTipColor: '#b9d957',

    // Ground texture: patches of darker sand, pebbles and dry grass
    groundTexture: 1,       // 0 = flat color, 1 = full texture

    // Floating rock under the island (horizonStyle 'Floating rock'), shaped
    // by a grayscale depth map
    islandDepth: 46,        // deepest point below the ground, in voxels
    islandRoughness: 1,     // 0-2, how uneven the outline and underside are
    islandSpikes: 14,       // chunky spikes hanging from the bottom
    islandColor: '#a88c62',
    islandSeed: 3,          // change to reshape the rock

    // Vines hanging from the island's edge and the rock spikes
    showVines: true,
    vineDensity: 0.35,      // 0-1
    vineLength: 9,

    // Capybara
    showCapybara: true,
    capybaraSize: 1.1,
    capybaraSpeed: 2.4,
    capybaraColor: '#9b6b3f',

    // Psychedelic mode, started by clicking the diamond above the capybara
    psychedelicDuration: 30 // seconds
  };

  window.tulumScene = { config: CONFIG };

  // Builds the whole scene inside #scene and starts the animation loop.
  function init(THREE) {
    const host = document.getElementById('scene');
    if (!host) return;

    const Vec3 = THREE.Vector3;
    const Quat = THREE.Quaternion;
    const UP = new Vec3(0, 1, 0);
    const toRad = THREE.MathUtils.degToRad;

    // Scratch color reused wherever a color is computed and immediately copied.
    const scratchColor = new THREE.Color();

    // A unit cube shared by every voxel mesh.
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

    // ------------------------------------------------------------------------
    // Random numbers
    // ------------------------------------------------------------------------

    // Seeded random numbers for the tree (mulberry32), so it grows the same
    // way on every load. buildTree() resets the seed before each build.
    let treeSeed = 7;
    function treeRandom() {
      treeSeed |= 0;
      treeSeed = treeSeed + 0x6D2B79F5 | 0;
      let t = Math.imul(treeSeed ^ treeSeed >>> 15, 1 | treeSeed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // Returns a small seeded random generator (Park-Miller). The cloud, cenote
    // and scattered rocks/bushes each use their own, so changing one never
    // reshuffles the others.
    function seededRandom(seed) {
      let state = seed;
      return function () {
        state = (state * 16807) % 2147483647;
        return state / 2147483647;
      };
    }

    // Smooth random noise on a width x height grid: random values at control
    // points every `cellSize` cells, blended smoothly in between. With `wrap`
    // the noise tiles seamlessly (width and height must then be multiples of
    // cellSize). Returns a Float32Array of values in 0..1, row by row.
    function valueNoise(width, height, cellSize, random, wrap) {
      const cols = wrap ? width / cellSize : Math.ceil(width / cellSize) + 2;
      const rows = wrap ? height / cellSize : Math.ceil(height / cellSize) + 2;
      const grid = new Float32Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = random();
      const at = (cx, cy) => grid[(cy % rows) * cols + (cx % cols)];
      const smooth = t => t * t * (3 - 2 * t);
      const lerp = (a, b, t) => a + (b - a) * t;

      const out = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const gx = x / cellSize;
          const gy = y / cellSize;
          const x0 = Math.floor(gx);
          const y0 = Math.floor(gy);
          const tx = smooth(gx - x0);
          const ty = smooth(gy - y0);
          const top = lerp(at(x0, y0), at(x0 + 1, y0), tx);
          const bottom = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
          out[y * width + x] = lerp(top, bottom, ty);
        }
      }
      return out;
    }

    // ------------------------------------------------------------------------
    // Renderer, camera and lights
    // ------------------------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const clearColor = new THREE.Color('#ffffff');
    renderer.setClearColor(clearColor, 1);
    scene.fog = new THREE.Fog(clearColor.clone(), 220, 420);

    // A near plane of 1.5 (not smaller) keeps enough depth precision at a
    // distance to separate the sand from the rock just under it.
    const camera = new THREE.PerspectiveCamera(32, host.clientWidth / host.clientHeight, 1.5, 800);
    const cameraTarget = new Vec3(); // point the camera looks at, set by fitCamera()
    let cameraDistance = 150;        // distance that frames the whole scene, set by fitCamera()

    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xdcdcdc, 3.2);
    scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(45, 110, 60);
    sun.target.position.set(0, 20, 0);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 320 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    // ------------------------------------------------------------------------
    // Ground and sky
    // ------------------------------------------------------------------------

    // Transparent plane that only shows the shadows falling on it.
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.1 });
    const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), shadowMaterial);
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -0.5;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    // The sand surface. buildGroundShapes() swaps in the real outline.
    const groundSurface = new THREE.Mesh(
      new THREE.CircleGeometry(430, 64),
      new THREE.MeshBasicMaterial({ color: '#f6f5f2' })
    );
    groundSurface.rotation.x = -Math.PI / 2;
    groundSurface.position.y = -0.53;
    scene.add(groundSurface);

    // Sand texture for the ground. Each texel is a color multiplier on top of
    // CONFIG.groundColor: soft patches of darker, damper sand, scattered
    // pebbles and a few tufts of dry grass. One texel covers one world unit,
    // so the pattern lines up with the voxels, and it tiles across the ground
    // (ShapeGeometry uses world coordinates as texture coordinates).
    const SAND_TEXTURE_SIZE = 256;
    const SAND_BRIGHTNESS = 0.9; // average texel value, compensated in syncConfig()

    // Builds the sand texture. strength 0 gives a flat color, 1 the full pattern.
    function makeSandTexture(strength) {
      const N = SAND_TEXTURE_SIZE;
      const random = seededRandom(77);
      const patches = valueNoise(N, N, 32, random, true);
      const detail = valueNoise(N, N, 8, random, true);
      const grass = valueNoise(N, N, 16, random, true);
      const data = new Uint8Array(N * N * 4);

      for (let i = 0; i < N * N; i++) {
        const shade = SAND_BRIGHTNESS + (patches[i] - 0.5) * 0.16 + (detail[i] - 0.5) * 0.08 + (random() - 0.5) * 0.02;
        let r = shade;
        let g = shade;
        let b = shade;
        if (patches[i] < 0.32) {
          // Damp sand: darker and warmer.
          r *= 0.93;
          g *= 0.9;
          b *= 0.84;
        }
        if (grass[i] > 0.68 && random() < 0.45) {
          // Dry grass tufts.
          r *= 0.78;
          g *= 0.92;
          b *= 0.55;
        } else if (random() < 0.012) {
          // Pebble.
          r = g = b = 0.72;
        }
        // Blend towards the average brightness for weaker textures.
        const mix = v => SAND_BRIGHTNESS + (v - SAND_BRIGHTNESS) * strength;
        data[i * 4] = Math.round(Math.min(1, mix(r)) * 255);
        data[i * 4 + 1] = Math.round(Math.min(1, mix(g)) * 255);
        data[i * 4 + 2] = Math.round(Math.min(1, mix(b)) * 255);
        data[i * 4 + 3] = 255;
      }

      const texture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.repeat.set(1 / N, 1 / N);
      texture.offset.set(0.5 / N, 0.5 / N); // texel centers on voxel centers
      texture.needsUpdate = true;
      return texture;
    }

    // The sides of the floating "diorama block" under the sand: an open,
    // four-sided cylinder rotated so its faces line up with the axes.
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 4, 1, true).rotateY(Math.PI / 4),
      new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true })
    );
    plinth.receiveShadow = true;
    plinth.visible = false;
    scene.add(plinth);

    // Current horizon settings. centerX follows the middle of the scene so the
    // island stays centered under the tree, house and cenote.
    const horizon = { mode: 'Ground haze', width: 220, depth: 130, thickness: 18, centerX: 0, roughness: 1, seed: 3 };

    // Whether the ground is a floating island (a box or a rock) rather than
    // an endless plain.
    function isIsland() {
      return horizon.mode === 'Diorama block' || horizon.mode === 'Floating rock';
    }

    // Distance from the island's center to the edge of the floating rock in
    // the direction of `angle`: a rounded rectangle (superellipse) with a few
    // slow wobbles so the rim looks natural rather than drawn with a ruler.
    function islandRadius(angle) {
      const a = horizon.width / 2;
      const b = horizon.depth / 2;
      const n = 2.6; // 2 = ellipse, higher = squarer
      const base = Math.pow(Math.pow(Math.abs(Math.cos(angle)) / a, n) + Math.pow(Math.abs(Math.sin(angle)) / b, n), -1 / n);
      const p = horizon.seed * 1.7;
      const wobble = 0.05 * (1 + Math.sin(3 * angle + p)) + 0.03 * (1 + Math.sin(5 * angle + p * 2.3)) + 0.015 * (1 + Math.sin(11 * angle + p * 3.1));
      return base * (1 - wobble * horizon.roughness);
    }

    // Whether (x, z) is on the island, at least `margin` in from its edge.
    // Without a floating rock this is the rectangle the island covers.
    function onIsland(x, z, margin) {
      const dx = x - horizon.centerX;
      if (horizon.mode === 'Floating rock') return Math.hypot(dx, z) < islandRadius(Math.atan2(z, dx)) - margin;
      return Math.abs(dx) < horizon.width / 2 - margin && Math.abs(z) < horizon.depth / 2 - margin;
    }

    // Sky dome: a big inside-out sphere with a vertical gradient. It follows
    // the camera so it never gets closer or further away.
    const skyUniforms = {
      uTopColor: { value: new THREE.Color('#5fa8e8') },
      uHorizonColor: { value: new THREE.Color('#cfe6f7') }
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(520, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: [
          'varying vec3 vDirection;',
          'void main() {',
          '  vDirection = normalize(position);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 uTopColor;',
          'uniform vec3 uHorizonColor;',
          'varying vec3 vDirection;',
          'void main() {',
          '  float height = clamp(vDirection.y, 0.0, 1.0);',
          '  gl_FragColor = vec4(mix(uHorizonColor, uTopColor, pow(height, 0.55)), 1.0);',
          '  #include <colorspace_fragment>',
          '}'
        ].join('\n')
      })
    );
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);

    // Where the house and overlay sit. Read by fitCamera() and buildScatter()
    // so the camera frames the house and rocks/bushes keep clear of it.
    const houseLayout = { on: true, width: 15, x: -40, z: 8, scale: 1 };
    let overlayOn = true;

    // ------------------------------------------------------------------------
    // Bone skinning for the tree
    //
    // Each tree voxel has an `aBone` attribute with the index of its bone. The
    // bone transforms live in a float texture, two texels per bone:
    //   texel 2i     rotation quaternion (x, y, z, w)
    //   texel 2i + 1 translation (x, y, z)
    // The patched vertex shader rotates and moves each voxel by its bone.
    // ------------------------------------------------------------------------
    const boneUniforms = { uBones: { value: null } };
    const BONE_SHADER_HEADER =
      'uniform sampler2D uBones;\n' +
      'attribute float aBone;\n' +
      'vec3 rotateByQuat(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }\n';

    // Patches a built-in three.js material so it moves vertices by their bone.
    // withNormals also rotates normals (needed for lighting, not for shadows).
    function applyBoneSkinning(material, withNormals) {
      material.onBeforeCompile = function (shader) {
        Object.assign(shader.uniforms, boneUniforms);
        let vertexShader = BONE_SHADER_HEADER + shader.vertexShader.replace('#include <project_vertex>', `
          int treeBoneIndex = int(aBone + 0.5);
          vec4 treeBoneRotation = texelFetch(uBones, ivec2(treeBoneIndex * 2, 0), 0);
          vec3 treeBoneOffset = texelFetch(uBones, ivec2(treeBoneIndex * 2 + 1, 0), 0).xyz;
          vec4 treePosition = instanceMatrix * vec4(transformed, 1.0);
          treePosition.xyz = rotateByQuat(treeBoneRotation, treePosition.xyz) + treeBoneOffset;
          vec4 mvPosition = modelViewMatrix * treePosition;
          gl_Position = projectionMatrix * mvPosition;`);
        if (withNormals) {
          vertexShader = vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          {
            vec4 treeNormalRotation = texelFetch(uBones, ivec2(int(aBone + 0.5) * 2, 0), 0);
            objectNormal = rotateByQuat(treeNormalRotation, objectNormal);
          }`);
        }
        shader.vertexShader = vertexShader;
      };
      // Both variants share the same base material type, so give each its
      // own program cache key or three.js would reuse the wrong shader.
      material.customProgramCacheKey = function () { return 'tree' + (withNormals ? 'n' : 'd'); };
    }

    const treeMaterial = new THREE.MeshLambertMaterial();
    applyBoneSkinning(treeMaterial, true);
    const treeDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    applyBoneSkinning(treeDepthMaterial, false);

    // ------------------------------------------------------------------------
    // Tree
    // ------------------------------------------------------------------------

    // The current tree: its bones, visible voxels, mesh and perch spots.
    let tree = null;

    // Colors per voxel type. Each voxel also has its own `shade` multiplier
    // so neighbouring cubes differ slightly.
    const palette = {
      bark: new THREE.Color(),
      root: new THREE.Color(),
      leaf: new THREE.Color(),
      tip: new THREE.Color(),
      vein: new THREE.Color()
    };

    // Writes the final color of a voxel into `out` and returns it.
    function voxelColor(voxel, out) {
      return out.copy(palette[voxel.type]).multiplyScalar(voxel.shade);
    }

    // Grows a new tree from the given settings and swaps it in for the old one.
    // The tree is built in voxel space: trunk, roots, branches, then leaves.
    function buildTree(settings) {
      treeSeed = 7;
      const random = treeRandom;
      const bones = [];

      // Adds a bone and returns its index. A bone pivots around `pivot` and
      // bends like a spring; its stiffness and how strongly wind and the
      // pointer push it depend on what kind of bone it is.
      function addBone(parent, pivot, direction, length, radius, kind) {
        const bone = {
          parent,
          pivot: pivot.clone(),
          direction: direction.clone().normalize(),
          length,
          radius,
          kind,
          hitPoints: [],    // sample points used to test if the pointer touches the bone
          leafVoxels: [],   // leaf voxels attached to this bone (they can fall off)
          bend: new Vec3(), // current bend as an axis-angle vector
          bendVelocity: new Vec3(),
          rotation: new Quat(), // world transform, computed by updateBoneTransforms()
          offset: new Vec3(),
          phase: random() * 6.28, // so the bones don't all sway in sync
          lastTouched: 0
        };
        if (kind === 'trunk') {
          Object.assign(bone, { stiffness: 80, damping: 0.6, windGain: 0.004, pushGain: 0.05, maxBend: 0.04 });
        } else if (kind === 'branch') {
          Object.assign(bone, {
            stiffness: 10 + radius * 14,
            damping: 0.2,
            windGain: 0.035 / (0.4 + radius * 0.5),
            pushGain: 2.5 / (1 + radius * 1.5),
            maxBend: 0.3
          });
        } else if (kind === 'frond') {
          Object.assign(bone, { stiffness: 18 + random() * 8, damping: 0.12, windGain: 0.1, pushGain: 2.6, maxBend: 0.7 });
        } else {
          Object.assign(bone, { stiffness: 1, damping: 1, windGain: 0, pushGain: 0, maxBend: 0 });
        }
        bones.push(bone);
        return bones.length - 1;
      }

      // Bone 0 never moves. The roots belong to it.
      addBone(-1, new Vec3(), new Vec3(0, 1, 0), 0, 0, 'static');

      // Voxels are stored by their "x,y,z" key so each cell holds one cube.
      const voxels = new Map();
      const cellKey = (x, y, z) => x + ',' + y + ',' + z;

      // Places one voxel. Wood may replace leaves (so branches show through
      // the foliage); otherwise the first voxel placed in a cell wins.
      function addVoxel(x, y, z, type, bone, kind, shade) {
        if (y < 0) return;
        const key = cellKey(x, y, z);
        const existing = voxels.get(key);
        if (existing && !(kind === 'wood' && existing.kind === 'leaf')) return;
        voxels.set(key, { x, y, z, type, bone, kind, shade: shade ?? (0.9 + random() * 0.14) });
      }

      // Places a rough sphere of voxels (a single voxel for tiny radii).
      function addSphere(cx, cy, cz, radius, type, bone, kind) {
        if (radius < 0.55) {
          addVoxel(Math.round(cx), Math.round(cy), Math.round(cz), type, bone, kind);
          return;
        }
        const r = Math.ceil(radius);
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dz = -r; dz <= r; dz++) {
              if (dx * dx + dy * dy + dz * dz <= radius * radius + 0.35) {
                addVoxel(Math.round(cx + dx), Math.round(cy + dy), Math.round(cz + dz), type, bone, kind);
              }
            }
          }
        }
      }

      // --- Trunk: a slightly wandering column that tapers towards the top
      // and pinches in where the roots flare out at the bottom.
      const TRUNK_BASE = 6;
      const TRUNK_TOP = 34;
      const trunkBone = addBone(0, new Vec3(0, TRUNK_BASE, 0), new Vec3(0, 1, 0), TRUNK_TOP - TRUNK_BASE, 3, 'trunk');

      function trunkRadius(y) {
        const t = (y - TRUNK_BASE) / (TRUNK_TOP - TRUNK_BASE);
        let radius = 2.9 - 0.8 * t;
        if (y < TRUNK_BASE + 3) radius -= (TRUNK_BASE + 3 - y) * 0.35;
        return radius;
      }

      let trunkX = 0;
      let trunkZ = 0;
      for (let y = TRUNK_BASE; y <= TRUNK_TOP; y++) {
        const radius = trunkRadius(y);
        trunkX += (random() - 0.5) * 0.3;
        trunkZ += (random() - 0.5) * 0.3;
        const r = Math.ceil(radius);
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (dx * dx + dz * dz <= radius * radius + 0.3) {
              addVoxel(Math.round(trunkX + dx), y, Math.round(trunkZ + dz), 'bark', trunkBone, 'wood');
            }
          }
        }
        if (y % 4 === 2) bones[trunkBone].hitPoints.push(new Vec3(trunkX, y, trunkZ));
      }
      const trunkTopX = trunkX;
      const trunkTopZ = trunkZ;

      // --- Roots: buttress roots arc from the trunk down to the ground along
      // quadratic Bézier curves; some split into a second, thinner root.
      const curvePoint = new Vec3();

      // Point on the quadratic Bézier curve a -> b -> c at t, written into out.
      function quadraticBezier(a, b, c, t, out) {
        return out.set(0, 0, 0)
          .addScaledVector(a, (1 - t) * (1 - t))
          .addScaledVector(b, 2 * (1 - t) * t)
          .addScaledVector(c, t * t);
      }

      // Sweeps a tapering tube of voxels from start to end, then adds a
      // small foot where the root meets the ground.
      function addRoot(start, control, end, startRadius) {
        for (let t = 0; t <= 1.0001; t += 0.02) {
          quadraticBezier(start, control, end, t, curvePoint);
          addSphere(curvePoint.x, curvePoint.y, curvePoint.z, startRadius * (1 - t * 0.35), 'root', 0, 'wood');
        }
        addSphere(end.x, 0, end.z, startRadius * 1.1, 'root', 0, 'wood');
      }

      const ROOT_COUNT = 16;
      for (let i = 0; i < ROOT_COUNT; i++) {
        const angle = i / ROOT_COUNT * Math.PI * 2 + (random() - 0.5) * 0.4;
        const startY = TRUNK_BASE + 1 + random() * 9;
        const startR = trunkRadius(startY) - 0.4;
        const start = new Vec3(Math.cos(angle) * startR, startY, Math.sin(angle) * startR);
        const reach = 9 + random() * 11;
        const endAngle = angle + (random() - 0.5) * 0.3;
        const end = new Vec3(Math.cos(endAngle) * reach, 0, Math.sin(endAngle) * reach);
        const control = new Vec3(Math.cos(angle) * reach * 0.55, startY + 2 + random() * 4, Math.sin(angle) * reach * 0.55);
        addRoot(start, control, end, 0.95);

        if (random() < 0.55) {
          const splitPoint = quadraticBezier(start, control, end, 0.4 + random() * 0.15, new Vec3());
          const splitAngle = endAngle + (random() < 0.5 ? -1 : 1) * (0.35 + random() * 0.3);
          const splitReach = reach * (1.05 + random() * 0.3);
          const splitEnd = new Vec3(Math.cos(splitAngle) * splitReach, 0, Math.sin(splitAngle) * splitReach);
          const splitControl = splitPoint.clone().lerp(splitEnd, 0.4);
          splitControl.y = splitPoint.y + 1.5;
          addRoot(splitPoint, splitControl, splitEnd, 0.65);
        }
      }

      // --- Branches
      const branchTips = [];

      // Shape presets per branch style:
      //   startLean  how far main branches lean out from the trunk
      //   childLean  how far child branches lean out from their parent
      //   rise       upward pull per step (negative droops)
      //   jitter     random wobble per step
      //   keepDir    how much a child keeps its parent's direction
      //   twist      rotation around the vertical axis per step
      const STYLES = {
        Spreading: { startLean: 0.55, childLean: 0.55, rise: 0.012, jitter: 0.12, keepDir: 0.85, twist: 0 },
        Upright: { startLean: 0.22, childLean: 0.3, rise: 0.035, jitter: 0.08, keepDir: 1, twist: 0 },
        Weeping: { startLean: 0.75, childLean: 0.6, rise: -0.04, jitter: 0.1, keepDir: 0.7, twist: 0 },
        Umbrella: { startLean: 0.3, childLean: 1.4, rise: -0.004, jitter: 0.08, keepDir: 0.25, twist: 0 },
        Twisted: { startLean: 0.6, childLean: 0.6, rise: 0.01, jitter: 0.3, keepDir: 0.85, twist: 0.07 }
      };
      const style = STYLES[settings.branchStyle] || STYLES.Spreading;
      const jitter = style.jitter + settings.branchCurl * 0.3;

      // Grows a branch step by step from (x, y, z), then forks it into
      // smaller branches until depth runs out. Final tips get leaves later.
      function growBranch(parentBone, x, y, z, direction, length, radius, depth) {
        const position = new Vec3(x, y, z);
        const heading = direction.clone().normalize();
        const bone = addBone(parentBone, position, heading, length, radius, 'branch');
        const steps = Math.max(2, Math.round(length / 0.6));
        const twist = style.twist * (random() < 0.5 ? -1 : 1);
        // Weeping trees only droop at their outermost branches.
        const rise = depth < settings.branchDepth || settings.branchStyle !== 'Weeping' ? style.rise : 0.01;

        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          position.addScaledVector(heading, 0.6);
          heading.x += (random() - 0.5) * jitter;
          heading.z += (random() - 0.5) * jitter;
          heading.y += rise;
          if (twist) heading.applyAxisAngle(UP, twist);
          if (position.y < 10 && heading.y < 0) heading.y = 0; // don't dig into the ground
          heading.normalize();

          addSphere(position.x, position.y, position.z, Math.max(radius * (1 - t * 0.5), 0.45), 'bark', bone, 'wood');
          if (i % 3 === 1) bones[bone].hitPoints.push(position.clone());

          // Small fronds sprouting along the thicker branches.
          if (settings.leavesOnBranches && depth <= 1 && i % 6 === 4 && settings.leafStyle !== 'Round puffs') {
            growFrond(bone, position.clone(), random() * 6.28, settings.frondLength * 0.5, 0.9 + random() * 0.14);
          }
        }
        bones[bone].hitPoints.push(position.clone());

        if (depth > 0) {
          const childCount = settings.forks + (random() < 0.3 ? 1 : 0);
          const baseAngle = Math.atan2(heading.z, heading.x);
          const angleStep = 2.4 / Math.max(childCount - 1, 1);
          for (let k = 0; k < childCount; k++) {
            const angle = baseAngle + (k - (childCount - 1) / 2) * Math.min(1.2, angleStep) + (random() - 0.5) * 0.6;
            const outward = new Vec3(Math.cos(angle), 0, Math.sin(angle))
              .multiplyScalar((style.childLean + random() * 0.3) * settings.branchSpread);
            const childDirection = heading.clone().multiplyScalar(style.keepDir).add(outward).normalize();
            growBranch(bone, position.x, position.y, position.z, childDirection, length * (0.62 + random() * 0.15), radius * 0.62, depth - 1);
          }
        } else {
          branchTips.push({ position: position.clone(), bone, direction: heading.clone() });
        }
      }

      // Main branches spread evenly around the top of the trunk. Fewer fork
      // levels get longer branches so the crown stays about the same size.
      const depth = settings.branchDepth;
      const lengthScale = ([1.7, 1.25, 1, 0.85][depth] || 1) * settings.branchLength;
      for (let i = 0; i < settings.mainBranches; i++) {
        const angle = i / settings.mainBranches * Math.PI * 2 + (random() - 0.5) * 0.6;
        const lean = style.startLean * settings.branchSpread;
        growBranch(
          trunkBone, trunkTopX, TRUNK_TOP - 1, trunkTopZ,
          new Vec3(Math.cos(angle) * lean, 1, Math.sin(angle) * lean),
          (14 + random() * 6) * lengthScale,
          1.8 * settings.branchThickness,
          depth
        );
      }

      // Two shorter branches lower down the trunk, on opposite sides.
      if (settings.lowerBranches) {
        for (const [y, angle] of [[22, 0.4], [26, 3.3]]) {
          growBranch(
            trunkBone, trunkX * 0.7, y, trunkZ * 0.7,
            new Vec3(Math.cos(angle), 0.6, Math.sin(angle)),
            13 * Math.min(lengthScale, 1.2),
            1.2 * settings.branchThickness,
            Math.min(depth, 1)
          );
        }
      }

      // --- Leaves

      // Grows one frond (a leaf with its own bone) from `origin` in the
      // direction of `angle`. The leaf style decides its outline: palms have
      // separate leaflets, monsteras have holes, vines hang straight down.
      function growFrond(parentBone, origin, angle, length, frondShade) {
        const leafStyle = settings.leafStyle;
        const arrangement = settings.leafArrangement;

        // Initial upward tilt and how quickly the frond droops.
        let rise = arrangement === 'Upward' ? 1.3 + random() * 0.4
          : arrangement === 'Drooping' ? -0.1 + random() * 0.2
          : arrangement === 'Fan' ? 0.35 + random() * 0.3
          : 0.5 + random() * 0.35;
        let droopScale = arrangement === 'Drooping' ? 1.6 : arrangement === 'Upward' ? 0.6 : 1;
        if (leafStyle === 'Palm') droopScale *= 1.3;
        if (leafStyle === 'Monstera') length *= 0.8;
        if (leafStyle === 'Hanging vines') {
          rise = -5;
          droopScale = 0;
          length *= 1.6;
        }

        const heading = new Vec3(Math.cos(angle), rise, Math.sin(angle)).normalize();
        const bone = addBone(parentBone, origin, heading, length, 0.3, 'frond');
        const across = new Vec3(-Math.sin(angle), 0, Math.cos(angle)); // leaf width direction
        // How much the leaf edges hang below the midrib.
        const edgeSlope = leafStyle === 'Palm' ? 0.55 : leafStyle === 'Hanging vines' ? 0 : 0.3;
        const position = origin.clone();
        const steps = Math.max(2, Math.round(length / 0.7));
        const droop = (0.07 + random() * 0.05) * 8 / Math.max(length, 3) * droopScale;

        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          position.addScaledVector(heading, 0.7);
          heading.y -= droop;
          if (leafStyle === 'Hanging vines') {
            heading.x += (random() - 0.5) * 0.08;
            heading.z += (random() - 0.5) * 0.08;
          }
          heading.normalize();
          if (position.y < 1) break;

          // Half-width of the leaf at this step.
          let halfWidth;
          if (leafStyle === 'Palm') {
            halfWidth = i % 2 === 0 && t > 0.08 ? Math.round(2.8 * settings.frondWidth * (1 - t * 0.55)) : 0;
          } else if (leafStyle === 'Monstera') {
            halfWidth = Math.round(Math.sin(Math.PI * Math.min(1, t * 1.15)) * 3.4 * settings.frondWidth);
          } else if (leafStyle === 'Pine needles') {
            halfWidth = i % 2 === 0 ? Math.max(1, Math.round(settings.frondWidth)) : 0;
          } else if (leafStyle === 'Hanging vines') {
            halfWidth = i % 3 === 0 ? Math.max(1, Math.round(settings.frondWidth)) : 0;
          } else {
            halfWidth = Math.round(Math.sin(Math.PI * Math.min(1, t * 1.1)) * 2.4 * settings.frondWidth);
          }

          for (let s = -halfWidth; s <= halfWidth; s++) {
            const fromCenter = Math.abs(s);
            // Monstera holes.
            if (leafStyle === 'Monstera' && fromCenter >= 1 && fromCenter < halfWidth && (i * 7 + fromCenter * 3) % 5 === 0) continue;
            // Needles and vines are just the midrib plus the outer points.
            if ((leafStyle === 'Pine needles' || leafStyle === 'Hanging vines') && s !== 0 && fromCenter !== halfWidth) continue;

            const hasVein = leafStyle !== 'Pine needles' && leafStyle !== 'Hanging vines';
            const type = s === 0 && t > 0.15 && hasVein ? 'vein'
              : (t > 0.72 || fromCenter === halfWidth && random() < 0.4) ? 'tip'
              : 'leaf';
            addVoxel(
              Math.round(position.x + across.x * s),
              Math.round(position.y - fromCenter * edgeSlope + (leafStyle === 'Pine needles' ? fromCenter * 0.6 : 0)),
              Math.round(position.z + across.z * s),
              type, bone, 'leaf',
              type === 'leaf' ? frondShade * (0.97 + random() * 0.06) : undefined
            );
          }
          if (i % 2 === 1) bones[bone].hitPoints.push(position.clone());
        }
      }

      // Grows one round puff of foliage next to `origin` (for "Round puffs").
      function growPuff(parentBone, origin, angle, radius) {
        const offset = new Vec3(Math.cos(angle) * radius * 0.9, (random() - 0.3) * radius * 0.8, Math.sin(angle) * radius * 0.9);
        const bone = addBone(parentBone, origin, offset, radius * 2, 0.6, 'frond');
        const center = origin.clone().add(offset);
        addSphere(center.x, center.y, center.z, radius, 'leaf', bone, 'leaf');
        addSphere(center.x, center.y + radius * 0.45, center.z, radius * 0.65, 'tip', bone, 'leaf');
        bones[bone].hitPoints.push(center);
      }

      // Every branch tip gets a small leafy knot and a ring (or fan) of fronds.
      for (const tip of branchTips) {
        if (settings.clusterSize > 0.3) {
          addSphere(tip.position.x, tip.position.y + 0.5, tip.position.z, settings.clusterSize, 'leaf', tip.bone, 'leaf');
        }
        const count = settings.fronds;
        const ringOffset = random() * 6.28;
        const fanCenter = Math.atan2(tip.direction.z, tip.direction.x);
        for (let k = 0; k < count; k++) {
          const angle = settings.leafArrangement === 'Fan'
            ? fanCenter + (count > 1 ? (k / (count - 1) - 0.5) * 2.4 : 0) + (random() - 0.5) * 0.2
            : ringOffset + k / count * Math.PI * 2 + (random() - 0.5) * 0.4;
          if (settings.leafStyle === 'Round puffs') {
            growPuff(tip.bone, tip.position, angle, Math.max(1, settings.frondLength * 0.22 * settings.frondWidth * (0.8 + random() * 0.4)));
          } else {
            growFrond(tip.bone, tip.position, angle, settings.frondLength * (0.75 + random() * 0.55), 0.9 + random() * 0.14);
          }
        }
      }

      // --- Turn the voxels into a mesh

      // Skip voxels buried on all six sides; nobody can see them.
      const visible = [...voxels.values()].filter(v => !(
        voxels.has(cellKey(v.x + 1, v.y, v.z)) && voxels.has(cellKey(v.x - 1, v.y, v.z)) &&
        voxels.has(cellKey(v.x, v.y + 1, v.z)) && voxels.has(cellKey(v.x, v.y - 1, v.z)) &&
        voxels.has(cellKey(v.x, v.y, v.z + 1)) && voxels.has(cellKey(v.x, v.y, v.z - 1))
      ));

      let maxY = 0;
      let maxR = 0;
      for (const v of visible) {
        maxY = Math.max(maxY, v.y);
        maxR = Math.max(maxR, Math.abs(v.x), Math.abs(v.z));
        if (v.kind === 'leaf') bones[v.bone].leafVoxels.push(v);
      }

      const boneCount = bones.length;
      const boneData = new Float32Array(boneCount * 8);
      const boneTexture = new THREE.DataTexture(boneData, boneCount * 2, 1, THREE.RGBAFormat, THREE.FloatType);
      boneTexture.needsUpdate = true;

      const geometry = cubeGeometry.clone();
      const boneIndices = new Float32Array(visible.length);
      const mesh = new THREE.InstancedMesh(geometry, treeMaterial, visible.length);
      mesh.customDepthMaterial = treeDepthMaterial;
      const matrix = new THREE.Matrix4();
      visible.forEach((v, i) => {
        matrix.makeTranslation(v.x, v.y, v.z);
        mesh.setMatrixAt(i, matrix);
        boneIndices[i] = v.bone;
      });
      geometry.setAttribute('aBone', new THREE.InstancedBufferAttribute(boneIndices, 1));
      mesh.setColorAt(0, palette.bark); // creates the instance color buffer; recolorTree() fills it
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // the shader moves voxels, so three.js bounds are unreliable

      // --- Perches: open spots on top of branches, at least 3.2 apart.
      const perches = [];
      const openBranchTops = visible.filter(v =>
        v.kind === 'wood' && bones[v.bone].kind === 'branch' &&
        !voxels.has(cellKey(v.x, v.y + 1, v.z)) && !voxels.has(cellKey(v.x, v.y + 2, v.z))
      );
      openBranchTops.sort(() => random() - 0.5); // seeded shuffle
      for (const v of openBranchTops) {
        if (perches.length >= 70) break;
        if (perches.every(p => Math.hypot(p.voxel.x - v.x, p.voxel.y - v.y, p.voxel.z - v.z) > 3.2)) {
          perches.push({ voxel: v, bird: null });
        }
      }

      // Birds sitting on the old tree would be left floating, so send them off.
      for (const bird of birds) {
        if (bird.state !== 'flying') {
          bird.perch = null;
          bird.state = 'flying';
          bird.velocity.set(Math.random() - 0.5, 1, Math.random() - 0.5).setLength(8);
          bird.perchCooldown = 3;
        }
      }

      if (tree) {
        scene.remove(tree.mesh);
        tree.mesh.geometry.dispose();
        tree.mesh.dispose();
        tree.boneTexture.dispose();
      }
      tree = {
        bones,
        voxels: visible,
        mesh,
        boneCount,
        boneData,
        boneTexture,
        maxY,
        maxR,
        trunkTop: TRUNK_TOP,
        perches,
        // Only frond leaves fall; the knots at branch tips stay put.
        fallingLeafSources: visible.filter(v => v.kind === 'leaf' && bones[v.bone].kind === 'frond')
      };
      boneUniforms.uBones.value = boneTexture;
      scene.add(mesh);
      updateBoneTransforms();
      recolorTree();
      fitCamera();
    }

    // Repaints every tree voxel after a color change.
    function recolorTree() {
      if (!tree) return;
      tree.voxels.forEach((v, i) => tree.mesh.setColorAt(i, voxelColor(v, scratchColor)));
      tree.mesh.instanceColor.needsUpdate = true;
    }

    // Walks the bones from the root outwards (parents always come before
    // their children), turns each bone's local bend into a world rotation and
    // offset, and uploads the result to the bone texture for the shader.
    const bendRotation = new Quat();
    const scratchVec = new Vec3();
    function updateBoneTransforms() {
      const { bones, boneData, boneTexture, boneCount } = tree;
      for (let i = 0; i < boneCount; i++) {
        const bone = bones[i];
        if (bone.parent < 0) {
          bone.rotation.identity();
          bone.offset.set(0, 0, 0);
        } else {
          const parent = bones[bone.parent];
          const angle = bone.bend.length();
          if (angle > 1e-6) bendRotation.setFromAxisAngle(scratchVec.copy(bone.bend).divideScalar(angle), angle);
          else bendRotation.identity();
          bone.rotation.multiplyQuaternions(parent.rotation, bendRotation);
          // Keep the pivot attached to the parent: where the parent moves the
          // pivot, minus where this bone's own rotation would move it.
          bone.offset.copy(bone.pivot).applyQuaternion(parent.rotation).add(parent.offset)
            .sub(scratchVec.copy(bone.pivot).applyQuaternion(bone.rotation));
        }
        const o = i * 8;
        boneData[o] = bone.rotation.x;
        boneData[o + 1] = bone.rotation.y;
        boneData[o + 2] = bone.rotation.z;
        boneData[o + 3] = bone.rotation.w;
        boneData[o + 4] = bone.offset.x;
        boneData[o + 5] = bone.offset.y;
        boneData[o + 6] = bone.offset.z;
      }
      boneTexture.needsUpdate = true;
    }

    // Where a tree voxel currently is in the world, after its bone has moved.
    function voxelWorldPosition(voxel, out) {
      const bone = tree.bones[voxel.bone];
      return out.set(voxel.x, voxel.y, voxel.z).applyQuaternion(bone.rotation).add(bone.offset);
    }

    // ------------------------------------------------------------------------
    // Camera framing
    // ------------------------------------------------------------------------

    // Resizes the renderer and picks a camera distance and target so the
    // tree, house and cenote all fit on screen. With the overlay on a narrow
    // screen, the scene shifts right to make room for the projects panel.
    function fitCamera() {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height || !tree) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const tanHalfFov = Math.tan(toRad(camera.fov / 2));
      const narrow = overlayOn && camera.aspect < 1.9;
      const cenoteReach = cenote ? cenote.radius * 1.2 + 4 : 0;
      const house = houseLayout;
      const minX = Math.min(
        -tree.maxR,
        house.on ? house.x - (house.width / 2 + 7) * house.scale : 0,
        cenote ? cenote.x - cenoteReach : 0
      );
      const maxX = Math.max(
        tree.maxR,
        house.on ? house.x + (house.width / 2 + 2) * house.scale : 0,
        cenote ? cenote.x + cenoteReach : 0
      );

      const centerX = Math.round((minX + maxX) / 2);
      if (centerX !== horizon.centerX) {
        horizon.centerX = centerX;
        if (isIsland()) buildGroundShapes();
      }

      // Vertically: from the top of the tree down past the island, far
      // enough to show the rock hanging below it.
      const bottom = -undersideDepth * 0.6;
      const spanY = tree.maxY - bottom;
      const spanX = (maxX - minX) * (narrow ? 1.55 : 1.2);
      cameraDistance = Math.max(spanY * 1.35 / (2 * tanHalfFov), spanX / (2 * tanHalfFov * camera.aspect));
      cameraTarget.set(
        (minX + maxX) / 2 + (narrow ? -cameraDistance * tanHalfFov * camera.aspect * 0.22 : 0),
        bottom + spanY * 0.52,
        0
      );
    }
    const resizeObserver = new ResizeObserver(fitCamera);
    resizeObserver.observe(host);

    // ------------------------------------------------------------------------
    // Falling leaves
    //
    // A fixed pool of leaf cubes. Inactive ones are scaled to zero.
    // ------------------------------------------------------------------------
    const LEAF_POOL_SIZE = 200;
    const leafMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 0.16, 0.6), new THREE.MeshLambertMaterial(), LEAF_POOL_SIZE);
    leafMesh.castShadow = true;
    leafMesh.frustumCulled = false;
    const fallingLeaves = [];
    const leafDummy = new THREE.Object3D(); // helper for building instance matrices
    for (let i = 0; i < LEAF_POOL_SIZE; i++) {
      fallingLeaves.push({
        active: false,
        position: new Vec3(),
        velocity: new Vec3(),
        rotation: new THREE.Euler(),
        spin: new Vec3(),
        timeOnGround: 0, // 0 while falling
        phase: 0,
        voxel: null      // the tree voxel it came from, for its color
      });
      leafDummy.scale.set(0, 0, 0);
      leafDummy.updateMatrix();
      leafMesh.setMatrixAt(i, leafDummy.matrix);
      leafMesh.setColorAt(i, scratchColor.set('#ffffff'));
    }
    scene.add(leafMesh);
    let nextLeafSlot = 0;

    // Detaches a copy of a leaf voxel from the tree and starts it falling.
    // Does nothing if every leaf in the pool is already in the air.
    function spawnFallingLeaf(voxel) {
      for (let k = 0; k < LEAF_POOL_SIZE; k++) {
        const i = (nextLeafSlot + k) % LEAF_POOL_SIZE;
        const leaf = fallingLeaves[i];
        if (leaf.active) continue;
        nextLeafSlot = i + 1;
        leaf.active = true;
        leaf.voxel = voxel;
        voxelWorldPosition(voxel, leaf.position);
        leaf.velocity.set(0, -0.5, 0);
        leaf.timeOnGround = 0;
        leaf.phase = Math.random() * 6.28;
        leaf.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        leaf.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
        leafMesh.setColorAt(i, voxelColor(voxel, scratchColor));
        leafMesh.instanceColor.needsUpdate = true;
        return;
      }
    }

    // Repaints leaves already on their way down after a color change.
    function recolorFallingLeaves() {
      fallingLeaves.forEach((leaf, i) => {
        if (leaf.voxel) leafMesh.setColorAt(i, voxelColor(leaf.voxel, scratchColor));
      });
      leafMesh.instanceColor.needsUpdate = true;
    }

    // ------------------------------------------------------------------------
    // Birds
    //
    // Each bird is a few flat triangles: a body, two wings that flap, and a
    // keel. The birdShape setting morphs the outline from a paper plane (0)
    // to a bird with a tail (1).
    // ------------------------------------------------------------------------
    const BIRD_SHADES = [1, 0.93, 0.86, 0.78]; // birds get slightly different tones
    const birdMaterials = BIRD_SHADES.map(() => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true }));

    // Right wing outlines as (x, y, z) points, plus the center they fan from.
    const PLANE_WING = [[0, 0, 0.95], [0.32, 0.02, 0.43], [0.63, 0.04, -0.1], [0.95, 0.06, -0.62], [0.47, 0.03, -0.585], [0, 0, -0.55]];
    const PLANE_WING_CENTER = [0.32, 0.02, -0.07];
    const BIRD_WING = [[0, 0, 0.3], [0.55, 0.05, 0.42], [1.0, 0.08, 0.15], [1.55, 0.1, -0.3], [0.75, 0.05, -0.12], [0, 0, -0.25]];
    const BIRD_WING_CENTER = [0.45, 0.04, 0.05];
    const BIRD_BODY = [[0, 0, 0.95], [0.13, 0, 0.62], [0.16, 0, 0.2], [0.1, 0, -0.35], [0.3, 0, -0.85], [0, 0, -0.72], [-0.3, 0, -0.85], [-0.1, 0, -0.35], [-0.16, 0, 0.2], [-0.13, 0, 0.62]];

    // Turns an outline into a triangle fan around `center` (flat positions).
    function triangleFan(center, points, closed) {
      const positions = [];
      const count = closed ? points.length : points.length - 1;
      for (let k = 0; k < count; k++) positions.push(...center, ...points[k], ...points[(k + 1) % points.length]);
      return positions;
    }

    const rightWingGeometry = new THREE.BufferGeometry();
    const leftWingGeometry = new THREE.BufferGeometry();
    const keelGeometry = new THREE.BufferGeometry();
    keelGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.95, 0, -0.24, -0.45, 0, 0, -0.55], 3));
    keelGeometry.computeVertexNormals();
    const bodyGeometry = new THREE.BufferGeometry();
    bodyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(triangleFan([0, 0, 0], BIRD_BODY, true), 3));
    bodyGeometry.computeVertexNormals();

    let birdShape = -1; // last applied CONFIG.birdShape

    // Rebuilds the shared wing geometry for a shape between paper plane (0)
    // and bird (1); the keel shrinks away as the body grows in.
    function setBirdShape(shape) {
      const lerp = (a, b) => a.map((value, i) => value + (b[i] - value) * shape);
      const wing = PLANE_WING.map((point, i) => lerp(point, BIRD_WING[i]));
      const center = lerp(PLANE_WING_CENTER, BIRD_WING_CENTER);
      const right = triangleFan(center, wing, true);
      const left = right.slice();
      for (let i = 0; i < left.length; i += 3) left[i] = -left[i]; // mirror x
      rightWingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(right, 3));
      rightWingGeometry.computeVertexNormals();
      leftWingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(left, 3));
      leftWingGeometry.computeVertexNormals();
      for (const bird of birds) applyBodyShape(bird, shape);
    }

    // Scales a bird's keel and body for the current shape.
    function applyBodyShape(bird, shape) {
      bird.keel.scale.set(1, Math.max(0.001, 1 - shape), 1);
      bird.body.scale.setScalar(Math.max(0.001, shape));
      bird.body.visible = shape > 0.01;
      bird.keel.visible = shape < 0.99;
    }

    const birds = [];
    const flockTargets = [new Vec3(), new Vec3(), new Vec3()]; // each of the 3 flocks circles its own point
    let birdScale = 1.8;

    // Creates bird number i, adds it to the scene and returns its state.
    function makeBird(i) {
      const group = new THREE.Group();
      const material = birdMaterials[i % birdMaterials.length];
      const keel = new THREE.Mesh(keelGeometry, material);
      const body = new THREE.Mesh(bodyGeometry, material);
      const leftWing = new THREE.Group();
      const rightWing = new THREE.Group();
      const leftWingMesh = new THREE.Mesh(leftWingGeometry, material);
      const rightWingMesh = new THREE.Mesh(rightWingGeometry, material);
      for (const part of [keel, body, leftWingMesh, rightWingMesh]) part.castShadow = true;
      leftWing.add(leftWingMesh);
      rightWing.add(rightWingMesh);
      group.add(keel, body, leftWing, rightWing);
      scene.add(group);

      // Psychedelic mode overlay: separation and neighbor radius rings.
      const separationRing = new THREE.LineLoop(ringGeometry, separationRingMaterial);
      const neighborRing = new THREE.LineLoop(ringGeometry, neighborRingMaterial);
      separationRing.visible = neighborRing.visible = false;
      scene.add(separationRing, neighborRing);

      const bird = {
        group, keel, body, leftWing, rightWing,
        flock: i % 3,
        position: new Vec3(),
        velocity: new Vec3(),
        state: 'flying',   // flying | landing | perched
        perch: null,
        perchTimer: 0,     // seconds left before a perched bird takes off on its own
        perchCooldown: 0,  // seconds before a flying bird may look for a perch
        panic: 0,          // seconds of startled, faster flight left
        flapPhase: Math.random() * 6,
        yaw: 0,
        targetYaw: 0,
        peck: 0,           // seconds left of a pecking animation
        separationRing,
        neighborRing
      };
      applyBodyShape(bird, Math.max(0, birdShape));
      return bird;
    }

    // Returns a random free perch, or null after a few unlucky tries.
    function findFreePerch() {
      const perches = tree.perches;
      for (let k = 0; k < 8; k++) {
        const perch = perches[Math.floor(Math.random() * perches.length)];
        if (perch && !perch.bird) return perch;
      }
      return null;
    }

    // Where a bird stands on a perch (just above the branch voxel).
    function perchPosition(perch, out) {
      voxelWorldPosition(perch.voxel, out);
      out.y += 0.75 * birdScale / 1.8;
      return out;
    }

    // Lands a bird on a perch for a random while.
    function sitOnPerch(bird, perch) {
      bird.state = 'perched';
      bird.perch = perch;
      perch.bird = bird;
      bird.perchTimer = 8 + Math.random() * 18;
      bird.yaw = bird.targetYaw = Math.random() * 6.28;
      bird.velocity.set(0, 0, 0);
    }

    // Launches a bird off its perch. Startled birds flee faster and stay
    // away longer.
    function takeOff(bird, startled) {
      if (bird.perch) bird.perch.bird = null;
      bird.perch = null;
      bird.state = 'flying';
      const angle = Math.random() * 6.28;
      bird.velocity.set(Math.cos(angle) * 7, 8 + Math.random() * 4, Math.sin(angle) * 7);
      bird.perchCooldown = (startled ? 9 : 5) + Math.random() * 8;
      bird.panic = startled ? 2.5 : 0;
    }

    // Adds or removes birds to match the count. About half the new birds
    // start on a perch, the rest somewhere in the sky.
    function setBirdCount(count) {
      count = Math.max(0, Math.min(150, Math.round(count)));
      while (birds.length > count) {
        const bird = birds.pop();
        if (bird.perch) bird.perch.bird = null;
        scene.remove(bird.group, bird.separationRing, bird.neighborRing);
      }
      while (birds.length < count) {
        const bird = makeBird(birds.length);
        const perch = Math.random() < 0.45 ? findFreePerch() : null;
        if (perch) {
          sitOnPerch(bird, perch);
          perchPosition(perch, bird.position);
        } else {
          bird.position.set((Math.random() - 0.5) * 80, 30 + Math.random() * 40, (Math.random() - 0.5) * 40);
          bird.velocity.set(Math.random() - 0.5, 0, Math.random() - 0.5).setLength(9);
          bird.perchCooldown = Math.random() * 6;
        }
        birds.push(bird);
      }
    }
    let birdCount = -1; // last applied CONFIG.birdCount

    // ------------------------------------------------------------------------
    // Off-grid house
    // ------------------------------------------------------------------------
    let houseMesh = null;

    // Builds the house from voxels: stilts, a deck, walls with a door and
    // windows, a gable roof with solar panels, a vent pipe and a water tank.
    function buildHouse(house) {
      if (houseMesh) {
        scene.remove(houseMesh);
        houseMesh.dispose();
        houseMesh = null;
      }
      if (!house.on) return;

      const cells = new Map();
      const place = (x, y, z, color) => cells.set(x + ',' + y + ',' + z, { x, y, z, color });
      const W = house.width;
      const middle = Math.round(W / 2);

      // Stilts and deck.
      for (const [x, z] of [[0, 0], [W, 0], [0, 8], [W, 8], [middle, 0], [middle, 8], [0, 11], [W, 11]]) place(x, 0, z, house.deck);
      for (let x = -1; x <= W + 1; x++) for (let z = -1; z <= 11; z++) place(x, 1, z, house.deck);

      // Walls, with a door and a row of windows at the front (z = 8) and a
      // window on each side.
      for (let y = 2; y <= 6; y++) {
        for (let x = 0; x <= W; x++) {
          for (let z = 0; z <= 8; z++) {
            if (!(x === 0 || x === W || z === 0 || z === 8)) continue; // walls only, hollow inside
            let color = house.wall;
            if (z === 8 && x >= 2 && x <= 3 && y <= 4) color = house.door;
            else if (z === 8 && x >= 6 && x <= W - 2 && (x - 6) % 5 < 4 && y >= 4 && y <= 5) color = house.window;
            else if ((x === 0 || x === W) && z >= 3 && z <= 5 && y >= 4 && y <= 5) color = house.window;
            place(x, y, z, color);
          }
        }
      }

      // Gable roof: two slopes stepping inwards, with the gable walls filled in.
      for (let k = 0; k <= 5; k++) {
        const y = 7 + k;
        const frontZ = 9 - k;
        const backZ = -1 + k;
        for (let x = -1; x <= W + 1; x++) {
          place(x, y, frontZ, house.roof);
          place(x, y, backZ, house.roof);
        }
        for (let z = backZ + 1; z <= frontZ - 1; z++) {
          place(0, y, z, house.wall);
          place(W, y, z, house.wall);
        }
      }

      // Solar panels on the front slope, with a frame grid.
      for (let k = 1; k <= 4; k++) {
        for (let x = 1; x <= W - 1; x++) {
          const isFrame = (k === 1 || k === 4 || (x - 1) % 3 === 0) && x !== 1 && x !== W - 1;
          place(x, 8 + k, 9 - k, isFrame ? house.frame : house.panel);
        }
      }

      // Vent pipe through the back of the roof.
      for (let y = 10; y <= 14; y++) place(W - 2, y, 2, house.pipe);

      // Round rainwater tank beside the house, with a rim on top.
      for (let y = 1; y <= 4; y++) {
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            if (dx * dx + dz * dz <= 2.6) place(-4 + dx, y, 6 + dz, y === 4 ? house.frame : house.tank);
          }
        }
      }

      const list = [...cells.values()];
      houseMesh = new THREE.InstancedMesh(cubeGeometry, new THREE.MeshLambertMaterial(), list.length);
      const matrix = new THREE.Matrix4();
      list.forEach((cell, i) => {
        matrix.makeTranslation(cell.x, cell.y, cell.z);
        houseMesh.setMatrixAt(i, matrix);
        houseMesh.setColorAt(i, scratchColor.set(cell.color).multiplyScalar(0.93 + Math.random() * 0.1));
      });
      houseMesh.castShadow = true;
      houseMesh.receiveShadow = true;
      houseMesh.scale.setScalar(house.scale);
      // Center the house on (x, z) and rest the stilts on the ground.
      houseMesh.position.set(house.x - W / 2 * house.scale, -0.5 + 0.5 * house.scale, house.z - 4.5 * house.scale);
      scene.add(houseMesh);
    }

    // ------------------------------------------------------------------------
    // Cloud
    // ------------------------------------------------------------------------
    let cloudMesh = null;
    let cloudX = -60; // offset from the diorama's center; drifts right, then wraps around

    // Builds a voxel cloud from a few overlapping ellipsoid blobs.
    function buildCloud(cloud) {
      if (cloudMesh) {
        scene.remove(cloudMesh);
        cloudMesh.dispose();
        cloudMesh = null;
      }
      if (!cloud.on) return;

      const random = seededRandom(21);
      // Each blob: center x, y, z and radii x, y, z.
      const blobs = [[0, 0, 0, 6, 3.2, 4], [5, 1, 0, 5, 3.4, 3.5], [-6, -0.5, 1, 4.5, 2.6, 3], [10, -0.6, 0, 3.6, 2.1, 3], [-10.5, -1, 0, 3, 1.8, 2.5]];
      const cells = [];
      for (let x = -14; x <= 14; x++) {
        for (let y = -2; y <= 5; y++) {
          for (let z = -4; z <= 4; z++) {
            let inside = false;
            for (const [bx, by, bz, rx, ry, rz] of blobs) {
              // The random shrink roughens the edges.
              if (((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 + ((z - bz) / rz) ** 2 <= 1 - random() * 0.12) {
                inside = true;
                break;
              }
            }
            if (inside) cells.push([x, y, z]);
          }
        }
      }

      cloudMesh = new THREE.InstancedMesh(
        cubeGeometry,
        new THREE.MeshLambertMaterial({ color: cloud.color, emissive: cloud.color, emissiveIntensity: cloud.glow }),
        cells.length
      );
      const matrix = new THREE.Matrix4();
      cells.forEach((cell, i) => {
        matrix.makeTranslation(cell[0], cell[1], cell[2]);
        cloudMesh.setMatrixAt(i, matrix);
        // Slightly brighter on top.
        cloudMesh.setColorAt(i, scratchColor.setScalar(0.94 + random() * 0.06 + (cell[1] > 2 ? 0.03 : 0)));
      });
      cloudMesh.castShadow = true;
      cloudMesh.receiveShadow = true;
      cloudMesh.frustumCulled = false;
      cloudMesh.scale.setScalar(2 * cloud.size);
      scene.add(cloudMesh);
    }

    // ------------------------------------------------------------------------
    // Cenote
    // ------------------------------------------------------------------------
    let cenoteMesh = null;
    let cenoteWater = null;
    let cenote = null; // { x, z, radius, waterY } while the cenote is shown

    // Radius of the cenote's wobbly rim in the direction of `angle`.
    function cenoteRadius(c, angle) {
      return c.radius * (1 + 0.12 * Math.sin(3 * angle + 1) + 0.08 * Math.sin(5 * angle + 2));
    }

    // Whether a point on the ground lies over the cenote's opening.
    function isOverCenote(x, z) {
      if (!cenote) return false;
      const dx = x - cenote.x;
      const dz = z - cenote.z;
      return Math.hypot(dx, dz) < cenoteRadius(cenote, Math.atan2(dz, dx)) + 0.5;
    }

    // Rebuilds the sand surface and shadow catcher outlines: the floating
    // rock's outline, a rectangle for the diorama block, or a huge disc for
    // the open plains, with a hole for the cenote.
    function buildGroundShapes() {
      const rockOutline = () => {
        const shape = new THREE.Shape();
        for (let i = 0; i < 180; i++) {
          const angle = i / 180 * Math.PI * 2;
          const radius = islandRadius(angle);
          const px = horizon.centerX + Math.cos(angle) * radius;
          const py = -Math.sin(angle) * radius; // world z maps to -y, see below
          if (i) shape.lineTo(px, py);
          else shape.moveTo(px, py);
        }
        shape.closePath();
        return shape;
      };
      const rectangle = (x0, x1, y0, y1) => {
        const shape = new THREE.Shape();
        shape.moveTo(x0, y0);
        shape.lineTo(x1, y0);
        shape.lineTo(x1, y1);
        shape.lineTo(x0, y1);
        shape.closePath();
        return shape;
      };

      let surfaceShape;
      let shadowShape;
      if (horizon.mode === 'Floating rock') {
        surfaceShape = rockOutline();
        shadowShape = rockOutline();
      } else if (horizon.mode === 'Diorama block') {
        const x0 = horizon.centerX - horizon.width / 2;
        const x1 = horizon.centerX + horizon.width / 2;
        surfaceShape = rectangle(x0, x1, -horizon.depth / 2, horizon.depth / 2);
        shadowShape = rectangle(x0, x1, -horizon.depth / 2, horizon.depth / 2);
      } else {
        surfaceShape = new THREE.Shape();
        surfaceShape.absarc(0, 0, 430, 0, Math.PI * 2, false);
        shadowShape = rectangle(-400, 400, -400, 400);
      }

      if (cenote) {
        for (const shape of [surfaceShape, shadowShape]) {
          const hole = new THREE.Path();
          for (let i = 0; i < 96; i++) {
            const angle = i / 96 * Math.PI * 2;
            const radius = cenoteRadius(cenote, angle) + 1.5;
            const px = cenote.x + Math.cos(angle) * radius;
            // Shapes are drawn in the XY plane and rotated flat, so the
            // world z axis maps to -y here.
            const py = -(cenote.z + Math.sin(angle) * radius);
            if (i) hole.lineTo(px, py);
            else hole.moveTo(px, py);
          }
          hole.closePath();
          shape.holes.push(hole);
        }
      }

      groundSurface.geometry.dispose();
      groundSurface.geometry = new THREE.ShapeGeometry(surfaceShape, 64);
      shadowCatcher.geometry.dispose();
      shadowCatcher.geometry = new THREE.ShapeGeometry(shadowShape);
    }

    // Builds the cenote: a ring of layered limestone walls going down, a dark
    // floor, a few rock pillars, hanging plants, and a glowing water surface.
    function buildCenote(settings) {
      if (cenoteMesh) {
        scene.remove(cenoteMesh);
        cenoteMesh.dispose();
        cenoteMesh = null;
      }
      if (cenoteWater) {
        scene.remove(cenoteWater);
        cenoteWater.geometry.dispose();
        cenoteWater.material.dispose();
        cenoteWater = null;
      }
      cenote = settings.on ? { x: Math.round(settings.x), z: Math.round(settings.z), radius: 7 * settings.size } : null;
      buildGroundShapes();
      if (!cenote) return;

      const random = seededRandom(33);
      const cells = []; // [x, y, z, color, shade] relative to the cenote center
      const depth = Math.max(4, Math.round(settings.depth));
      const waterY = -Math.max(1, Math.min(depth - 1, Math.round(settings.level)));
      const extent = Math.ceil(cenote.radius * 1.2 + 4);
      cenote.waterY = waterY + 0.3;

      const rock = new THREE.Color(settings.rock);
      const floorColor = new THREE.Color(settings.water).multiplyScalar(0.45);
      const leafColor = palette.leaf.clone();
      const tipColor = palette.tip.clone();

      for (let x = -extent; x <= extent; x++) {
        for (let z = -extent; z <= extent; z++) {
          const distance = Math.hypot(x, z);
          const rim = cenoteRadius(cenote, Math.atan2(z, x));
          if (distance >= rim && distance < rim + 3.5) {
            // Wall column, with a lighter band every third layer and a lighter top.
            for (let y = -depth; y <= 0; y++) {
              cells.push([x, y, z, rock, 0.8 + ((y + 40) % 3 === 0 ? 0.08 : 0) + random() * 0.1 + (y === 0 ? 0.08 : 0)]);
            }
            // Loose rocks and plants on the back rim.
            if (z < 0 && distance < rim + 2.2 && random() < 0.35) {
              cells.push([x, 1, z, rock, 0.95 + random() * 0.07]);
              if (random() < 0.3) cells.push([x, 2, z, random() < 0.5 ? leafColor : tipColor, 0.9 + random() * 0.1]);
            } else if (z < 0 && random() < 0.12) {
              cells.push([x, 1, z, leafColor, 0.9 + random() * 0.12]);
            }
          } else if (distance < rim) {
            cells.push([x, -depth, z, floorColor, 0.9 + random() * 0.2]);
            // Plants hanging down the inside of the wall.
            if (distance > rim - 1 && random() < 0.18) {
              const length = 1 + Math.floor(random() * depth * 0.5);
              for (let y = 0; y > -length; y--) cells.push([x, y, z, random() < 0.3 ? tipColor : leafColor, 0.85 + random() * 0.15]);
            }
          }
        }
      }

      // Three 2x2 rock pillars rising from the floor to the waterline.
      for (let k = 0; k < 3; k++) {
        const angle = random() * 6.28;
        const distance = random() * cenote.radius * 0.55;
        const px = Math.round(Math.cos(angle) * distance);
        const pz = Math.round(Math.sin(angle) * distance);
        for (let y = -depth + 1; y <= waterY; y++) {
          for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            if (y < waterY || ox + oz < 2) cells.push([px + ox, y, pz + oz, rock, 0.72 + random() * 0.15]);
          }
        }
      }

      cenoteMesh = new THREE.InstancedMesh(cubeGeometry, new THREE.MeshLambertMaterial(), cells.length);
      const matrix = new THREE.Matrix4();
      cells.forEach((cell, i) => {
        matrix.makeTranslation(cell[0], cell[1], cell[2]);
        cenoteMesh.setMatrixAt(i, matrix);
        cenoteMesh.setColorAt(i, scratchColor.copy(cell[3]).multiplyScalar(cell[4]));
      });
      cenoteMesh.castShadow = true;
      cenoteMesh.receiveShadow = true;
      cenoteMesh.position.set(cenote.x, 0, cenote.z);

      const waterGeometry = new THREE.CircleGeometry(cenote.radius * 1.2 + 1.5, 48);
      waterGeometry.rotateX(-Math.PI / 2);
      cenoteWater = new THREE.Mesh(waterGeometry, new THREE.MeshPhongMaterial({
        color: settings.water,
        emissive: settings.water,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: settings.opacity,
        shininess: 90,
        specular: 0xffffff,
        depthWrite: false
      }));
      cenoteWater.position.set(cenote.x, cenote.waterY, cenote.z);
      cenoteWater.receiveShadow = true;
      scene.add(cenoteMesh, cenoteWater);
    }

    // ------------------------------------------------------------------------
    // Rocks and bushes
    // ------------------------------------------------------------------------
    let rockMesh = null;
    let bushMesh = null;
    let scatterObstacles = []; // [x, z, radius] of each rock and bush, for the capybara

    // Scatters rocks and bushes across the ground, keeping clear of the
    // tree, the house, the cenote and each other.
    function buildScatter(settings) {
      for (const mesh of [rockMesh, bushMesh]) {
        if (mesh) {
          scene.remove(mesh);
          mesh.dispose();
        }
      }
      rockMesh = bushMesh = null;

      const random = seededRandom(1000 + settings.seed * 7919);
      const placed = []; // [x, z, radius] of everything placed so far
      const minX = horizon.centerX - 95;
      const maxX = horizon.centerX + 95;
      const house = houseLayout;

      // Whether a circle of radius r at (x, z) is clear of everything else.
      const isFree = (x, z, r) => {
        if (!onIsland(x, z, r + 2)) return false;
        if (Math.hypot(x, z) < 8 + r) return false; // tree
        if (house.on &&
            x > house.x - (house.width / 2 + 8) * house.scale - r && x < house.x + (house.width / 2 + 3) * house.scale + r &&
            z > house.z - 7 * house.scale - r && z < house.z + 9 * house.scale + r) return false;
        if (cenote && Math.hypot(x - cenote.x, z - cenote.z) < cenote.radius * 1.2 + 4 + r) return false;
        return placed.every(other => Math.hypot(other[0] - x, other[1] - z) > other[2] + r + 1);
      };

      // Tries random spots until one is free; returns [x, z] or null.
      const findSpot = r => {
        for (let k = 0; k < 40; k++) {
          const x = minX + random() * (maxX - minX);
          const z = -40 + random() * 82;
          if (isFree(x, z, r)) {
            placed.push([x, z, r]);
            return [Math.round(x), Math.round(z)];
          }
        }
        return null;
      };

      // Adds a rough ellipsoid of voxels centered at height cy. Voxels with
      // nothing above them get the `top` color.
      const addBlob = (out, bx, bz, rx, ry, rz, cy, color, top) => {
        const filled = new Set();
        const cells = [];
        const R = Math.ceil(Math.max(rx, rz));
        const H = Math.ceil(cy + ry);
        for (let dx = -R; dx <= R; dx++) {
          for (let dz = -R; dz <= R; dz++) {
            for (let y = 0; y <= H; y++) {
              if ((dx / rx) ** 2 + ((y - cy) / ry) ** 2 + (dz / rz) ** 2 <= 1 - random() * 0.18) {
                filled.add(dx + ',' + y + ',' + dz);
                cells.push([dx, y, dz]);
              }
            }
          }
        }
        if (!cells.length) {
          cells.push([0, 0, 0]);
          filled.add('0,0,0');
        }
        for (const [dx, y, dz] of cells) {
          const covered = filled.has(dx + ',' + (y + 1) + ',' + dz);
          out.push([bx + dx, y, bz + dz, covered ? color : top, 0.88 + random() * 0.14]);
        }
      };

      const rock = new THREE.Color(settings.rock);
      const rockTop = rock.clone().multiplyScalar(1.12);
      const bush = new THREE.Color(settings.bush);
      const bushTop = new THREE.Color(settings.bushTip);
      const rockCells = [];
      const bushCells = [];

      // A quarter of the rocks are boulders, some with a smaller rock beside.
      if (settings.rocksOn) {
        for (let k = 0; k < settings.rocks; k++) {
          const big = k < settings.rocks * 0.25;
          const r = (big ? 2.4 + random() * 2.2 : 0.6 + random() * 1.1) * settings.rockSize;
          const spot = findSpot(r);
          if (!spot) continue;
          const ry = r * (big ? 0.55 + random() * 0.3 : 0.7);
          addBlob(rockCells, spot[0], spot[1], r, ry, r * (0.7 + random() * 0.4), ry * 0.3, rock, rockTop);
          if (big && random() < 0.6) {
            addBlob(rockCells,
              spot[0] + Math.round((random() - 0.5) * r * 1.6), spot[1] + Math.round((random() - 0.5) * r * 1.6),
              r * 0.5, r * 0.4, r * 0.5, 0, rock, rockTop);
          }
        }
      }

      // About a third of the bushes are big, with two smaller lobes.
      if (settings.bushesOn) {
        for (let k = 0; k < settings.bushes; k++) {
          const big = k < settings.bushes * 0.35;
          const r = (big ? 2.6 + random() * 1.8 : 1 + random() * 1.2) * settings.bushSize;
          const spot = findSpot(r);
          if (!spot) continue;
          addBlob(bushCells, spot[0], spot[1], r, r * 0.8, r * (0.8 + random() * 0.3), r * 0.5, bush, bushTop);
          if (big) {
            for (let j = 0; j < 2; j++) {
              const angle = random() * 6.28;
              addBlob(bushCells,
                spot[0] + Math.round(Math.cos(angle) * r * 0.8), spot[1] + Math.round(Math.sin(angle) * r * 0.8),
                r * 0.6, r * 0.55, r * 0.6, r * 0.3, bush, bushTop);
            }
          }
        }
      }

      // Turns a list of [x, y, z, color, shade] cells into one instanced mesh.
      const makeMesh = cells => {
        if (!cells.length) return null;
        const mesh = new THREE.InstancedMesh(cubeGeometry, new THREE.MeshLambertMaterial(), cells.length);
        const matrix = new THREE.Matrix4();
        cells.forEach((cell, i) => {
          matrix.makeTranslation(cell[0], cell[1], cell[2]);
          mesh.setMatrixAt(i, matrix);
          mesh.setColorAt(i, scratchColor.copy(cell[3]).multiplyScalar(cell[4]));
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return mesh;
      };
      rockMesh = makeMesh(rockCells);
      bushMesh = makeMesh(bushCells);
      scatterObstacles = placed;
    }

    // ------------------------------------------------------------------------
    // Underside of the island: the floating rock and hanging vines
    // ------------------------------------------------------------------------
    let undersideMeshes = [];
    let undersideDepth = 0; // how far below the ground the underside reaches

    // Stone for the floating rock: Lambert shading with horizontal strata.
    // Each 2.5-unit band of height gets its own brightness, and the stone
    // darkens further down, so the voxel columns read as layered rock.
    const islandRockMaterial = new THREE.MeshLambertMaterial();
    islandRockMaterial.onBeforeCompile = function (shader) {
      shader.vertexShader = 'varying float vRockY;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 rockWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          rockWorld = instanceMatrix * rockWorld;
        #endif
        vRockY = (modelMatrix * rockWorld).y;`);
      shader.fragmentShader = 'varying float vRockY;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float band = fract(sin(floor(vRockY / 2.5) * 12.9898) * 43758.5453);
        diffuseColor.rgb *= (0.84 + 0.18 * band) * mix(1.0, 0.6, clamp(-vRockY / 60.0, 0.0, 1.0));`);
    };
    islandRockMaterial.customProgramCacheKey = function () { return 'island-rock'; };

    // Builds the grayscale depth map for the floating rock: a 2D matrix with
    // one gray value (0 = black .. 1 = white) per ground cell, the same size
    // as the island's ground. Brighter cells hang deeper and are drawn in a
    // lighter stone. Broad noise makes big lumps, fine noise roughens them.
    function buildIslandDepthMap(width, depth, seed) {
      const random = seededRandom(seed);
      const broad = valueNoise(width, depth, 12, random, false);
      const fine = valueNoise(width, depth, 4, random, false);
      const gray = new Float32Array(width * depth);
      for (let k = 0; k < gray.length; k++) gray[k] = Math.min(1, broad[k] * 0.7 + fine[k] * 0.4);
      return { width, depth, gray };
    }

    // Builds everything under the island. For the floating rock: one stone
    // column per ground cell, short at the rim and deepest towards the
    // middle like an upside-down mountain, made uneven by the depth map, with
    // chunky stepped spikes hanging below. For the diorama block: a bottom
    // cap. Both get vines hanging from the edge.
    function buildUnderside(settings) {
      for (const mesh of undersideMeshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material !== islandRockMaterial) mesh.material.dispose();
      }
      undersideMeshes = [];
      undersideDepth = 0;
      if (settings.mode !== 'Floating rock' && settings.mode !== 'Diorama block') return;

      const width = Math.round(horizon.width);
      const depth = Math.round(horizon.depth);
      const left = horizon.centerX - width / 2;
      const random = seededRandom(900 + settings.seed * 37);
      const stone = new THREE.Color(settings.color);
      const pieces = []; // [x, topY, z, width, height, shade]
      const spikeTips = []; // [x, y, z], where vines can hang from

      if (settings.mode === 'Diorama block') {
        // The block's open bottom, in case the camera dips below it.
        const bottomY = -0.53 - horizon.thickness;
        const cap = new THREE.Mesh(
          new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2),
          new THREE.MeshLambertMaterial({ color: new THREE.Color(settings.groundColor).multiplyScalar(0.6) })
        );
        cap.position.set(horizon.centerX, bottomY, 0);
        scene.add(cap);
        undersideMeshes.push(cap);
        undersideDepth = horizon.thickness;
      } else {
        const map = buildIslandDepthMap(width, depth, 500 + settings.seed * 131);
        const columnBottom = new Float32Array(width * depth); // 0 = outside the island
        const topY = -1; // just under the sand surface
        // Under the cenote the rock starts below its floor, so it never
        // covers the water.
        const cenoteBottom = cenote ? -Math.max(4, Math.round(settings.cenoteDepth)) - 0.6 : 0;
        for (let j = 0; j < depth; j++) {
          for (let i = 0; i < width; i++) {
            const x = left + i + 0.5;
            const z = -depth / 2 + j + 0.5;
            const dx = x - horizon.centerX;
            const edge = islandRadius(Math.atan2(z, dx));
            const r = Math.hypot(dx, z);
            if (r > edge + 0.3) continue;
            let top = topY;
            if (cenote) {
              const cx = x - cenote.x;
              const cz = z - cenote.z;
              if (Math.hypot(cx, cz) < cenoteRadius(cenote, Math.atan2(cz, cx)) + 4) top = cenoteBottom;
            }
            const gray = map.gray[j * width + i];
            // Fraction of the way from the middle (0) to the rim (1).
            const s = Math.min(1, r / edge);
            const profile = Math.pow(1 - s * s, 0.75);
            const rim = 2 + gray * 4 * settings.roughness;
            const lumpiness = Math.max(0.3, 1 - 0.5 * settings.roughness * (1 - gray));
            const bottom = topY - Math.max(1, Math.round(rim + (settings.maxDepth - rim) * profile * lumpiness));
            if (bottom >= top) continue; // fully above the cenote's floor
            columnBottom[j * width + i] = bottom;
            pieces.push([x, top, z, 1, top - bottom, 0.82 + gray * 0.28]);
            undersideDepth = Math.max(undersideDepth, -bottom);
          }
        }

        // Spikes: stepped cones, 3-5 voxels wide, hanging from deep columns.
        for (let k = 0, tries = 0; k < settings.spikes && tries < settings.spikes * 20; tries++) {
          const i = Math.floor(random() * width);
          const j = Math.floor(random() * depth);
          const bottom = columnBottom[j * width + i];
          if (-bottom < settings.maxDepth * 0.35) continue;
          k++;
          const x = left + i + 0.5;
          const z = -depth / 2 + j + 0.5;
          const baseWidth = 3 + Math.floor(random() * 3);
          const levels = 3 + Math.floor(random() * 6);
          let y = bottom;
          for (let level = 0; level < levels; level++) {
            const w = Math.max(1, Math.round(baseWidth * (1 - level / levels)));
            pieces.push([x, y, z, w, 2, 0.75 + random() * 0.2]);
            y -= 2;
          }
          spikeTips.push([x, y, z]);
          undersideDepth = Math.max(undersideDepth, -y);
        }
      }

      // Vines: chains of half-size voxels with the odd leaf sticking out.
      const vineVoxels = []; // [x, y, z, color, shade]
      function addVine(x, y, z, length, alongX) {
        const steps = Math.round(length * 2);
        let px = x;
        let pz = z;
        for (let k = 0; k < steps; k++) {
          if (random() < 0.2) {
            const nudge = (random() - 0.5) * 0.5;
            if (alongX) px += nudge;
            else pz += nudge;
          }
          const color = random() < 0.25 ? palette.tip : palette.leaf;
          vineVoxels.push([px, y - k * 0.5, pz, color, 0.85 + random() * 0.2]);
          if (k % 3 === 2 && random() < 0.6) {
            const side = random() < 0.5 ? -0.5 : 0.5;
            vineVoxels.push([px + (alongX ? side : 0), y - k * 0.5, pz + (alongX ? 0 : side), palette.leaf, 0.9 + random() * 0.15]);
          }
        }
      }

      if (settings.vinesOn) {
        const chance = settings.vineDensity * 0.5;
        const vineLength = () => settings.vineLength * (0.4 + random() * 0.6);
        const top = -0.6;
        if (settings.mode === 'Floating rock') {
          // Roughly one chance per unit of rim.
          const samples = Math.round(Math.PI * (width + depth));
          for (let i = 0; i < samples; i++) {
            const angle = i / samples * Math.PI * 2;
            const radius = islandRadius(angle) + 0.3;
            const facesFrontOrBack = Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle));
            if (random() < chance) addVine(horizon.centerX + Math.cos(angle) * radius, top, Math.sin(angle) * radius, vineLength(), facesFrontOrBack);
          }
        } else {
          for (let i = 0; i < width; i++) {
            const x = left + i + 0.5;
            if (random() < chance) addVine(x, top, depth / 2 + 0.3, vineLength(), true);   // front
            if (random() < chance) addVine(x, top, -depth / 2 - 0.3, vineLength(), true);  // back
          }
          for (let j = 0; j < depth; j++) {
            const z = -depth / 2 + j + 0.5;
            if (random() < chance) addVine(left - 0.3, top, z, vineLength(), false);         // left
            if (random() < chance) addVine(left + width + 0.3, top, z, vineLength(), false); // right
          }
        }
        for (const [x, y, z] of spikeTips) {
          if (random() < settings.vineDensity) addVine(x, y, z, 2 + random() * 4, random() < 0.5);
        }
      }

      const matrix = new THREE.Matrix4();
      const position = new Vec3();
      const scale = new Vec3();
      const noRotation = new Quat();

      if (pieces.length) {
        const mesh = new THREE.InstancedMesh(cubeGeometry.clone(), islandRockMaterial, pieces.length);
        pieces.forEach((p, i) => {
          position.set(p[0], p[1] - p[4] / 2, p[2]);
          scale.set(p[3], p[4], p[3]);
          mesh.setMatrixAt(i, matrix.compose(position, noRotation, scale));
          mesh.setColorAt(i, scratchColor.copy(stone).multiplyScalar(p[5]));
        });
        mesh.receiveShadow = true;
        scene.add(mesh);
        undersideMeshes.push(mesh);
      }

      if (vineVoxels.length) {
        const mesh = new THREE.InstancedMesh(cubeGeometry.clone(), new THREE.MeshLambertMaterial(), vineVoxels.length);
        scale.set(0.5, 0.5, 0.5);
        vineVoxels.forEach((v, i) => {
          position.set(v[0], v[1], v[2]);
          mesh.setMatrixAt(i, matrix.compose(position, noRotation, scale));
          mesh.setColorAt(i, scratchColor.copy(v[3]).multiplyScalar(v[4]));
        });
        mesh.castShadow = true;
        scene.add(mesh);
        undersideMeshes.push(mesh);
      }
    }

    // ------------------------------------------------------------------------
    // Capybara
    //
    // A small blocky capybara wanders around the island, keeping clear of the
    // tree, the house, the cenote, rocks and bushes. Every few walks it gets
    // thirsty, climbs onto the cenote's stone rim and drinks.
    // ------------------------------------------------------------------------
    const capybara = {
      group: new THREE.Group(), // at the feet; faces +z when heading is 0
      model: new THREE.Group(), // tilts forward while drinking
      head: new THREE.Group(),  // pivots at the neck
      legs: [],                 // hip pivots: front pair first, then back
      parts: [],                // meshes and materials, for disposal
      position: new Vec3(),
      heading: 0,
      state: 'idle',            // idle | walking | drinking
      target: new Vec3(),
      goingToDrink: false,
      timer: 1,                 // seconds left in the current idle or drink
      walkTime: 0,              // seconds spent on the current walk
      walkPhase: 0,             // drives the leg swing
      stride: 0,                // 0 standing .. 1 walking, eased
      walksUntilThirsty: 2,
      headYaw: 0,
      headYawTarget: 0,
      sip: 0,                   // 0 head up .. 1 drinking, eased
      nextRipple: 0,
      placed: false
    };
    capybara.group.add(capybara.model);
    scene.add(capybara.group);

    // (Re)builds the capybara out of boxes in the given fur color: a barrel
    // body, a square head with a dark snout, little ears and eyes, and four
    // legs that pivot at the hip.
    function buildCapybaraModel(color) {
      const { model, head, legs } = capybara;
      for (const part of capybara.parts) part.dispose();
      capybara.parts = [];
      model.clear();
      head.clear();
      legs.length = 0;

      const fur = new THREE.MeshLambertMaterial({ color });
      const dark = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.6) });
      const black = new THREE.MeshLambertMaterial({ color: '#1d1410' });
      capybara.parts.push(fur, dark, black);
      const box = (w, h, d, material, x, y, z, parent) => {
        const geometry = new THREE.BoxGeometry(w, h, d);
        capybara.parts.push(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        parent.add(mesh);
        return mesh;
      };

      box(1.9, 1.5, 3.2, fur, 0, 1.55, 0, model);    // body
      box(1.6, 1.2, 0.3, fur, 0, 1.5, -1.75, model); // rump
      for (const [x, z] of [[-0.6, 1.0], [0.6, 1.0], [-0.6, -1.0], [0.6, -1.0]]) {
        const hip = new THREE.Group();
        hip.position.set(x, 0.95, z);
        box(0.5, 0.95, 0.5, dark, 0, -0.475, 0, hip);
        model.add(hip);
        legs.push(hip);
      }
      head.position.set(0, 2.0, 1.5);
      box(1.3, 1.3, 1.7, fur, 0, 0.15, 0.75, head);      // head
      box(1.1, 0.8, 0.4, dark, 0, -0.1, 1.75, head);     // snout
      box(0.15, 0.2, 0.2, black, -0.66, 0.4, 1.0, head); // eyes
      box(0.15, 0.2, 0.2, black, 0.66, 0.4, 1.0, head);
      box(0.3, 0.3, 0.2, dark, -0.45, 0.9, 0.2, head);   // ears
      box(0.3, 0.3, 0.2, dark, 0.45, 0.9, 0.2, head);
      model.add(head);
    }

    // Wraps an angle into -π..π.
    function wrapAngle(angle) {
      return Math.atan2(Math.sin(angle), Math.cos(angle));
    }

    // Whether (x, z) is inside the house's footprint (tank included), grown by margin.
    function insideHouse(x, z, margin) {
      const h = houseLayout;
      return h.on &&
        x > h.x - (h.width / 2 + 8) * h.scale - margin && x < h.x + (h.width / 2 + 3) * h.scale + margin &&
        z > h.z - 7 * h.scale - margin && z < h.z + 9 * h.scale + margin;
    }

    // Whether the capybara may stand at (x, z): on the island, away from the
    // tree and its roots, the house, rocks and bushes. With allowRim it may
    // stand on the cenote's rim (never over the hole); without, it keeps clear
    // of the whole cenote.
    function capybaraCanStand(x, z, allowRim) {
      if (!onIsland(x, z, 5)) return false;
      if (Math.hypot(x, z) < 24) return false;
      if (insideHouse(x, z, 1.5)) return false;
      if (cenote) {
        const dx = x - cenote.x;
        const dz = z - cenote.z;
        const distance = Math.hypot(dx, dz);
        if (allowRim ? distance < cenoteRadius(cenote, Math.atan2(dz, dx)) + 0.8 : distance < cenote.radius * 1.2 + 5) return false;
      }
      for (const [ox, oz, r] of scatterObstacles) {
        if (Math.hypot(x - ox, z - oz) < r + 1.8) return false;
      }
      return true;
    }

    // Whether a straight walk from `from` to `to` stays on standable ground.
    function capybaraPathClear(from, to) {
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.75);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        if (!capybaraCanStand(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, true)) return false;
      }
      return true;
    }

    // Height of the ground under the capybara: the sand, or one voxel up on
    // the cenote's stone rim.
    function capybaraGroundY(x, z) {
      if (cenote) {
        const dx = x - cenote.x;
        const dz = z - cenote.z;
        const distance = Math.hypot(dx, dz);
        const rim = cenoteRadius(cenote, Math.atan2(dz, dx));
        if (distance >= rim - 0.3 && distance < rim + 3.5) return 0.5;
      }
      return -0.5;
    }

    // Picks a reachable drinking spot on the front half of the cenote's rim
    // (the back has loose rocks), preferring the side the capybara is on.
    function findDrinkSpot() {
      if (!cenote) return null;
      const here = Math.atan2(capybara.position.z - cenote.z, capybara.position.x - cenote.x);
      let best = null;
      let bestTurn = Infinity;
      for (let k = 0; k <= 12; k++) {
        const angle = Math.PI * (0.15 + 0.7 * k / 12);
        const radius = cenoteRadius(cenote, angle) + 1.2;
        const spot = new Vec3(cenote.x + Math.cos(angle) * radius, 0, cenote.z + Math.sin(angle) * radius);
        const turn = Math.abs(wrapAngle(angle - here));
        if (turn < bestTurn && capybaraCanStand(spot.x, spot.z, true) && capybaraPathClear(capybara.position, spot)) {
          best = spot;
          bestTurn = turn;
        }
      }
      return best;
    }

    // Drops the capybara on a random free spot of the island.
    function placeCapybara() {
      for (let k = 0; k < 200; k++) {
        const x = horizon.centerX + (Math.random() - 0.5) * (horizon.width - 12);
        const z = (Math.random() - 0.5) * (horizon.depth - 12);
        if (capybaraCanStand(x, z, false)) {
          capybara.position.set(x, -0.5, z);
          capybara.heading = Math.random() * Math.PI * 2;
          capybara.placed = true;
          return;
        }
      }
    }

    // Decides what the capybara does next: go for a drink when thirsty,
    // otherwise wander to a random reachable spot nearby, or rest a moment.
    function chooseCapybaraActivity() {
      const capy = capybara;
      if (capy.walksUntilThirsty <= 0) {
        const spot = findDrinkSpot();
        if (spot) {
          capy.target.copy(spot);
          capy.goingToDrink = true;
          capy.state = 'walking';
          capy.walkTime = 0;
          return;
        }
      }
      const candidate = new Vec3();
      for (let k = 0; k < 30; k++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 30;
        candidate.set(capy.position.x + Math.cos(angle) * distance, 0, capy.position.z + Math.sin(angle) * distance);
        if (capybaraCanStand(candidate.x, candidate.z, false) && capybaraPathClear(capy.position, candidate)) {
          capy.target.copy(candidate);
          capy.goingToDrink = false;
          capy.walksUntilThirsty--;
          capy.state = 'walking';
          capy.walkTime = 0;
          return;
        }
      }
      capy.state = 'idle';
      capy.timer = 1 + Math.random();
    }

    // Runs the capybara's behaviour and animation for one frame.
    function updateCapybara(t, dt) {
      const capy = capybara;
      capy.group.visible = CONFIG.showCapybara;
      if (!CONFIG.showCapybara) return;
      if (!capy.placed) placeCapybara();
      if (!capy.placed) return;
      let moving = false;

      if (capy.state === 'idle') {
        // Rest and look around.
        capy.timer -= dt;
        if (Math.random() < dt * 0.5) capy.headYawTarget = (Math.random() - 0.5) * 1.2;
        if (capy.timer <= 0) chooseCapybaraActivity();
      } else if (capy.state === 'walking') {
        // Turn towards the target (slowing down while turning) and walk.
        capy.walkTime += dt;
        capy.headYawTarget = 0;
        const dx = capy.target.x - capy.position.x;
        const dz = capy.target.z - capy.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.4 || capy.walkTime > 30) {
          if (capy.goingToDrink && distance < 0.4 && cenote) {
            capy.state = 'drinking';
            capy.timer = 5 + Math.random() * 3;
            capy.walksUntilThirsty = 2 + Math.floor(Math.random() * 3);
          } else {
            capy.state = 'idle';
            capy.timer = 1.5 + Math.random() * 3;
          }
        } else {
          const turn = wrapAngle(Math.atan2(dx, dz) - capy.heading);
          capy.heading += THREE.MathUtils.clamp(turn, -2.5 * dt, 2.5 * dt);
          const speed = CONFIG.capybaraSpeed * (Math.abs(turn) < 0.5 ? 1 : 0.25) * Math.min(1, distance / 1.5 + 0.3);
          capy.position.x += Math.sin(capy.heading) * speed * dt;
          capy.position.z += Math.cos(capy.heading) * speed * dt;
          capy.walkPhase += speed * dt * 3.2;
          moving = true;
        }
      } else if (capy.state === 'drinking') {
        // Face the water, then drink, making ripples.
        capy.headYawTarget = 0;
        if (!cenote) {
          capy.state = 'idle';
        } else {
          const turn = wrapAngle(Math.atan2(cenote.x - capy.position.x, cenote.z - capy.position.z) - capy.heading);
          capy.heading += THREE.MathUtils.clamp(turn, -2 * dt, 2 * dt);
          if (Math.abs(turn) < 0.15) {
            capy.timer -= dt;
            if (capy.sip > 0.8 && t > capy.nextRipple) {
              spawnRipple();
              capy.nextRipple = t + 0.9;
            }
          }
          if (capy.timer <= 0) {
            capy.state = 'idle';
            capy.timer = 1 + Math.random() * 2;
          }
        }
      }

      // Animation: swing diagonal leg pairs, bob while walking, lower the
      // head to drink, and step up onto the rim smoothly.
      const ease = (value, target, rate) => value + (target - value) * Math.min(1, dt * rate);
      const drinking = capy.state === 'drinking' && cenote &&
        Math.abs(wrapAngle(Math.atan2(cenote.x - capy.position.x, cenote.z - capy.position.z) - capy.heading)) < 0.15;
      capy.stride = ease(capy.stride, moving ? 1 : 0, 6);
      capy.sip = ease(capy.sip, drinking ? 1 : 0, 3);
      capy.headYaw = ease(capy.headYaw, capy.headYawTarget, 3);
      capy.legs.forEach((leg, i) => {
        const phase = i === 0 || i === 3 ? 0 : Math.PI;
        leg.rotation.x = Math.sin(capy.walkPhase + phase) * 0.6 * capy.stride;
      });
      capy.model.position.y = Math.abs(Math.sin(capy.walkPhase)) * 0.08 * capy.stride + 0.2 * capy.sip;
      capy.model.rotation.x = 0.22 * capy.sip;
      capy.head.rotation.x = 0.9 * capy.sip + Math.sin(t * 7) * 0.06 * capy.sip;
      capy.head.rotation.y = capy.headYaw;

      capy.position.y = ease(capy.position.y, capybaraGroundY(capy.position.x, capy.position.z), 10);
      capy.group.position.copy(capy.position);
      capy.group.rotation.y = capy.heading;
      capy.group.scale.setScalar(CONFIG.capybaraSize);
    }

    // Ripples on the cenote where the capybara drinks: a small pool of rings
    // that grow and fade.
    const RIPPLE_LIFETIME = 1.6;
    const rippleGeometry = new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2);
    const ripples = [];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(rippleGeometry, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      mesh.visible = false;
      scene.add(mesh);
      ripples.push({ mesh, age: RIPPLE_LIFETIME });
    }
    let nextRippleSlot = 0;
    const snoutTip = new Vec3();

    // Starts a ripple on the water just in front of the capybara's snout.
    function spawnRipple() {
      const ripple = ripples[nextRippleSlot++ % ripples.length];
      capybara.head.localToWorld(snoutTip.set(0, -0.1, 2.3));
      ripple.mesh.position.set(snoutTip.x, cenote.waterY + 0.03, snoutTip.z);
      ripple.age = 0;
    }

    function updateRipples(dt) {
      for (const ripple of ripples) {
        ripple.age += dt;
        const life = ripple.age / RIPPLE_LIFETIME;
        ripple.mesh.visible = life < 1;
        if (life >= 1) continue;
        ripple.mesh.scale.setScalar(0.3 + life * 2.5);
        ripple.mesh.material.opacity = 0.7 * (1 - life);
      }
    }

    // ------------------------------------------------------------------------
    // Diamond
    //
    // A shining diamond floats above the capybara. Hovering it swaps the
    // pointer for a big yellow arrow; clicking it starts psychedelic mode.
    // ------------------------------------------------------------------------

    // Draws a soft round glow, or a four-pointed sparkle, into a texture.
    function makeSpriteTexture(kind) {
      const size = 64;
      const c = size / 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (kind === 'glow') {
        const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.25, 'rgba(160, 240, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(120, 200, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(c, 0);
        ctx.quadraticCurveTo(c, c, size, c);
        ctx.quadraticCurveTo(c, c, c, size);
        ctx.quadraticCurveTo(c, c, 0, c);
        ctx.quadraticCurveTo(c, c, c, 0);
        ctx.fill();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    // A brilliant-cut gem: a flat-topped crown over a pointed pavilion.
    const gemMaterial = new THREE.MeshPhongMaterial({
      color: '#d8fbff',
      emissive: '#4fd2ff',
      emissiveIntensity: 0.5,
      specular: 0xffffff,
      shininess: 140,
      flatShading: true
    });
    const gem = new THREE.Group();
    const gemCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1, 0.5, 8), gemMaterial);
    gemCrown.position.y = 0.25;
    const gemPavilion = new THREE.Mesh(new THREE.ConeGeometry(1, 1.4, 8).rotateX(Math.PI), gemMaterial);
    gemPavilion.position.y = -0.7;
    gem.add(gemCrown, gemPavilion);

    const spriteMaterial = (map, color) => new THREE.SpriteMaterial({
      map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
    const diamondGlow = new THREE.Sprite(spriteMaterial(makeSpriteTexture('glow'), '#9feaff'));
    diamondGlow.scale.setScalar(5);
    const sparkleTexture = makeSpriteTexture('sparkle');
    const sparkles = [];
    for (let i = 0; i < 4; i++) sparkles.push(new THREE.Sprite(spriteMaterial(sparkleTexture, '#ffffff')));

    // Invisible, generous hit area so the small diamond is easy to point at.
    const diamondHitArea = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));

    const diamond = new THREE.Group();
    diamond.add(gem, diamondGlow, diamondHitArea, ...sparkles);
    diamond.visible = false;
    scene.add(diamond);
    let diamondHovered = false;

    // Turns the big yellow pointer on or off (styles.css: .diamond-hover).
    function setDiamondHover(on) {
      if (on === diamondHovered) return;
      diamondHovered = on;
      document.body.classList.toggle('diamond-hover', on);
    }

    // Floats the diamond above the capybara, spinning, pulsing and twinkling.
    // It hides while psychedelic mode is on.
    function updateDiamond(t, dt) {
      const show = capybara.group.visible && capybara.placed && !psychedelic.active;
      diamond.visible = show;
      if (!show) {
        setDiamondHover(false);
        return;
      }
      const capy = capybara.group.position;
      diamond.position.set(capy.x, capy.y + 3.4 * CONFIG.capybaraSize + 2.4 + Math.sin(t * 2) * 0.35, capy.z);
      const targetScale = diamondHovered ? 2.2 : 1.7;
      diamond.scale.setScalar(diamond.scale.x + (targetScale - diamond.scale.x) * Math.min(1, dt * 8));
      gem.rotation.y += dt * 1.4;
      gemMaterial.emissiveIntensity = 0.45 + 0.25 * Math.sin(t * 3) + (diamondHovered ? 0.4 : 0);
      diamondGlow.material.opacity = 0.55 + 0.25 * Math.sin(t * 3);
      sparkles.forEach((sparkle, i) => {
        const angle = t * 1.3 + i * Math.PI / 2;
        sparkle.position.set(Math.cos(angle) * 1.6, Math.sin(t * 2 + i) * 0.8 + 0.2, Math.sin(angle) * 1.6);
        const twinkle = Math.max(0, Math.sin(t * 4 + i * 1.7));
        sparkle.scale.setScalar(0.3 + twinkle * 0.6);
        sparkle.material.opacity = twinkle;
      });
    }

    // Whether the screen point (clientX, clientY) is on the diamond.
    function diamondAt(clientX, clientY) {
      if (!diamond.visible) return false;
      const rect = host.getBoundingClientRect();
      const ndc = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObject(diamondHitArea, false).length > 0;
    }

    // ------------------------------------------------------------------------
    // Psychedelic mode
    //
    // Clicking the diamond turns the scene to night for a while: dark blue and
    // purple light, twinkling stars, yellow outlines on the overlay, and every
    // bird takes to the sky showing its flocking radius. A countdown bar at
    // the top shows the time left; the tag under it ends the mode early.
    // ------------------------------------------------------------------------
    const psychedelic = {
      active: false,
      endsAt: 0,       // clock time when it ends
      amount: 0,       // 0 day .. 1 night, faded in and out over FADE seconds
      fadeFrom: 0,     // amount when the mode last switched
      switchedAt: -1e9, // clock time of that switch
      shownSeconds: -1 // last value written to the countdown label
    };
    const NIGHT = {
      skyTop: new THREE.Color('#05031f'),
      skyHorizon: new THREE.Color('#3b1478'),
      background: new THREE.Color('#160a38'),
      ground: new THREE.Color('#3a2a78'),
      plinth: new THREE.Color('#24165a'),
      sun: new THREE.Color('#9d8cff'),
      ambientSky: new THREE.Color('#6a55ff'),
      ambientGround: new THREE.Color('#1c0a3a'),
      birdGlow: new THREE.Color('#c9b8ff')
    };
    const timerElement = document.getElementById('psy-timer');
    const timerBar = document.getElementById('psy-timer-bar');
    const timerLabel = document.getElementById('psy-timer-label');

    // Stars: points spread over the whole sky sphere (below the horizon too, so
    // they show when the camera looks down past the island) that twinkle, each
    // with its own size and rhythm. They ride along with the sky dome.
    const STAR_COUNT = 1400;
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starPhases = new Float32Array(STAR_COUNT);
    const starSizes = new Float32Array(STAR_COUNT);
    {
      const random = seededRandom(4242);
      for (let i = 0; i < STAR_COUNT; i++) {
        const side = random() < 0.5 ? -1 : 1;
        const y = side * Math.pow(random(), 2.2); // denser near the horizon
        const angle = random() * Math.PI * 2;
        const ring = Math.sqrt(1 - y * y);
        starPositions[i * 3] = Math.cos(angle) * ring * 470;
        starPositions[i * 3 + 1] = y * 470;
        starPositions[i * 3 + 2] = Math.sin(angle) * ring * 470;
        starPhases[i] = random() * 6.28;
        starSizes[i] = random() < 0.1 ? 10 + random() * 8 : 3 + random() * 4;
      }
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
    starGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() }
      },
      vertexShader: [
        'attribute float aPhase;',
        'attribute float aSize;',
        'uniform float uTime;',
        'uniform float uPixelRatio;',
        'varying float vTwinkle;',
        'void main() {',
        '  vTwinkle = 0.55 + 0.45 * sin(uTime * (1.5 + aPhase) + aPhase * 10.0);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = aSize * uPixelRatio * (0.7 + 0.5 * vTwinkle);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uOpacity;',
        'varying float vTwinkle;',
        'void main() {',
        '  vec2 p = gl_PointCoord - 0.5;',
        '  float core = smoothstep(0.5, 0.0, length(p));',
        '  float rays = max(0.0, 1.0 - abs(p.x) * 10.0) * max(0.0, 1.0 - abs(p.y) * 2.0)',
        '             + max(0.0, 1.0 - abs(p.y) * 10.0) * max(0.0, 1.0 - abs(p.x) * 2.0);',
        '  float alpha = (core * core + rays * 0.6) * vTwinkle * uOpacity;',
        '  gl_FragColor = vec4(1.0, 0.95, 0.75, alpha);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.frustumCulled = false;
    stars.visible = false;
    sky.add(stars);

    // Boid overlay: two camera-facing rings per bird (separation radius, bold;
    // neighbor radius, faint).
    const ringPoints = [];
    for (let i = 0; i < 64; i++) ringPoints.push(new Vec3(Math.cos(i / 64 * Math.PI * 2), Math.sin(i / 64 * Math.PI * 2), 0));
    const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMaterial = opacity => new THREE.LineBasicMaterial({ color: '#ffe94a', transparent: true, opacity, depthWrite: false, fog: false });
    const separationRingMaterial = ringMaterial(0);
    const neighborRingMaterial = ringMaterial(0);
    let boidOverlayShown = false;

    // Starts psychedelic mode: night palette, overlay styles, countdown, and
    // every bird leaves its perch.
    function startPsychedelic() {
      psychedelic.fadeFrom = psychedelic.amount;
      psychedelic.switchedAt = clock.elapsedTime;
      psychedelic.active = true;
      psychedelic.endsAt = clock.elapsedTime + CONFIG.psychedelicDuration;
      psychedelic.shownSeconds = -1;
      setDiamondHover(false);
      document.body.classList.add('psychedelic');
      timerBar.setAttribute('aria-valuemax', String(CONFIG.psychedelicDuration));
      timerElement.hidden = false;
      for (const bird of birds) {
        if (bird.state === 'perched') {
          takeOff(bird, true);
        } else if (bird.state === 'landing') {
          if (bird.perch && bird.perch.bird === bird) bird.perch.bird = null;
          bird.perch = null;
          bird.state = 'flying';
        }
      }
    }

    window.tulumScene.startPsychedelic = startPsychedelic; // handy from the console
    timerLabel.addEventListener('click', () => { if (psychedelic.active) stopPsychedelic(); });

    function stopPsychedelic() {
      psychedelic.fadeFrom = psychedelic.amount;
      psychedelic.switchedAt = clock.elapsedTime;
      psychedelic.active = false;
      document.body.classList.remove('psychedelic');
      timerElement.hidden = true;
    }

    // Counts down, eases between day and night, and blends the night palette
    // into the lights and colors syncConfig() just set from CONFIG.
    function updatePsychedelic(t) {
      if (psychedelic.active) {
        const remaining = Math.max(0, psychedelic.endsAt - t);
        timerBar.style.transform = 'scaleX(' + remaining / CONFIG.psychedelicDuration + ')';
        const seconds = Math.ceil(remaining);
        if (seconds !== psychedelic.shownSeconds) {
          psychedelic.shownSeconds = seconds;
          timerLabel.textContent = 'Psychedelic mode · ' + seconds + 's';
          timerBar.setAttribute('aria-valuenow', String(seconds));
        }
        if (remaining <= 0) stopPsychedelic();
      }

      // Fade by elapsed time rather than frame time, so it takes the same
      // 1.5 seconds even when frames are slow.
      const goal = psychedelic.active ? 1 : 0;
      const progress = Math.min(1, (t - psychedelic.switchedAt) / 1.5);
      psychedelic.amount = psychedelic.fadeFrom + (goal - psychedelic.fadeFrom) * progress;
      const a = psychedelic.amount;

      starMaterial.uniforms.uTime.value = t;
      starMaterial.uniforms.uOpacity.value = a;
      stars.visible = a > 0.001;
      ambientLight.color.set(0xffffff).lerp(NIGHT.ambientSky, a);
      ambientLight.groundColor.set(0xdcdcdc).lerp(NIGHT.ambientGround, a);
      if (a <= 0) {
        for (const material of birdMaterials) material.emissive.setRGB(0, 0, 0);
        return;
      }

      skyUniforms.uTopColor.value.lerp(NIGHT.skyTop, a);
      skyUniforms.uHorizonColor.value.lerp(NIGHT.skyHorizon, a);
      clearColor.lerp(NIGHT.background, a);
      renderer.setClearColor(clearColor, 1);
      scene.fog.color.lerp(NIGHT.background, a);
      groundSurface.material.color.lerp(NIGHT.ground, a);
      plinth.material.color.lerp(NIGHT.plinth, a);
      sun.color.lerp(NIGHT.sun, a);
      sun.intensity += (1.2 - sun.intensity) * a;
      ambientLight.intensity += (2.2 - ambientLight.intensity) * a;
      for (const material of birdMaterials) material.emissive.copy(NIGHT.birdGlow).multiplyScalar(a);
    }

    // Keeps each bird's rings centered on it and facing the camera. They
    // fade in and out with psychedelic.amount.
    function updateBoidOverlay() {
      const a = psychedelic.amount;
      const visible = a > 0.01;
      if (!visible && !boidOverlayShown) return;
      boidOverlayShown = visible;
      separationRingMaterial.opacity = 0.95 * a;
      neighborRingMaterial.opacity = 0.22 * a;
      const neighborRadius = CONFIG.neighborRadius;
      const separationRadius = Math.max(1, neighborRadius * 0.28);
      for (const bird of birds) {
        bird.separationRing.visible = bird.neighborRing.visible = visible;
        if (!visible) continue;
        for (const [ring, radius] of [[bird.separationRing, separationRadius], [bird.neighborRing, neighborRadius]]) {
          ring.position.copy(bird.position);
          ring.quaternion.copy(camera.quaternion);
          ring.scale.setScalar(radius);
        }
      }
    }

    // ------------------------------------------------------------------------
    // Applying CONFIG
    //
    // Called every frame. Each group of settings is serialized and compared
    // with the last version, and only the parts that changed are rebuilt.
    // ------------------------------------------------------------------------
    const lastApplied = {
      tree: '', colors: '', birdColor: '', cenote: '', horizon: '', house: '', cloud: '', scatter: '',
      groundTexture: null, underside: '', capybara: ''
    };

    function syncConfig() {
      const c = CONFIG;

      // Tree shape.
      const treeSettings = {
        mainBranches: Math.max(1, Math.round(c.mainBranches)),
        branchDepth: Math.max(0, Math.min(3, Math.round(c.branchDepth))),
        fronds: Math.max(0, Math.round(c.frondsPerCluster)),
        frondLength: c.frondLength,
        frondWidth: c.frondWidth,
        clusterSize: c.leafClusterSize,
        branchStyle: c.branchStyle,
        branchSpread: c.branchSpread,
        branchThickness: c.branchThickness,
        branchLength: c.branchLength,
        branchCurl: c.branchCurl,
        forks: Math.max(1, Math.min(4, Math.round(c.branchForks))),
        lowerBranches: c.lowerBranches,
        leafStyle: c.leafStyle,
        leafArrangement: c.leafArrangement,
        leavesOnBranches: c.leavesOnBranches
      };
      const treeKey = JSON.stringify(treeSettings);

      // Tree colors. Veins are a slightly darker leaf color.
      const colorsKey = [c.barkColor, c.rootColor, c.leafColor, c.leafTipColor].join('|');
      if (colorsKey !== lastApplied.colors) {
        lastApplied.colors = colorsKey;
        palette.bark.set(c.barkColor);
        palette.root.set(c.rootColor);
        palette.leaf.set(c.leafColor);
        palette.tip.set(c.leafTipColor);
        palette.vein.copy(palette.leaf).multiplyScalar(0.88);
        recolorTree();
        recolorFallingLeaves();
      }

      // Cenote (before the tree, so the first camera fit knows about it).
      // Its plants use the leaf colors, so those are part of its key.
      const cenoteSettings = {
        on: c.showCenote,
        x: c.cenoteX,
        z: c.cenoteZ,
        size: c.cenoteSize,
        depth: c.cenoteDepth,
        level: c.cenoteWaterLevel,
        water: c.cenoteWaterColor,
        rock: c.cenoteRockColor,
        opacity: c.cenoteWaterOpacity,
        leafColors: colorsKey
      };
      const cenoteKey = JSON.stringify(cenoteSettings);
      if (cenoteKey !== lastApplied.cenote) {
        lastApplied.cenote = cenoteKey;
        buildCenote(cenoteSettings);
        fitCamera();
      }

      if (treeKey !== lastApplied.tree) {
        lastApplied.tree = treeKey;
        buildTree(treeSettings);
      }

      if (c.birdColor !== lastApplied.birdColor) {
        lastApplied.birdColor = c.birdColor;
        birdMaterials.forEach((material, i) => material.color.set(c.birdColor).multiplyScalar(BIRD_SHADES[i]));
      }

      // Sky, background and fog color.
      skyUniforms.uTopColor.value.set(c.skyTopColor);
      skyUniforms.uHorizonColor.value.set(c.skyHorizonColor);
      sky.visible = groundSurface.visible = c.showSky;
      // The sand texture darkens the ground by SAND_BRIGHTNESS on average,
      // so brighten the base color to keep CONFIG.groundColor accurate.
      const textureStrength = Math.max(0, Math.min(1, c.groundTexture));
      if (textureStrength !== lastApplied.groundTexture) {
        lastApplied.groundTexture = textureStrength;
        if (groundSurface.material.map) groundSurface.material.map.dispose();
        groundSurface.material.map = makeSandTexture(textureStrength);
        groundSurface.material.needsUpdate = true;
      }
      groundSurface.material.color.set(c.groundColor).multiplyScalar(1 / SAND_BRIGHTNESS);
      clearColor.set(c.showSky ? c.skyHorizonColor : c.backgroundColor);
      renderer.setClearColor(clearColor, 1);
      scene.fog.color.copy(clearColor);

      // Horizon and diorama block.
      const horizonSettings = {
        mode: c.horizonStyle,
        width: c.dioramaWidth,
        depth: c.dioramaDepth,
        thickness: c.dioramaThickness,
        roughness: Math.max(0, Math.min(2, c.islandRoughness)),
        seed: Math.round(c.islandSeed)
      };
      const horizonKey = JSON.stringify(horizonSettings);
      if (horizonKey !== lastApplied.horizon) {
        lastApplied.horizon = horizonKey;
        Object.assign(horizon, horizonSettings);
        buildGroundShapes();
      }
      plinth.visible = horizon.mode === 'Diorama block';
      plinth.material.color.set(c.groundColor).multiplyScalar(0.72);
      // The plinth is a 4-sided cylinder rotated 45°, so its faces sit at
      // radius / √2; scale by w / √2 to make the block exactly w wide.
      plinth.scale.set(horizon.width / Math.SQRT2, horizon.thickness, horizon.depth / Math.SQRT2);
      plinth.position.set(horizon.centerX, -0.53 - horizon.thickness / 2, 0);
      if (horizon.mode === 'Ground haze') scene.fog.color.set(c.groundColor);

      // The floating rock (or block bottom) and vines under the island. They
      // follow the island, so they rebuild when it moves or resizes, and the
      // vines use the leaf colors.
      const undersideSettings = {
        mode: horizon.mode,
        width: horizon.width,
        depth: horizon.depth,
        thickness: horizon.thickness,
        centerX: horizon.centerX,
        roughness: horizon.roughness,
        seed: horizon.seed,
        maxDepth: Math.max(4, c.islandDepth),
        cenote: cenoteKey,
        cenoteDepth: c.cenoteDepth,
        spikes: Math.max(0, Math.round(c.islandSpikes)),
        color: c.islandColor,
        groundColor: c.groundColor,
        vinesOn: c.showVines,
        vineDensity: c.vineDensity,
        vineLength: c.vineLength,
        leafColors: colorsKey
      };
      const undersideKey = JSON.stringify(undersideSettings);
      if (undersideKey !== lastApplied.underside) {
        lastApplied.underside = undersideKey;
        buildUnderside(undersideSettings);
        fitCamera();
      }

      if (c.cameraFov !== camera.fov) {
        camera.fov = c.cameraFov;
        fitCamera();
      }

      // House. Toggling the overlay changes the framing, so it re-fits too.
      const houseSettings = {
        width: Math.max(8, Math.round(c.houseWidth)),
        on: c.showHouse,
        x: c.houseX,
        z: c.houseZ,
        scale: c.houseSize,
        wall: c.houseWallColor,
        roof: c.houseRoofColor,
        panel: c.solarPanelColor,
        frame: c.solarFrameColor,
        window: c.windowColor,
        door: c.doorColor,
        deck: c.deckColor,
        pipe: '#4f5458',
        tank: c.waterTankColor
      };
      const houseKey = JSON.stringify(houseSettings);
      if (houseKey !== lastApplied.house || c.showOverlay !== overlayOn) {
        lastApplied.house = houseKey;
        overlayOn = c.showOverlay;
        Object.assign(houseLayout, { on: houseSettings.on, width: houseSettings.width, x: houseSettings.x, z: houseSettings.z, scale: houseSettings.scale });
        buildHouse(houseSettings);
        fitCamera();
      }

      // Sun position from azimuth and elevation, around the origin.
      const azimuth = toRad(c.sunAzimuth);
      const elevation = toRad(c.sunElevation);
      sun.position.set(
        Math.cos(elevation) * Math.sin(azimuth) * 140,
        Math.sin(elevation) * 140 + 20,
        Math.cos(elevation) * Math.cos(azimuth) * 140
      );
      sun.intensity = c.sunIntensity;
      sun.color.set(c.sunColor);
      ambientLight.intensity = c.ambientIntensity;

      const cloudSettings = { on: c.showCloud, size: c.cloudSize, color: c.cloudColor, glow: c.cloudGlow };
      const cloudKey = JSON.stringify(cloudSettings);
      if (cloudKey !== lastApplied.cloud) {
        lastApplied.cloud = cloudKey;
        buildCloud(cloudSettings);
      }

      // Rocks and bushes avoid the house, cenote and tree and stay on the
      // island, so they are re-scattered whenever any of those change.
      const scatterSettings = {
        rocksOn: c.showRocks,
        bushesOn: c.showBushes,
        rocks: Math.round(c.rockCount),
        bushes: Math.round(c.bushCount),
        rockSize: c.rockSize,
        bushSize: c.bushSize,
        rock: c.rockColor,
        bush: c.bushColor,
        bushTip: c.bushTipColor,
        seed: Math.round(c.scatterSeed),
        dependsOn: [houseKey, cenoteKey, horizonKey, horizon.centerX, tree.maxR]
      };
      const scatterKey = JSON.stringify(scatterSettings);
      if (scatterKey !== lastApplied.scatter) {
        lastApplied.scatter = scatterKey;
        buildScatter(scatterSettings);
      }

      shadowMaterial.opacity = c.shadowOpacity;

      const shape = Math.max(0, Math.min(1, c.birdShape));
      if (shape !== birdShape) {
        birdShape = shape;
        setBirdShape(shape);
      }
      birdScale = 1.8 * c.birdSize;

      if (c.capybaraColor !== lastApplied.capybara) {
        lastApplied.capybara = c.capybaraColor;
        buildCapybaraModel(c.capybaraColor);
      }
      if (c.birdCount !== birdCount) {
        birdCount = c.birdCount;
        setBirdCount(c.birdCount);
      }
    }
    syncConfig();

    // ------------------------------------------------------------------------
    // Pointer
    //
    // The pointer is a ray from the camera. Anything near the ray reacts:
    // branches get pushed, leaves get blown, birds get startled.
    // ------------------------------------------------------------------------
    const pointer = {
      over: false,                 // whether the pointer is over the page
      onCanvas: false,             // whether it is over the scene itself, not a panel
      ndc: new THREE.Vector2(9, 9), // position in normalized device coordinates
      world: new Vec3(),           // where the ray crosses the z = 0 plane
      lastWorld: new Vec3(),
      hasLastWorld: false,
      velocity: new Vec3(),        // how fast that crossing point moves
      speed: 0,
      cameraOffset: new THREE.Vector2() // smoothed ndc used for parallax
    };

    function onPointerMove(event) {
      const rect = host.getBoundingClientRect();
      pointer.ndc.set(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      pointer.over = true;
      // Over the overlay panels the pointer is not "in" the scene.
      pointer.onCanvas = event.target === renderer.domElement;
    }

    // relatedTarget is null when the pointer leaves the window entirely.
    function onPointerOut(event) {
      if (!event.relatedTarget) pointer.over = false;
    }

    window.addEventListener('pointermove', onPointerMove);

    // Clicking (or tapping) the diamond starts psychedelic mode.
    renderer.domElement.addEventListener('click', event => {
      if (diamondAt(event.clientX, event.clientY)) startPsychedelic();
    });
    document.addEventListener('pointerout', onPointerOut);

    const raycaster = new THREE.Raycaster();
    const pointerPlane = new THREE.Plane(new Vec3(0, 0, 1), 0);
    const ray = raycaster.ray;

    // Scales v down to at most length max (in place) and returns it.
    function clampLength(v, max) {
      const length = v.length();
      if (length > max) v.multiplyScalar(max / length);
      return v;
    }

    // ------------------------------------------------------------------------
    // Animation
    // ------------------------------------------------------------------------
    const clock = new THREE.Clock();
    const wind = { x: 0, z: 0, gust: 0 };
    const cameraLookAt = new Vec3();
    let viewDistance = 150;

    // Mouse-wheel zoom on top of CONFIG.cameraZoom: a multiplier kept within
    // a small range, eased towards the target so it feels smooth.
    const wheelZoom = { current: 1, target: 1, min: 0.8, max: 1.7 };
    renderer.domElement.addEventListener('wheel', event => {
      wheelZoom.target = THREE.MathUtils.clamp(wheelZoom.target * Math.exp(-event.deltaY * 0.0015), wheelZoom.min, wheelZoom.max);
    }, { passive: true });

    // Orbits the camera around the target with a slow drift and parallax
    // towards the pointer (gentle sideways, stronger up and down), applies
    // the mouse-wheel zoom, and sets the fog around that distance.
    function updateCamera(t, dt) {
      const c = CONFIG;
      const offset = pointer.cameraOffset;
      offset.x += ((pointer.over ? pointer.ndc.x : 0) - offset.x) * dt * 1.5;
      offset.y += ((pointer.over ? pointer.ndc.y : 0) - offset.y) * dt * 1.5;
      wheelZoom.current += (wheelZoom.target - wheelZoom.current) * Math.min(1, dt * 6);

      viewDistance = cameraDistance / Math.max(0.2, c.cameraZoom * wheelZoom.current);
      const yaw = toRad(c.cameraYaw) + Math.sin(t * 0.05) * 0.12 * c.cameraDrift + offset.x * 0.12 * c.mouseParallax;
      const pitch = THREE.MathUtils.clamp(toRad(c.cameraPitch) - offset.y * 0.16 * c.mouseParallax, toRad(-5), toRad(75));
      cameraLookAt.set(cameraTarget.x + c.cameraPanX, cameraTarget.y + c.cameraHeight, cameraTarget.z);
      camera.position.set(
        cameraLookAt.x + Math.sin(yaw) * Math.cos(pitch) * viewDistance,
        cameraLookAt.y + Math.sin(pitch) * viewDistance,
        cameraLookAt.z + Math.cos(yaw) * Math.cos(pitch) * viewDistance
      );
      camera.lookAt(cameraLookAt);
      sky.position.copy(camera.position);

      const fogScale = c.fogDistance;
      if (horizon.mode === 'Soft fog' || horizon.mode === 'Ground haze') {
        scene.fog.near = viewDistance + 60 * fogScale;
        scene.fog.far = viewDistance + 380 * fogScale;
      } else {
        scene.fog.near = 1e5;
        scene.fog.far = 2e5;
      }
    }

    // Drifts the cloud across the diorama (faster in strong wind), from its
    // left edge to its right edge, then starts over on the left. It grows in
    // as it enters and shrinks away as it leaves, and bobs gently.
    function updateCloud(t, dt) {
      if (!cloudMesh) return;
      const c = CONFIG;
      const halfWidth = horizon.width / 2;
      cloudX += c.cloudSpeed * (0.7 + 0.3 * c.windStrength) * dt;
      if (cloudX > halfWidth) cloudX = -halfWidth;
      const fromEdge = Math.min(1, (halfWidth - Math.abs(cloudX)) / 14);
      const grow = fromEdge * fromEdge * (3 - 2 * fromEdge);
      cloudMesh.scale.setScalar(Math.max(0.001, 2 * c.cloudSize * grow));
      cloudMesh.position.set(horizon.centerX + cloudX, tree.maxY + c.cloudHeight + Math.sin(t * 0.3) * 0.8, -35);
    }

    // Updates the pointer ray and how fast the pointer moves through the scene.
    function updatePointer(dt) {
      raycaster.setFromCamera(pointer.ndc, camera);
      setDiamondHover(pointer.over && pointer.onCanvas && diamond.visible &&
        raycaster.intersectObject(diamondHitArea, false).length > 0);
      if (pointer.over && ray.intersectPlane(pointerPlane, pointer.world)) {
        if (pointer.hasLastWorld) pointer.velocity.subVectors(pointer.world, pointer.lastWorld).divideScalar(Math.max(dt, 1e-3));
        else pointer.velocity.set(0, 0, 0);
        pointer.lastWorld.copy(pointer.world);
        pointer.hasLastWorld = true;
        clampLength(pointer.velocity, 80);
      } else {
        pointer.hasLastWorld = false;
        pointer.velocity.set(0, 0, 0);
      }
      pointer.speed = pointer.velocity.length();
    }

    // Steps the spring simulation of every bone. Each bone is pulled towards
    // a target bend set by the wind (plus a flutter for fronds), and gets
    // a kick when the pointer ray brushes through it. Fast swipes also
    // knock leaves loose.
    const windForce = new Vec3();
    const targetBend = new Vec3();
    const sideways = new Vec3();
    const hitPoint = new Vec3();
    const closestHit = new Vec3();
    const lever = new Vec3();
    const push = new Vec3();
    const rayPoint = new Vec3();
    const torque = new Vec3();
    const springAccel = new Vec3();

    function updateTreeBones(t, dt) {
      const { bones, boneCount } = tree;
      const windStrength = CONFIG.windStrength;
      const leafFall = CONFIG.leafFall;

      for (let i = 1; i < boneCount; i++) {
        const bone = bones[i];

        // Wind, with a per-bone flicker so the crown doesn't move as one.
        const flicker = 1 + 0.4 * Math.sin(t * (1.3 + bone.phase * 0.2) + bone.phase * 3);
        windForce.set(wind.x * flicker, 0, wind.z * flicker);
        targetBend.crossVectors(bone.direction, windForce).multiplyScalar(bone.windGain);
        if (bone.kind === 'frond') {
          sideways.crossVectors(bone.direction, UP);
          if (sideways.lengthSq() > 1e-4) {
            targetBend.addScaledVector(sideways.normalize(), Math.sin(t * (2.2 + bone.phase * 0.3) + bone.phase) * 0.05 * windStrength);
          }
        }

        // Pointer: find the bone's point closest to the ray; if it is close
        // enough, push the bone away from the ray and along the swipe.
        if (pointer.over && bone.hitPoints.length) {
          let bestDistance = 1e9;
          for (const point of bone.hitPoints) {
            hitPoint.copy(point).applyQuaternion(bone.rotation).add(bone.offset);
            const distance = ray.distanceSqToPoint(hitPoint);
            if (distance < bestDistance) {
              bestDistance = distance;
              closestHit.copy(hitPoint);
            }
          }
          const reach = bone.kind === 'frond' ? 2.6 : bone.radius + 1.2;
          if (bestDistance < reach * reach) {
            bone.lastTouched = t;
            hitPoint.copy(bone.pivot).applyQuaternion(bone.rotation).add(bone.offset);
            lever.subVectors(closestHit, hitPoint);
            ray.closestPointToPoint(closestHit, rayPoint);
            push.subVectors(closestHit, rayPoint);
            if (push.lengthSq() > 1e-6) push.normalize().multiplyScalar(7);
            push.add(pointer.velocity);
            torque.crossVectors(lever, push).multiplyScalar(bone.pushGain / (lever.lengthSq() + 1));
            bone.bendVelocity.addScaledVector(torque, dt);
            if (bone.parent > 0) bones[bone.parent].bendVelocity.addScaledVector(torque, dt * 0.15);
            if (pointer.speed > 6 && bone.leafVoxels.length && Math.random() < 8 * leafFall * dt) {
              spawnFallingLeaf(bone.leafVoxels[Math.floor(Math.random() * bone.leafVoxels.length)]);
            }
          }
        }

        // Damped spring towards the target bend.
        const dampingForce = 2 * bone.damping * Math.sqrt(bone.stiffness);
        springAccel.subVectors(targetBend, bone.bend).multiplyScalar(bone.stiffness).addScaledVector(bone.bendVelocity, -dampingForce);
        bone.bendVelocity.addScaledVector(springAccel, dt);
        bone.bend.addScaledVector(bone.bendVelocity, dt);
        if (bone.bend.length() > bone.maxBend) {
          bone.bend.setLength(bone.maxBend);
          bone.bendVelocity.multiplyScalar(0.5);
        }
      }
      updateBoneTransforms();
    }

    // Drops new leaves (more during gusts), then moves every falling leaf:
    // they flutter down with the wind, dodge the pointer, rest on the ground
    // (or float on the cenote) for ten seconds, and shrink away.
    const awayFromRay = new Vec3();
    const closestOnRay = new Vec3();

    function updateFallingLeaves(t, dt) {
      const leafFall = CONFIG.leafFall;
      const rate = (0.8 + wind.gust * 2.5) * leafFall;
      const sources = tree.fallingLeafSources;
      if (Math.random() < rate * dt && sources.length) spawnFallingLeaf(sources[Math.floor(Math.random() * sources.length)]);

      for (let i = 0; i < LEAF_POOL_SIZE; i++) {
        const leaf = fallingLeaves[i];
        if (!leaf.active) continue;

        // Blown away from the pointer ray, and lifted again if resting.
        if (pointer.over) {
          const distance = ray.distanceToPoint(leaf.position);
          if (distance < 6) {
            ray.closestPointToPoint(leaf.position, closestOnRay);
            awayFromRay.subVectors(leaf.position, closestOnRay).normalize();
            leaf.velocity.addScaledVector(awayFromRay, (1 - distance / 6) * 40 * dt);
            leaf.velocity.addScaledVector(pointer.velocity, 0.02 * (1 - distance / 6));
            if (leaf.timeOnGround > 0) {
              leaf.timeOnGround = 0;
              leaf.velocity.y += 4;
            }
          }
        }

        if (leaf.timeOnGround > 0) {
          // Resting: lie flat, then shrink away after 10 seconds.
          leaf.timeOnGround += dt;
          const scale = leaf.timeOnGround > 10 ? Math.max(0, 1 - (leaf.timeOnGround - 10) / 2) : 1;
          if (scale <= 0) leaf.active = false;
          leafDummy.position.copy(leaf.position);
          leafDummy.rotation.set(0, leaf.rotation.y, 0);
          leafDummy.scale.setScalar(scale);
        } else {
          // Falling: ease towards a swaying wind-driven velocity.
          leaf.velocity.x += ((wind.x * 2.2 + Math.sin(t * 1.7 + leaf.phase) * 1.6) - leaf.velocity.x) * dt * 1.5;
          leaf.velocity.z += ((wind.z * 2.5 + Math.cos(t * 1.3 + leaf.phase) * 1.2) - leaf.velocity.z) * dt * 1.5;
          leaf.velocity.y += ((-3.4 + Math.sin(t * 3 + leaf.phase) * 1.2) - leaf.velocity.y) * dt * 2;
          leaf.position.addScaledVector(leaf.velocity, dt);
          leaf.rotation.x += leaf.spin.x * dt;
          leaf.rotation.y += leaf.spin.y * dt;
          leaf.rotation.z += leaf.spin.z * dt;

          const groundY = isOverCenote(leaf.position.x, leaf.position.z) ? cenote.waterY + 0.08 : -0.42;
          if (leaf.position.y < groundY) {
            leaf.position.y = groundY;
            leaf.velocity.set(0, 0, 0);
            leaf.timeOnGround = 0.001;
          }
          if (Math.abs(leaf.position.x) > 160 || Math.abs(leaf.position.z) > 160) leaf.active = false;
          leafDummy.position.copy(leaf.position);
          leafDummy.rotation.copy(leaf.rotation);
          leafDummy.scale.setScalar(1);
        }
        if (!leaf.active) leafDummy.scale.setScalar(0);
        leafDummy.updateMatrix();
        leafMesh.setMatrixAt(i, leafDummy.matrix);
      }
      leafMesh.instanceMatrix.needsUpdate = true;
    }

    // Moves every bird. Perched birds look around and peck until their timer
    // runs out or something startles them (the pointer, or their branch being
    // shaken), which also scares nearby birds off. Flying birds follow the
    // classic flocking rules (separation, alignment, cohesion), circle their
    // flock's target, stay inside the scene, and every now and then pick a
    // free perch and glide in to land.
    const steer = new Vec3();
    const alignSum = new Vec3();
    const cohesionSum = new Vec3();
    const separationSum = new Vec3();
    const birdTemp = new Vec3();

    function updateBirds(t, dt) {
      const c = CONFIG;
      const { bones, maxY, maxR, trunkTop } = tree;
      const neighborRadiusSq = c.neighborRadius * c.neighborRadius;
      const separationRadiusSq = Math.max(1, (c.neighborRadius * 0.28) ** 2);
      const flapAmount = 0.55 + 0.4 * birdShape;

      for (let f = 0; f < 3; f++) {
        flockTargets[f].set(
          Math.sin(t * 0.09 + f * 2.1) * maxR * 1.3,
          maxY * 0.75 + Math.sin(t * 0.17 + f) * 14,
          Math.cos(t * 0.07 + f * 1.7) * 30
        );
      }

      let perchedCount = 0;
      for (const bird of birds) if (bird.state === 'perched') perchedCount++;

      for (const bird of birds) {
        bird.group.scale.setScalar(birdScale);
        bird.perchCooldown -= dt;
        bird.panic -= dt;

        if (bird.state === 'perched') {
          perchPosition(bird.perch, bird.position); // the branch may be swaying
          bird.perchTimer -= dt;
          const perchBone = bones[bird.perch.voxel.bone];
          const shaken =
            perchBone.bendVelocity.length() + (perchBone.parent > 0 ? bones[perchBone.parent].bendVelocity.length() : 0) > 0.45 ||
            (perchBone.lastTouched && t - perchBone.lastTouched < 0.1 && pointer.speed > 10);
          const pointerNear = pointer.over && ray.distanceToPoint(bird.position) < 5;

          if (pointerNear || shaken) {
            takeOff(bird, true);
            for (const other of birds) {
              if (other.state === 'perched' && other.position.distanceTo(bird.position) < 10 && Math.random() < 0.7) takeOff(other, true);
            }
          } else if (bird.perchTimer <= 0) {
            takeOff(bird, false);
          } else {
            // Idle: turn the head now and then, and peck.
            if (Math.random() < dt * 0.3) bird.targetYaw = bird.yaw + (Math.random() - 0.5) * 2.5;
            bird.yaw += (bird.targetYaw - bird.yaw) * Math.min(1, dt * 8);
            if (bird.peck <= 0 && Math.random() < dt * 0.25) bird.peck = 0.6;
            bird.peck -= dt;
            bird.group.position.copy(bird.position);
            bird.group.rotation.set(bird.peck > 0 ? Math.sin(bird.peck / 0.6 * Math.PI) * 0.4 : 0, bird.yaw, 0);
            bird.leftWing.rotation.z = 0.5; // wings folded
            bird.rightWing.rotation.z = -0.5;
            continue;
          }
        }

        steer.set(0, 0, 0);
        const maxSpeed = bird.panic > 0 ? c.maxSpeed * 1.55 : c.maxSpeed;
        const maxForce = bird.panic > 0 ? 26 : 12;
        const minSpeed = Math.min(6, c.maxSpeed * 0.5);

        if (bird.state === 'landing') {
          if (bird.perch.bird !== bird || bird.panic > 0 || psychedelic.active) {
            // Perch got taken, or the bird got scared: abort.
            bird.state = 'flying';
            if (bird.perch.bird === bird) bird.perch.bird = null;
            bird.perch = null;
          } else {
            // Steer to the perch, slowing down on approach.
            const perchAt = perchPosition(bird.perch, alignSum);
            const toPerch = cohesionSum.subVectors(perchAt, bird.position);
            const distance = toPerch.length();
            if (distance < 0.5) {
              sitOnPerch(bird, bird.perch);
              bird.position.copy(perchAt);
              continue;
            }
            toPerch.setLength(distance < 12 ? Math.max(1.2, maxSpeed * distance / 12) : maxSpeed).sub(bird.velocity);
            clampLength(toPerch, 30);
            steer.add(toPerch);
            if (pointer.over && ray.distanceToPoint(bird.position) < 6) {
              bird.perch.bird = null;
              bird.perch = null;
              bird.state = 'flying';
              bird.panic = 2;
              bird.perchCooldown = 8;
            }
          }
        }

        if (bird.state === 'flying') {
          // Flocking: align with and move towards flockmates nearby, and keep
          // some distance from every flying bird.
          alignSum.set(0, 0, 0);
          cohesionSum.set(0, 0, 0);
          separationSum.set(0, 0, 0);
          let neighbors = 0;
          for (const other of birds) {
            if (other === bird || other.state === 'perched') continue;
            const dx = bird.position.x - other.position.x;
            const dy = bird.position.y - other.position.y;
            const dz = bird.position.z - other.position.z;
            const distanceSq = dx * dx + dy * dy + dz * dz;
            if (distanceSq < separationRadiusSq && distanceSq > 1e-4) {
              separationSum.x += dx / distanceSq;
              separationSum.y += dy / distanceSq;
              separationSum.z += dz / distanceSq;
            }
            if (distanceSq < neighborRadiusSq && other.flock === bird.flock) {
              alignSum.add(other.velocity);
              cohesionSum.add(other.position);
              neighbors++;
            }
          }
          if (neighbors) {
            if (alignSum.lengthSq() > 1e-6) {
              alignSum.divideScalar(neighbors).setLength(maxSpeed).sub(bird.velocity);
              steer.addScaledVector(clampLength(alignSum, maxForce), c.alignment);
            }
            cohesionSum.divideScalar(neighbors).sub(bird.position);
            if (cohesionSum.lengthSq() > 1e-6) {
              cohesionSum.setLength(maxSpeed).sub(bird.velocity);
              steer.addScaledVector(clampLength(cohesionSum, maxForce), c.cohesion);
            }
          }
          if (separationSum.lengthSq()) {
            separationSum.setLength(maxSpeed).sub(bird.velocity);
            steer.addScaledVector(clampLength(separationSum, maxForce), c.separation);
          }

          // Gentle pull towards the flock's moving target.
          birdTemp.subVectors(flockTargets[bird.flock], bird.position).setLength(maxSpeed).sub(bird.velocity);
          steer.addScaledVector(clampLength(birdTemp, maxForce), 0.4);

          // Soft walls around the scene, above the ground and below the sky.
          const boundX = maxR * 1.8 + 20;
          if (bird.position.x > boundX) steer.x -= (bird.position.x - boundX) * 2;
          if (bird.position.x < -boundX) steer.x -= (bird.position.x + boundX) * 2;
          if (bird.position.z > 45) steer.z -= (bird.position.z - 45) * 2;
          if (bird.position.z < -45) steer.z -= (bird.position.z + 45) * 2;
          if (bird.position.y < 14) steer.y += (14 - bird.position.y) * 3;
          if (bird.position.y > maxY + 22) steer.y -= (bird.position.y - maxY - 22) * 2;

          // Keep out of the trunk.
          const fromTrunk = Math.hypot(bird.position.x, bird.position.z);
          if (fromTrunk < 8 && bird.position.y < trunkTop + 2) {
            steer.x += bird.position.x / (fromTrunk + 0.01) * 25;
            steer.z += bird.position.z / (fromTrunk + 0.01) * 25;
          }

          // Dodge the pointer.
          if (pointer.over) {
            const distance = ray.distanceToPoint(bird.position);
            if (distance < 11) {
              ray.closestPointToPoint(bird.position, birdTemp);
              steer.addScaledVector(birdTemp.subVectors(bird.position, birdTemp).normalize(), 45 * (1 - distance / 11));
              bird.panic = Math.max(bird.panic, 0.8);
            }
          }

          // Occasionally head for a perch, keeping at most ~55% of birds
          // perched. Nobody perches during psychedelic mode.
          if (!psychedelic.active && bird.perchCooldown <= 0 && Math.random() < dt * 0.06 && perchedCount < birds.length * 0.55) {
            const perch = findFreePerch();
            if (perch) {
              perch.bird = bird;
              bird.perch = perch;
              bird.state = 'landing';
              perchedCount++;
            }
          }
        }

        // Integrate, keeping flying birds between their min and max speed.
        bird.velocity.addScaledVector(steer, dt);
        const speed = bird.velocity.length();
        if (bird.state === 'flying') {
          if (speed > maxSpeed) bird.velocity.setLength(maxSpeed);
          else if (speed < minSpeed) bird.velocity.setLength(minSpeed);
        } else {
          clampLength(bird.velocity, maxSpeed);
        }
        bird.position.addScaledVector(bird.velocity, dt);
        bird.group.position.copy(bird.position);
        if (bird.velocity.lengthSq() > 0.25) {
          birdTemp.copy(bird.position).add(bird.velocity);
          bird.group.lookAt(birdTemp);
        }

        // Flap faster when climbing, landing or scared; glide now and then.
        const climbing = bird.velocity.y > 1 || bird.state === 'landing' || bird.panic > 0;
        const gliding = !climbing && Math.sin(t * 0.7 + bird.flapPhase * 0.1) > 0.3;
        bird.flapPhase += dt * (climbing ? 16 : 10);
        const wingAngle = gliding ? 0.12 : Math.sin(bird.flapPhase) * flapAmount;
        bird.rightWing.rotation.z = wingAngle;
        bird.leftWing.rotation.z = -wingAngle;
      }
    }

    // One animation frame: apply config changes, update the wind, then
    // advance every moving part and render.
    function frame() {
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05); // avoid big jumps after a hidden tab
      const t = clock.elapsedTime;
      syncConfig();
      updatePsychedelic(t); // after syncConfig, which resets the day colors

      // Wind blows mostly along +x, with slow gusts and a sideways wander.
      const windStrength = CONFIG.windStrength;
      wind.gust = Math.max(0, Math.sin(t * 0.31) * Math.sin(t * 0.17 + 1.3)) * 1.6;
      wind.x = (0.7 + wind.gust) * windStrength;
      wind.z = Math.sin(t * 0.21) * 0.35 * windStrength;

      updateCamera(t, dt);
      updateCloud(t, dt);
      if (cenoteWater) cenoteWater.material.emissiveIntensity = 0.32 + Math.sin(t * 1.3) * 0.06; // shimmer
      updatePointer(dt);
      updateTreeBones(t, dt);
      updateFallingLeaves(t, dt);
      updateBirds(t, dt);
      updateBoidOverlay();
      updateCapybara(t, dt);
      updateRipples(dt);
      updateDiamond(t, dt);
      renderer.render(scene, camera);
    }
    frame();
  }

  // Whether the browser can create a WebGL2 context (the bone shader uses
  // texelFetch, which needs WebGL2).
  function webglAvailable() {
    try {
      var canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch (e) {
      return false;
    }
  }

  // Without three.js or WebGL2 the CSS gradient on #scene stays as the backdrop.
  if (window.THREE && webglAvailable()) {
    try {
      init(window.THREE);
    } catch (e) {
      console.error('scene: failed to start', e);
    }
  }
})();
