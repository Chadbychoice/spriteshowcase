import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const TOOLBAR_BUTTONS = [
  { key: "select", label: "Select", icon: "🖱️" },
  { key: "place-building", label: "Building", icon: "🏢" },
  { key: "place-pizza", label: "Pizza", icon: "🍕" },
  { key: "place-restaurant", label: "Restaurant", icon: "🍽️" },
  { key: "place-store", label: "Store", icon: "🏬" },
  { key: "place-sprite", label: "Sprite", icon: "🌳" },
  { key: "paint-floor", label: "Floor", icon: "🖌️" },
  { key: "place-road", label: "Road", icon: "🛣️" },
  { key: "delete", label: "Delete", icon: "❌" },
  { key: "save", label: "Save", icon: "💾" },
  { key: "load", label: "Load", icon: "📂" },
];

const BUILDING_TEXTURES = [
  { key: "building", label: "Building", img: "/textures/building.webp" },
  { key: "skyscraper1", label: "Skyscraper 1", img: "/textures/skyscraper1.webp" },
  { key: "skyscraper2", label: "Skyscraper 2", img: "/textures/skyscraper2.webp" },
  { key: "skyscraper3", label: "Skyscraper 3", img: "/textures/skyscraper3.webp" },
  { key: "pizza1", label: "Pizza 1", img: "/textures/pizza1.webp" },
  { key: "pizza2", label: "Pizza 2", img: "/textures/pizza2.webp" },
  { key: "restaurant1", label: "Restaurant 1", img: "/textures/restaurant1.webp" },
  { key: "restaurant2", label: "Restaurant 2", img: "/textures/restaurant2.webp" },
  { key: "restaurant3", label: "Restaurant 3", img: "/textures/restaurant3.webp" },
  { key: "store", label: "Store", img: "/textures/store.webp" },
];

const SPRITE_TYPES = [
  { key: "tree", label: "Tree" },
  { key: "streetlamp", label: "Streetlamp" },
];

// --- Add texture loader cache ---
const textureCache = {};
function getBuildingTexture(key) {
  const texObj = BUILDING_TEXTURES.find(t => t.key === key);
  if (!texObj || !texObj.img) return null;
  if (textureCache[key]) return textureCache[key];
  const loader = new THREE.TextureLoader();
  const tex = loader.load(texObj.img);
  textureCache[key] = tex;
  return tex;
}

const SMALL_BUILDING_TYPES = ["pizza1", "pizza2", "restaurant1", "restaurant2", "restaurant3", "store"];
const SMALL_BUILDING_SHAPES = [
  { key: "square", label: "Square", width: 1.2, depth: 1.2 },
  { key: "horizontal", label: "Horizontal", width: 1.6, depth: 0.8 },
  { key: "vertical", label: "Vertical", width: 0.8, depth: 1.6 },
];

const BUILDING_CATEGORIES = [
  { key: 'skyscraper', label: 'Skyscraper', textures: ['skyscraper1', 'skyscraper2', 'skyscraper3'] },
  { key: 'normal', label: 'Normal', textures: ['building'] },
  { key: 'small', label: 'Small', textures: ['pizza1', 'pizza2', 'restaurant1', 'restaurant2', 'restaurant3', 'store'] },
];

// Add a helper to generate unique IDs
function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

// Add available floor textures with type
const FLOOR_TEXTURES = [
  { key: 'default', label: 'Default', img: '/textures/ground.webp', type: 'default' },
  { key: 'brick', label: 'Brick', img: '/textures/brick.webp', type: 'brick' },
  { key: 'grass', label: 'Grass', img: '/textures/grass.webp', type: 'grass' },
  { key: 'asphalt', label: 'Asphalt', img: '/textures/asphalt.webp', type: 'asphalt' },
  { key: 'sidewalk', label: 'Sidewalk', img: '/textures/sidewalk.webp', type: 'sidewalk' },
];

// --- Toon gradient texture helper ---
function createToonGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  // Dramatic, high-contrast bands for comic look
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 4, 64);
  ctx.fillStyle = '#e0e0e0'; ctx.fillRect(0, 64, 4, 64);
  ctx.fillStyle = '#888'; ctx.fillRect(0, 128, 4, 32);
  ctx.fillStyle = '#333'; ctx.fillRect(0, 160, 4, 64);
  ctx.fillStyle = '#111'; ctx.fillRect(0, 224, 4, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
const toonGradientMap = createToonGradientTexture();

function EditorApp() {
  const mountRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState("select");
  // Properties for placing buildings/sprites
  const [buildingProps, setBuildingProps] = useState({
    wallTextureKey: "skyscraper1",
    width: 1,
    depth: 1,
    height: null, // null means random for skyscrapers
  });
  const [spriteProps, setSpriteProps] = useState({
    spriteKey: "tree"
  });
  // Store placed objects in state for live editing
  const [placedObjects, setPlacedObjects] = useState([]);
  // Track if scene is ready
  const [sceneReady, setSceneReady] = useState(false);

  // Store refs to Three.js objects for cleanup
  const sceneRef = useRef();
  const cameraRef = useRef();
  const rendererRef = useRef();
  const controlsRef = useRef();
  const meshesRef = useRef([]);
  const groundMeshRef = useRef();

  // Add state for small building shape
  const [smallBuildingShape, setSmallBuildingShape] = useState("square");
  // Add state for building category
  const [buildingCategory, setBuildingCategory] = useState('skyscraper');

  // Add state for selected object
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(null);

  // Use a Map for mesh tracking
  const meshMapRef = useRef(new Map());

  // Add state for per-tile floor textures (20x50 grid)
  const MAP_WIDTH = 20;
  const MAP_HEIGHT = 50;
  const [floorTiles, setFloorTiles] = useState(() =>
    Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill('default'))
  );
  const [selectedFloorTexture, setSelectedFloorTexture] = useState('default');
  const [lockCameraWhilePainting, setLockCameraWhilePainting] = useState(true);

  // --- Canvas for floor tilemap ---
  const TILE_SIZE = 32; // px per tile in canvas
  const [floorCanvas] = useState(() => document.createElement('canvas'));
  const [floorCtx, setFloorCtx] = useState(null);
  const floorTextureRef = useRef(null);

  // Preload tile images
  const tileImageCache = useRef({});
  const [tileImagesLoaded, setTileImagesLoaded] = useState(0);
  useEffect(() => {
    let loaded = 0;
    FLOOR_TEXTURES.forEach(tex => {
      if (!tileImageCache.current[tex.key]) {
        const img = new window.Image();
        img.src = tex.img;
        img.onload = () => {
          loaded++;
          setTileImagesLoaded(l => l + 1); // trigger redraw
        };
        tileImageCache.current[tex.key] = img;
      } else if (tileImageCache.current[tex.key].complete) {
        loaded++;
      }
    });
  }, []);

  // Draw the tilemap to the canvas whenever floorTiles or tileImagesLoaded changes
  useEffect(() => {
    if (!floorCtx) return;
    // Debug: fill canvas red on clear
    if (floorTiles.every(row => row.every(cell => cell === 'default'))) {
      floorCtx.fillStyle = '#f00';
      floorCtx.fillRect(0, 0, floorCanvas.width, floorCanvas.height);
      console.log('DEBUG: Canvas filled red on clear');
    } else {
      floorCtx.clearRect(0, 0, floorCanvas.width, floorCanvas.height);
    }
    for (let row = 0; row < MAP_HEIGHT; row++) {
      for (let col = 0; col < MAP_WIDTH; col++) {
        const type = floorTiles[row][col];
        const texObj = FLOOR_TEXTURES.find(t => t.type === type || t.key === type);
        const img = texObj ? tileImageCache.current[texObj.key] : null;
        if (img && img.complete) {
          floorCtx.drawImage(img, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else {
          // fallback: fill with color
          floorCtx.fillStyle = '#888';
          floorCtx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          if (img && !img.complete) {
            img.onload = () => setTileImagesLoaded(l => l + 1); // trigger redraw when loaded
          }
        }
      }
    }
    if (floorTextureRef.current) {
      floorTextureRef.current.needsUpdate = true;
    }
  }, [floorTiles, floorCtx, tileImagesLoaded]);

  // Render a single ground mesh with the canvas as its texture
  useEffect(() => {
    if (!sceneReady || !floorCtx) return;
    const scene = sceneRef.current;
    // Remove old ground mesh if any
    if (scene.__canvasGround) {
      scene.remove(scene.__canvasGround);
      scene.__canvasGround.material.map.dispose();
      scene.__canvasGround.material.dispose();
      scene.__canvasGround.geometry.dispose();
    }
    // Create Three.js texture from canvas (only once)
    let texture = floorTextureRef.current;
    if (!texture) {
      texture = new THREE.CanvasTexture(floorCanvas);
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      floorTextureRef.current = texture;
    }
    texture.needsUpdate = true;
    // Create ground mesh
    const geometry = new THREE.PlaneGeometry(MAP_WIDTH * 6, MAP_HEIGHT * 6);
    const material = new THREE.MeshToonMaterial({ map: texture, side: THREE.DoubleSide, gradientMap: toonGradientMap });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.receiveShadow = true;
    scene.add(mesh);
    scene.__canvasGround = mesh;
    groundMeshRef.current = mesh;
    return () => {
      if (scene.__canvasGround) {
        scene.remove(scene.__canvasGround);
        scene.__canvasGround.material.map.dispose();
        scene.__canvasGround.material.dispose();
        scene.__canvasGround.geometry.dispose();
        scene.__canvasGround = null;
      }
    };
  }, [sceneReady, floorCanvas, floorCtx]);

  useEffect(() => {
    let renderer, scene, camera, controls;
    let buildingMeshes = [];
    let spriteMeshes = [];
    let groundMesh = null;
    let cleanup = () => {};
    setLoading(true);
    setError(null);
    setSceneReady(false);

    // Load world data
    fetch("/world_data.json")
      .then((res) => res.json())
      .then((data) => {
        // Basic Three.js scene setup
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xbfdfff); // bright sky blue
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 40, 80);
        camera.lookAt(0, 0, 0);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        // Add OrbitControls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.screenSpacePanning = false;
        controls.minDistance = 10;
        controls.maxDistance = 400;
        controls.maxPolarAngle = Math.PI / 2.05;

        // Add a grid helper for orientation
        const grid = new THREE.GridHelper(200, 40, 0x888888, 0x444444);
        scene.add(grid);

        // --- Lighting ---
        // Strong ambient light for base brightness
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambient);
        // Main directional light (sun)
        const sun = new THREE.DirectionalLight(0xffffff, 2.5);
        sun.position.set(60, 120, 80);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 400;
        sun.shadow.camera.left = -150;
        sun.shadow.camera.right = 150;
        sun.shadow.camera.top = 150;
        sun.shadow.camera.bottom = -150;
        scene.add(sun);
        // Fill directional light (opposite angle, no shadow)
        const fill = new THREE.DirectionalLight(0xfffbe0, 1.5);
        fill.position.set(-80, 60, -100);
        scene.add(fill);
        // Hemisphere light for sky tint
        const hemi = new THREE.HemisphereLight(0xbbeeff, 0x444466, 0.7);
        scene.add(hemi);
        // Rim light (white, from behind)
        const rim = new THREE.DirectionalLight(0xffffff, 1.2);
        rim.position.set(0, 100, -200);
        scene.add(rim);

        // Add ground plane with floor texture if present
        if (data.floorTexture) {
          let texture;
          if (data.floorTexture.startsWith("data:image")) {
            const loader = new THREE.TextureLoader();
            texture = loader.load(data.floorTexture);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(10, 30);
          }
          const groundGeo = new THREE.PlaneGeometry(120, 450);
          const groundMat = new THREE.MeshToonMaterial({
            map: texture || null,
            color: texture ? 0xffffff : 0x444444,
            side: THREE.DoubleSide,
            gradientMap: toonGradientMap
          });
          groundMesh = new THREE.Mesh(groundGeo, groundMat);
          groundMesh.rotation.x = -Math.PI / 2;
          groundMesh.position.y = 0;
          groundMesh.receiveShadow = true;
          scene.add(groundMesh);
        }

        // --- FIX: Load floorTiles from file if present ---
        if (Array.isArray(data.floorTiles)) {
          setFloorTiles(data.floorTiles);
        }

        // Render buildings as colored boxes
        if (Array.isArray(data.placedObjects)) {
          for (const obj of data.placedObjects) {
            if (obj.type === "building") {
              const { x, y, z } = obj.position;
              const { width, height, depth } = obj.dimensions;
              // Color by wallTextureKey for now
              let color = 0x8888ff;
              if (obj.wallTextureKey && obj.wallTextureKey.includes("skyscraper")) color = 0x88c0ff;
              if (obj.wallTextureKey && obj.wallTextureKey.includes("restaurant")) color = 0xffc088;
              if (obj.wallTextureKey && obj.wallTextureKey.includes("pizza")) color = 0xff8888;
              if (obj.wallTextureKey && obj.wallTextureKey.includes("store")) color = 0x88ff88;
              const geometry = new THREE.BoxGeometry(width * 8, height * 30, depth * 8);
              const material = new THREE.MeshToonMaterial({ color, gradientMap: toonGradientMap });
              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.set(x, y + (height * 30) / 2, z);
              scene.add(mesh);
              buildingMeshes.push(mesh);
            }
            // Billboard sprite objects (tree, streetlamp, etc.)
            if (obj.type === "sprite" && obj.spriteKey) {
              const { x, y, z } = obj.position;
              let color = 0x44ff44;
              if (obj.spriteKey.includes("tree")) color = 0x44ff44;
              if (obj.spriteKey.includes("streetlamp")) color = 0xffff44;
              // Simple vertical plane for now
              const geometry = new THREE.PlaneGeometry(4, 8);
              const material = new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, gradientMap: toonGradientMap });
              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.set(x, y + 4, z);
              scene.add(mesh);
              spriteMeshes.push(mesh);
              // Add a label above
              const canvas = document.createElement('canvas');
              canvas.width = 128; canvas.height = 32;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 128, 32);
              ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
              ctx.fillText(obj.spriteKey, 4, 24);
              const tex = new THREE.CanvasTexture(canvas);
              const labelMat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradientMap });
              const label = new THREE.Mesh(geometry.clone(), labelMat);
              label.position.set(x, y + 9, z);
              label.scale.set(8, 2, 1);
              scene.add(label);
            }
          }
        }

        // Store refs
        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;
        controlsRef.current = controls;
        groundMeshRef.current = groundMesh;
        // Load placed objects from file
        if (Array.isArray(data.placedObjects)) {
          // Assign unique ids, avoid duplicates
          const seen = new Set();
          const objectsWithIds = data.placedObjects.map(obj => {
            let id = obj.id;
            while (!id || seen.has(id)) {
              id = generateId();
            }
            seen.add(id);
            return { ...obj, id };
          });
          setPlacedObjects(objectsWithIds);
        } else {
          setPlacedObjects([]);
        }
        setSceneReady(true);

        // Animation loop
        function animate() {
          controls.update();
          renderer.render(scene, camera);
          requestAnimationFrame(animate);
        }
        animate();

        // Handle resize
        function onResize() {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener("resize", onResize);
        cleanup = () => {
          window.removeEventListener("resize", onResize);
          renderer.dispose();
          mountRef.current.innerHTML = "";
        };
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load world_data.json: " + err.message);
        setLoading(false);
      });
    return () => cleanup();
  }, []);

  // Render placed objects in Three.js scene
  useEffect(() => {
    if (!sceneReady) return;
    const scene = sceneRef.current;
    // Remove all old meshes
    meshMapRef.current.forEach(meshArr => {
      meshArr.forEach(mesh => scene.remove(mesh));
    });
    meshMapRef.current.clear();
    // Add buildings and sprites
    placedObjects.forEach((obj, idx) => {
      let meshArr = [];
      if (obj.type === "building") {
        const { x, y, z } = obj.position;
        const { width, height, depth } = obj.dimensions;
        let material;
        const texture = getBuildingTexture(obj.wallTextureKey);
        if (texture) {
          // DEBUG: Use MeshBasicMaterial to ignore lighting
          material = new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff });
        } else {
          // DEBUG: Use MeshBasicMaterial with a bright color
          let color = 0xffffff;
          if (obj.wallTextureKey && obj.wallTextureKey.includes("skyscraper")) color = 0xc0e8ff;
          else if (obj.wallTextureKey && obj.wallTextureKey.includes("restaurant")) color = 0xffe066;
          else if (obj.wallTextureKey && obj.wallTextureKey.includes("pizza")) color = 0xffa366;
          else if (obj.wallTextureKey && obj.wallTextureKey.includes("store")) color = 0x88ff88;
          material = new THREE.MeshBasicMaterial({ color });
        }
        let meshHeight, meshY;
        if (obj.wallTextureKey && SMALL_BUILDING_TYPES.includes(obj.wallTextureKey)) {
          meshHeight = height * 8;
          meshY = y + (meshHeight) / 2;
        } else if (obj.wallTextureKey && (obj.wallTextureKey.includes("pizza") || obj.wallTextureKey.includes("restaurant") || obj.wallTextureKey.includes("store"))) {
          meshHeight = height * 4;
          meshY = y + (meshHeight) / 2;
        } else {
          meshHeight = height * 30;
          meshY = y + (meshHeight) / 2;
        }
        const geometry = new THREE.BoxGeometry(width * 8, meshHeight, depth * 8);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, meshY, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Highlight if selected
        if (selectedObjectIndex === idx) {
          mesh.material = mesh.material.clone();
          mesh.material.emissive = new THREE.Color(0xffff00);
          mesh.material.emissiveIntensity = 0.5;
        }
        // --- Comic outline ---
        const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
        const outlineMesh = new THREE.Mesh(geometry.clone(), outlineMat);
        outlineMesh.position.copy(mesh.position);
        outlineMesh.scale.multiplyScalar(1.05);
        scene.add(outlineMesh);
        meshArr.push(mesh, outlineMesh);
      }
      if (obj.type === "sprite" && obj.spriteKey) {
        const { x, y, z } = obj.position;
        if (obj.spriteKey === "tree") {
          const trunkGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 12);
          const trunkMat = new THREE.MeshToonMaterial({ color: 0x8B5A2B, gradientMap: toonGradientMap });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.set(x, y + 1, z);
          scene.add(trunk);
          meshArr.push(trunk);
          const foliageGeo = new THREE.SphereGeometry(1, 16, 16);
          const foliageMat = new THREE.MeshToonMaterial({ color: 0x228B22, gradientMap: toonGradientMap });
          const foliage = new THREE.Mesh(foliageGeo, foliageMat);
          foliage.position.set(x, y + 2.2, z);
          scene.add(foliage);
          meshArr.push(foliage);
          // Highlight if selected
          if (selectedObjectIndex === idx) {
            trunk.material = trunk.material.clone();
            trunk.material.emissive = new THREE.Color(0xffff00);
            trunk.material.emissiveIntensity = 0.5;
            foliage.material = foliage.material.clone();
            foliage.material.emissive = new THREE.Color(0xffff00);
            foliage.material.emissiveIntensity = 0.5;
          }
        } else if (obj.spriteKey === "streetlamp") {
          const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.5, 10);
          const poleMat = new THREE.MeshToonMaterial({ color: 0xcccccc, gradientMap: toonGradientMap });
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(x, y + 1.25, z);
          scene.add(pole);
          meshArr.push(pole);
          const lampGeo = new THREE.SphereGeometry(0.22, 12, 12);
          const lampMat = new THREE.MeshToonMaterial({ color: 0xffffaa, emissive: 0xffff99, gradientMap: toonGradientMap });
          const lamp = new THREE.Mesh(lampGeo, lampMat);
          lamp.position.set(x, y + 2.5, z);
          scene.add(lamp);
          meshArr.push(lamp);
          // Highlight if selected
          if (selectedObjectIndex === idx) {
            pole.material = pole.material.clone();
            pole.material.emissive = new THREE.Color(0xffff00);
            pole.material.emissiveIntensity = 0.5;
            lamp.material = lamp.material.clone();
            lamp.material.emissive = new THREE.Color(0xffff00);
            lamp.material.emissiveIntensity = 0.5;
          }
        }
      }
      meshMapRef.current.set(obj.id, meshArr);
    });
  }, [placedObjects, sceneReady, selectedObjectIndex]);

  // Click-to-place logic
  useEffect(() => {
    if (!sceneReady) return;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const groundMesh = groundMeshRef.current;
    if (!renderer || !camera || !scene || !groundMesh) return;
    function onPointerDown(e) {
      if (activeTool !== "place-building" && activeTool !== "place-sprite") return;
      // Get mouse position normalized
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      // Raycast to ground
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(groundMesh);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        if (activeTool === "place-building") {
          const isSkyscraper = buildingProps.wallTextureKey && buildingProps.wallTextureKey.includes("skyscraper");
          let height = buildingProps.height;
          if (isSkyscraper && (height === null || height === undefined || height === '')) {
            height = Math.round((0.6 + Math.random() * 0.6) * 20) / 20;
          }
          setPlacedObjects(prev => [
            ...prev,
            {
              id: generateId(),
              type: "building",
              position: { x: point.x, y: 0.51, z: point.z },
              dimensions: {
                width: buildingProps.width,
                height: height,
                depth: buildingProps.depth
              },
              wallTextureKey: buildingProps.wallTextureKey
            }
          ]);
        } else if (activeTool === "place-sprite") {
          setPlacedObjects(prev => [
            ...prev,
            {
              id: generateId(),
              type: "sprite",
              position: { x: point.x, y: 0.51, z: point.z },
              spriteKey: spriteProps.spriteKey
            }
          ]);
        }
      }
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    return () => {
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    };
  }, [sceneReady, activeTool, buildingProps, spriteProps]);

  // Handle toolbar button logic for pizza, restaurant, store
  useEffect(() => {
    if (activeTool === "place-pizza") {
      setBuildingCategory('small');
      setSmallBuildingShape("square");
      setBuildingProps({ wallTextureKey: "pizza1", width: 1.2, depth: 1.2, height: 0.6 });
      setActiveTool("place-building");
    } else if (activeTool === "place-restaurant") {
      setBuildingCategory('small');
      setSmallBuildingShape("square");
      setBuildingProps({ wallTextureKey: "restaurant1", width: 1.2, depth: 1.2, height: 0.6 });
      setActiveTool("place-building");
    } else if (activeTool === "place-store") {
      setBuildingCategory('small');
      setSmallBuildingShape("square");
      setBuildingProps({ wallTextureKey: "store", width: 1.2, depth: 1.2, height: 0.6 });
      setActiveTool("place-building");
    }
  }, [activeTool]);

  // Right-side properties panel
  let propertiesPanel = null;
  if (activeTool === "place-building") {
    // Determine category
    const categoryObj = BUILDING_CATEGORIES.find(c => c.key === buildingCategory);
    const categoryTextures = categoryObj ? categoryObj.textures : [];
    const isSmallBuilding = buildingCategory === 'small';
    const isSkyscraper = buildingCategory === 'skyscraper';
    const selectedTexture = BUILDING_TEXTURES.find(t => t.key === buildingProps.wallTextureKey);
    propertiesPanel = (
      <div style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Building Properties</h3>
        <label>Category:<br />
          <select
            value={buildingCategory}
            onChange={e => {
              const newCat = e.target.value;
              setBuildingCategory(newCat);
              const catObj = BUILDING_CATEGORIES.find(c => c.key === newCat);
              if (catObj && catObj.textures.length > 0) {
                setBuildingProps(bp => ({
                  ...bp,
                  wallTextureKey: catObj.textures[0],
                  height: newCat === 'skyscraper' ? null : bp.height
                }));
              }
            }}
            style={{ width: '100%', marginBottom: 8 }}
          >
            {BUILDING_CATEGORIES.map(cat => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
        </label>
        <label>Texture:<br />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {BUILDING_TEXTURES.filter(tex => categoryTextures.includes(tex.key)).map(tex => (
              <div key={tex.key} style={{ textAlign: 'center' }}>
                <button
                  onClick={() => {
                    setBuildingProps(bp => ({ ...bp, wallTextureKey: tex.key }));
                    if (buildingCategory === 'small') {
                      setSmallBuildingShape("square");
                      setBuildingProps(bp => ({ ...bp, width: 1.2, depth: 1.2, height: 0.6 }));
                    }
                  }}
                  style={{
                    border: buildingProps.wallTextureKey === tex.key ? '2px solid #fff' : '1px solid #444',
                    background: '#222',
                    borderRadius: 4,
                    padding: 2,
                    cursor: 'pointer',
                    marginBottom: 2
                  }}
                  title={tex.label}
                >
                  <img src={tex.img} alt={tex.label} style={{ width: 32, height: 32, objectFit: 'cover', display: 'block' }} />
                </button>
                <div style={{ fontSize: 10, color: '#aaa' }}>{tex.label}</div>
              </div>
            ))}
          </div>
        </label>
        {selectedTexture && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Selected:</span><br />
            <img src={selectedTexture.img} alt={selectedTexture.label} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #444' }} />
            <div style={{ fontSize: 12, color: '#fff' }}>{selectedTexture.label}</div>
          </div>
        )}
        {isSmallBuilding && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Shape:</span><br />
            {SMALL_BUILDING_SHAPES.map(shape => (
              <button
                key={shape.key}
                onClick={() => {
                  setSmallBuildingShape(shape.key);
                  setBuildingProps(bp => ({ ...bp, width: shape.width, depth: shape.depth }));
                }}
                style={{
                  marginRight: 6,
                  background: smallBuildingShape === shape.key ? '#444' : '#23272c',
                  color: '#fff',
                  border: smallBuildingShape === shape.key ? '2px solid #fff' : '1px solid #444',
                  borderRadius: 4,
                  padding: '2px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {shape.label}
              </button>
            ))}
          </div>
        )}
        <label>Width:<br />
          <input type="number" min={0.5} max={20} step={0.1} value={buildingProps.width}
            onChange={e => setBuildingProps({ ...buildingProps, width: Number(e.target.value) })}
            style={{ width: 60, marginRight: 8 }}
          />
        </label>
        <label>Depth:<br />
          <input type="number" min={0.5} max={20} step={0.1} value={buildingProps.depth}
            onChange={e => setBuildingProps({ ...buildingProps, depth: Number(e.target.value) })}
            style={{ width: 60, marginRight: 8 }}
          />
        </label>
        <label>Height:<br />
          <input
            type="number"
            min={isSkyscraper ? 0.6 : 0.1}
            max={isSkyscraper ? 2 : 5}
            step={isSkyscraper ? 0.05 : 0.05}
            value={buildingProps.height === null ? '' : buildingProps.height}
            placeholder={isSkyscraper ? 'Random' : ''}
            onChange={e => {
              const val = e.target.value;
              setBuildingProps({ ...buildingProps, height: val === '' ? null : Number(val) });
            }}
            style={{ width: 60 }}
          />
          {isSkyscraper && buildingProps.height === null && (
            <span style={{ color: '#aaa', marginLeft: 8 }}>(Random)</span>
          )}
        </label>
      </div>
    );
  } else if (activeTool === "place-sprite") {
    propertiesPanel = (
      <div style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Sprite Properties</h3>
        <label>Type:<br />
          <select
            value={spriteProps.spriteKey}
            onChange={e => setSpriteProps({ ...spriteProps, spriteKey: e.target.value })}
            style={{ width: "100%" }}
          >
            {SPRITE_TYPES.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>
    );
  } else if (activeTool === 'paint-floor') {
    propertiesPanel = (
      <div style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Paint Floor</h3>
        <label>Texture:<br />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {/* Road section label */}
            <div style={{ width: '100%', fontWeight: 600, color: '#aaa', margin: '4px 0 2px 0' }}>Roads</div>
            {FLOOR_TEXTURES.filter(tex => tex.type === 'asphalt' || tex.type === 'sidewalk').map(tex => (
              <button
                key={tex.key}
                onClick={() => setSelectedFloorTexture(tex.type)}
                style={{
                  border: selectedFloorTexture === tex.type ? '2px solid #fff' : '1px solid #444',
                  background: '#222',
                  borderRadius: 4,
                  padding: 2,
                  cursor: 'pointer',
                  marginBottom: 2
                }}
                title={tex.label}
              >
                <img src={tex.img} alt={tex.label} style={{ width: 32, height: 32, objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
            {/* Other textures */}
            <div style={{ width: '100%', fontWeight: 600, color: '#aaa', margin: '8px 0 2px 0' }}>Other</div>
            {FLOOR_TEXTURES.filter(tex => tex.type !== 'asphalt' && tex.type !== 'sidewalk').map(tex => (
              <button
                key={tex.key}
                onClick={() => setSelectedFloorTexture(tex.type)}
                style={{
                  border: selectedFloorTexture === tex.type ? '2px solid #fff' : '1px solid #444',
                  background: '#222',
                  borderRadius: 4,
                  padding: 2,
                  cursor: 'pointer',
                  marginBottom: 2
                }}
                title={tex.label}
              >
                <img src={tex.img} alt={tex.label} style={{ width: 32, height: 32, objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', margin: '8px 0 12px 0' }}>
          <input
            type="checkbox"
            checked={lockCameraWhilePainting}
            onChange={e => setLockCameraWhilePainting(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Lock camera while painting
        </label>
        <button
          style={{ marginBottom: 12, background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => {
            console.log('DEBUG: Clear Floor button clicked');
            setFloorTiles(Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill('default')));
            if (floorTextureRef.current) floorTextureRef.current.needsUpdate = true;
          }}
        >Clear Floor</button>
        <div style={{ color: '#aaa', fontSize: 12 }}>Click or drag on the ground to paint with the selected texture.</div>
      </div>
    );
  }

  // --- Placement preview (ghost) ---
  const ghostMeshRef = useRef();
  useEffect(() => {
    if (!sceneReady) return;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    let ghostMesh = ghostMeshRef.current;
    // Remove old ghost
    if (ghostMesh) {
      scene.remove(ghostMesh);
      ghostMeshRef.current = null;
    }
    if (activeTool === "place-building") {
      // Use a much smaller height scale for pizza/restaurant/store
      const { width, height, depth, wallTextureKey } = buildingProps;
      let meshHeight;
      if (SMALL_BUILDING_TYPES.includes(wallTextureKey)) {
        meshHeight = (height || 0.6) * 8;
      } else if (wallTextureKey && (wallTextureKey.includes("pizza") || wallTextureKey.includes("restaurant") || wallTextureKey.includes("store"))) {
        meshHeight = (height || 0.3) * 4;
      } else {
        meshHeight = (height || 1) * 30;
      }
      const geometry = new THREE.BoxGeometry(width * 8, meshHeight, depth * 8);
      const texture = getBuildingTexture(wallTextureKey);
      let material;
      if (texture) {
        material = new THREE.MeshToonMaterial({ map: texture, opacity: 0.5, transparent: true });
      } else {
        material = new THREE.MeshToonMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
      }
      ghostMesh = new THREE.Mesh(geometry, material);
      ghostMesh.visible = false;
      scene.add(ghostMesh);
      ghostMeshRef.current = ghostMesh;
      // Mouse move handler
      function onPointerMove(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const groundMesh = groundMeshRef.current;
        if (!groundMesh) return;
        const intersects = raycaster.intersectObject(groundMesh);
        if (intersects.length > 0) {
          const point = intersects[0].point;
          ghostMesh.position.set(point.x, meshHeight / 2 + 0.51, point.z);
          ghostMesh.visible = true;
        } else {
          ghostMesh.visible = false;
        }
      }
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      return () => {
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        if (ghostMesh) scene.remove(ghostMesh);
        ghostMeshRef.current = null;
      };
    } else if (activeTool === "place-sprite") {
      // Show ghost for tree/lamppost
      let ghostGroup = new THREE.Group();
      let mesh1, mesh2;
      if (spriteProps.spriteKey === "tree") {
        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 12);
        const trunkMat = new THREE.MeshToonMaterial({ color: 0x8B5A2B, opacity: 0.5, transparent: true });
        mesh1 = new THREE.Mesh(trunkGeo, trunkMat);
        mesh1.position.set(0, 1, 0);
        ghostGroup.add(mesh1);
        // Foliage
        const foliageGeo = new THREE.SphereGeometry(1, 16, 16);
        const foliageMat = new THREE.MeshToonMaterial({ color: 0x228B22, opacity: 0.5, transparent: true });
        mesh2 = new THREE.Mesh(foliageGeo, foliageMat);
        mesh2.position.set(0, 2.2, 0);
        ghostGroup.add(mesh2);
      } else if (spriteProps.spriteKey === "streetlamp") {
        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.5, 10);
        const poleMat = new THREE.MeshToonMaterial({ color: 0xcccccc, opacity: 0.5, transparent: true });
        mesh1 = new THREE.Mesh(poleGeo, poleMat);
        mesh1.position.set(0, 1.25, 0);
        ghostGroup.add(mesh1);
        // Lamp
        const lampGeo = new THREE.SphereGeometry(0.22, 12, 12);
        const lampMat = new THREE.MeshToonMaterial({ color: 0xffffaa, emissive: 0xffff99, opacity: 0.5, transparent: true });
        mesh2 = new THREE.Mesh(lampGeo, lampMat);
        mesh2.position.set(0, 2.5, 0);
        ghostGroup.add(mesh2);
      }
      ghostGroup.visible = false;
      scene.add(ghostGroup);
      ghostMeshRef.current = ghostGroup;
      function onPointerMove(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const groundMesh = groundMeshRef.current;
        if (!groundMesh) return;
        const intersects = raycaster.intersectObject(groundMesh);
        if (intersects.length > 0) {
          const point = intersects[0].point;
          ghostGroup.position.set(point.x, 0.51, point.z);
          ghostGroup.visible = true;
        } else {
          ghostGroup.visible = false;
        }
      }
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      return () => {
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        if (ghostGroup) scene.remove(ghostGroup);
        ghostMeshRef.current = null;
      };
    }
  }, [sceneReady, activeTool, buildingProps, spriteProps]);

  // Add click-to-select logic
  useEffect(() => {
    if (!sceneReady) return;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    function onPointerDown(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      // Flatten all meshes for hit testing
      const meshMap = meshMapRef.current;
      const allMeshes = Array.from(meshMap.values()).flat();
      const intersects = raycaster.intersectObjects(allMeshes, false);
      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        // Find which object id this mesh belongs to
        let foundId = null;
        for (let [id, arr] of meshMap.entries()) {
          if (arr.includes(mesh)) {
            foundId = id;
            break;
          }
        }
        if (foundId) {
          const idx = placedObjects.findIndex(obj => obj.id === foundId);
          if (idx !== -1) {
            setSelectedObjectIndex(idx);
            return;
          }
        }
      }
      setSelectedObjectIndex(null);
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    return () => {
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    };
  }, [sceneReady, placedObjects]);

  // Keyboard delete support
  useEffect(() => {
    function onKeyDown(e) {
      if (selectedObjectIndex !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
        deleteSelectedObject();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedObjectIndex, placedObjects]);

  // Show selected object properties for editing
  if (selectedObjectIndex !== null && placedObjects[selectedObjectIndex]) {
    const obj = placedObjects[selectedObjectIndex];
    if (obj.type === "building") {
      propertiesPanel = (
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Edit Building</h3>
          <label>Position X:<br />
            <input type="number" value={obj.position.x} step={0.1}
              onChange={e => {
                const x = Number(e.target.value);
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, position: { ...o.position, x } } : o));
              }}
              style={{ width: 60, marginRight: 8 }}
            />
          </label>
          <label>Position Z:<br />
            <input type="number" value={obj.position.z} step={0.1}
              onChange={e => {
                const z = Number(e.target.value);
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, position: { ...o.position, z } } : o));
              }}
              style={{ width: 60, marginRight: 8 }}
            />
          </label>
          <label>Width:<br />
            <input type="number" value={obj.dimensions.width} step={0.1}
              onChange={e => {
                const width = Number(e.target.value);
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, dimensions: { ...o.dimensions, width } } : o));
              }}
              style={{ width: 60, marginRight: 8 }}
            />
          </label>
          <label>Depth:<br />
            <input type="number" value={obj.dimensions.depth} step={0.1}
              onChange={e => {
                const depth = Number(e.target.value);
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, dimensions: { ...o.dimensions, depth } } : o));
              }}
              style={{ width: 60, marginRight: 8 }}
            />
          </label>
          <label>Height:<br />
            <input type="number" value={obj.dimensions.height} step={0.05}
              onChange={e => {
                const height = Number(e.target.value);
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, dimensions: { ...o.dimensions, height } } : o));
              }}
              style={{ width: 60, marginRight: 8 }}
            />
          </label>
          <label>Texture:<br />
            <select value={obj.wallTextureKey}
              onChange={e => {
                const wallTextureKey = e.target.value;
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, wallTextureKey } : o));
              }}
              style={{ width: '100%' }}
            >
              {BUILDING_TEXTURES.map(tex => (
                <option key={tex.key} value={tex.key}>{tex.label}</option>
              ))}
            </select>
          </label>
          <button
            style={{ marginTop: 16, background: '#a33', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
            onClick={deleteSelectedObject}
          >Delete</button>
        </div>
      );
    } else if (obj.type === "sprite") {
      propertiesPanel = (
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Edit Sprite</h3>
          <label>Position X:<br />
            <input type="number" value={obj.position.x} step={0.1}
              onChange={e => {
                const x = Number(e.target.value);
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, position: { ...o.position, x } } : o));
              }}
              style={{ width: 60, marginRight: 8 }}
            />
          </label>
          <label>Position Z:<br />
            <input type="number" value={obj.position.z} step={0.1}
              onChange={e => {
                const z = Number(e.target.value);
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, position: { ...o.position, z } } : o));
              }}
              style={{ width: 60, marginRight: 8 }}
            />
          </label>
          <label>Type:<br />
            <select value={obj.spriteKey}
              onChange={e => {
                const spriteKey = e.target.value;
                setPlacedObjects(prev => prev.map((o, i) => i === selectedObjectIndex ? { ...o, spriteKey } : o));
              }}
              style={{ width: '100%' }}
            >
              {SPRITE_TYPES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <button
            style={{ marginTop: 16, background: '#a33', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
            onClick={deleteSelectedObject}
          >Delete</button>
        </div>
      );
    }
  }

  // In delete logic (button and keyboard), remove meshes from scene and map
  function deleteSelectedObject() {
    if (selectedObjectIndex !== null && placedObjects[selectedObjectIndex]) {
      const obj = placedObjects[selectedObjectIndex];
      // Remove meshes from scene
      const meshArr = meshMapRef.current.get(obj.id);
      if (meshArr) {
        const scene = sceneRef.current;
        meshArr.forEach(mesh => scene.remove(mesh));
        meshMapRef.current.delete(obj.id);
      }
      setPlacedObjects(prev => prev.filter((_, i) => i !== selectedObjectIndex));
      setSelectedObjectIndex(null);
    }
  }

  // On mount, set up canvas and context
  useEffect(() => {
    floorCanvas.width = MAP_WIDTH * TILE_SIZE;
    floorCanvas.height = MAP_HEIGHT * TILE_SIZE;
    setFloorCtx(floorCanvas.getContext('2d'));
  }, []);

  // Drag-to-paint state
  const [isPainting, setIsPainting] = useState(false);

  // Floor painting logic: update floorTiles on click or drag
  useEffect(() => {
    if (!sceneReady) return;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;

    function paintTileAtPointer(e) {
      if (activeTool !== 'paint-floor') return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const ground = scene.__canvasGround;
      if (!ground) return;
      const intersects = raycaster.intersectObject(ground);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        // Convert world position to tile coordinates
        const col = Math.floor((point.x + (MAP_WIDTH * 3)) / 6);
        const row = Math.floor((point.z + (MAP_HEIGHT * 3)) / 6);
        if (row >= 0 && row < MAP_HEIGHT && col >= 0 && col < MAP_WIDTH) {
          setFloorTiles(prev => {
            if (prev[row][col] === selectedFloorTexture) return prev;
            const next = prev.map(arr => arr.slice());
            next[row][col] = selectedFloorTexture;
            return next;
          });
          if (floorTextureRef.current) floorTextureRef.current.needsUpdate = true;
        }
      }
    }

    function onPointerDown(e) {
      if (activeTool !== 'paint-floor') return;
      setIsPainting(true);
      paintTileAtPointer(e);
    }
    function onPointerMove(e) {
      if (activeTool !== 'paint-floor' || !isPainting) return;
      paintTileAtPointer(e);
    }
    function onPointerUp(e) {
      if (activeTool !== 'paint-floor') return;
      setIsPainting(false);
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [sceneReady, activeTool, selectedFloorTexture, floorTiles, isPainting]);

  // Disable OrbitControls when painting and lock is enabled
  useEffect(() => {
    if (!sceneReady) return;
    const controls = controlsRef.current;
    if (activeTool === 'paint-floor' && lockCameraWhilePainting) {
      controls.enabled = false;
    } else {
      controls.enabled = true;
    }
  }, [sceneReady, activeTool, lockCameraWhilePainting]);

  // Add save map function
  function saveMap() {
    const data = {
      placedObjects,
      floorTiles,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world_data.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // Add load map function
  function loadMap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.placedObjects && Array.isArray(data.placedObjects)) {
            setPlacedObjects(data.placedObjects);
          }
          if (data.floorTiles && Array.isArray(data.floorTiles)) {
            setFloorTiles(data.floorTiles);
            if (floorTextureRef.current) floorTextureRef.current.needsUpdate = true;
          }
        } catch (err) {
          alert('Failed to load map: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{ padding: "0.5em 1em", background: "#23272c", borderBottom: "1px solid #333", flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3em" }}>World Editor</h1>
          <p style={{ margin: 0, fontSize: "0.9em", color: "#aaa" }}>Edit your world, place buildings, paint floors, and save as JSON.</p>
        </div>
        <div>
          <button
            style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, marginRight: 8 }}
            onClick={loadMap}
          >Load Map</button>
          <button
            style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
            onClick={saveMap}
          >Save Map</button>
        </div>
      </header>
      <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
        {/* Toolbar */}
        <nav style={{ width: 64, background: "#23272c", borderRight: "1px solid #333", display: "flex", flexDirection: "column", alignItems: "center", padding: "0.5em 0", flex: '0 0 64px' }}>
          {TOOLBAR_BUTTONS.map(btn => (
            <button
              key={btn.key}
              title={btn.label}
              onClick={() => setActiveTool(btn.key)}
              style={{
                background: activeTool === btn.key ? "#444" : "none",
                color: activeTool === btn.key ? "#fff" : "#aaa",
                border: "none",
                borderRadius: 8,
                margin: "0.25em 0",
                width: 48,
                height: 48,
                fontSize: 28,
                cursor: "pointer",
                outline: "none"
              }}
            >
              <span>{btn.icon}</span>
            </button>
          ))}
        </nav>
        <main style={{ flex: 1, position: "relative", display: "flex", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {loading && <div style={{position:'absolute',left:0,top:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#222c',zIndex:10}}>Loading world...</div>}
          {error && <div style={{position:'absolute',left:0,top:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#a002',zIndex:10}}>{error}</div>}
          <div ref={mountRef} style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0, overflow: "hidden" }} />
          {/* Properties panel */}
          {propertiesPanel && (
            <aside style={{ width: 260, background: "#23272c", borderLeft: "1px solid #333", color: "#eee", boxShadow: "-2px 0 8px #0002", zIndex: 2, flex: '0 0 260px', height: '100%', overflowY: 'auto' }}>
              {propertiesPanel}
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<EditorApp />); 