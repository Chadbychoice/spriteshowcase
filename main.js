import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// Add imports for post-processing
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
// Import necessary passes for saturation and ambient dust
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ColorCorrectionShader } from 'three/examples/jsm/shaders/ColorCorrectionShader.js';

let scene, camera, renderer;
let composer;
let bloomPass; // Declare bloomPass in the global scope
let characterSprite;
let clock = new THREE.Clock();

// --- Configuration ---
const SPRITE_PATH = '/sprites/';
const ANGLES = [
    0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 
    180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5
];
const FRAME_COUNT = 12; // Updated frame count (0000-0011)
const WALK_FRAME_DURATION = 0.1; // Duration each walk frame is shown (in seconds)
const IDLE_FRAME_DURATION = 0.2; // Duration each idle frame is shown (in seconds)
const RUN_FRAME_DURATION = 0.07; // Duration each run frame is shown (in seconds)
const JUMP_FRAME_DURATION = 0.1; // Duration each jump frame is shown (in seconds)
const PUNCH_FRAME_DURATION = 0.06; // Make punch fast
const MOVEMENT_SPEED = 2.0; // Units per second
const RUN_SPEED = 5.0; // Units per second when running
const JUMP_FORCE = 7.0; // Initial upward velocity for jump
const GRAVITY = 18.0; // Acceleration due to gravity (units per second squared)
const SPRITE_SCALE = 2; // Adjust as needed for sprite size
const TREE_SCALE = 5; // Size of the tree sprites
const GRASS_PATCH_SCALE = 4; // Size of the grass patches under trees
const CHARACTER_COLLISION_RADIUS = 0.3; // Make character hitbox smaller
const TREE_COLLISION_RADIUS = 0.5;    // Make tree hitbox smaller
const CAR_SCALE = 6; // Make car larger
const CAR_COLLISION_RADIUS = 1.5; // Collision radius for the car
const CAR_ACCELERATION = 20.0; // Make car faster still
const CAR_BRAKING = 10.0; // Units per second^2
const CAR_FRICTION = 2.0; // Slowdown factor
const CAR_TURN_SPEED = 1.5; // Radians per second
const MAX_CAR_SPEED = 30.0; // Increase max speed again
const INTERACTION_DISTANCE = 2.0; // Max distance to interact with car
const CAR_SPRITE_PREFIX = "bc66dce3-9546-48ba-b62e-3e93e8b7c623"; // Updated prefix
const CAR2_SPRITE_PREFIX = "8cc5ca8e-efd6-48ea-8962-cb703a81bf5f"; // Prefix for the blue car
const NUM_CAR_ANGLES = 64;
const CAR_ANGLE_INCREMENT = 360 / NUM_CAR_ANGLES; // 5.625 degrees
// Generate the 64 angles for the car (reused for both)
const CAR_ANGLES = Array.from({ length: NUM_CAR_ANGLES }, (_, i) => i * CAR_ANGLE_INCREMENT);

const CAMERA_TARGET_OFFSET = new THREE.Vector3(0, 1.0, 0); // Look slightly above character feet
const CAMERA_OFFSET = new THREE.Vector3(0, 1.6, 1.8); // Zoom even closer (for character)
// Increase Y offset for car to raise camera height
const CAMERA_OFFSET_CAR = new THREE.Vector3(0, 3.0, 5.0); // Y increased from 2.5 to 3.0
const CAMERA_MIN_Y = 0.5; // Minimum height camera can go (prevent floor clipping)
const CAMERA_SMOOTH_SPEED = 5.0; // How quickly the camera position follows (higher is faster)
const CAMERA_ANGLE_FOLLOW_SPEED = 5.0; // Make camera angle follow faster
const CAMERA_VERTICAL_SMOOTH_SPEED = 8.0; // Speed for vertical angle lerping
const MOUSE_SENSITIVITY = 0.002;
const CAMERA_VERTICAL_ANGLE_CHARACTER_RAD = THREE.MathUtils.degToRad(50);
const CAMERA_VERTICAL_ANGLE_CAR_RAD = THREE.MathUtils.degToRad(55);
const MAX_DUST_PARTICLES = 200;
const DUST_PARTICLE_LIFETIME = 1.5; // seconds
const DUST_EMISSION_RATE_PER_SPEED = 2; // Particles per second per unit of speed
const BASE_BLOOM_STRENGTH = 0.1; // Lower base bloom
const MAX_BLOOM_STRENGTH = 0.4;  // Lower max bloom
const SKYSCRAPER_BASE_SIZE = 8;
const SKYSCRAPER_MIN_HEIGHT = 20;
const SKYSCRAPER_MAX_HEIGHT = 60;
const NUM_NPCS = 5; // How many NPCs to create
const NPC_WALK_SPEED = 1.0; // Units per second
const NPC_FRAME_COUNT = 10; // 0000-0009
const NPC_IDLE_FRAME_DURATION = 0.25;
const NPC_WALK_FRAME_DURATION = 0.15;
const NPC_MIN_DECISION_TIME = 2.0; // seconds
const NPC_MAX_DECISION_TIME = 6.0; // seconds
const NPC_TARGET_RADIUS = 15.0; // Max distance for random walk target
const NPC_COLLISION_RADIUS = 0.4;
const NPC_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]; // 8 angles
const NPC_ANGLE_INCREMENT = 45;
const ROAD_WIDTH = 4; // Define road width globally
const PUNCH_DAMAGE_FRAME = 5; // Frame in punch animation where damage is applied
const PUNCH_HIT_RANGE = 1.0;    // How far the punch reaches
const HIT_IMPULSE_HORIZONTAL = 8.0;
const HIT_IMPULSE_VERTICAL = 5.0;
const POW_EFFECT_SCALE = 1.0;
const POW_EFFECT_DURATION = 0.5; // seconds
const AMBIENT_DUST_COUNT = 500; // Number of ambient dust particles
const AMBIENT_DUST_BOX_SIZE = 50; // How large is the area they spawn/exist in
const AMBIENT_DUST_SPEED = 0.1;  // How fast they drift
const SATURATION_MULTIPLIER = 1.3; // How much to multiply saturation by
const CAR_HIT_IMPULSE_HORIZONTAL = 15.0; // For car hitting NPC
const CAR_HIT_IMPULSE_VERTICAL = 7.0;   // For car hitting NPC
const CAR_REBOUND_SPEED = 5.0; // Speed at which car bounces off obstacles

// --- State ---
const GROUND_LEVEL_Y = SPRITE_SCALE / 2 - 0.075; // Store ground level calculation
const TREE_Y_POS = TREE_SCALE / 2 - 0.4; // Lower trees further
const GRASS_Y_POS = 0.005; // Slightly above ground, below road/trees
const CAR_Y_POS = CAR_SCALE / 2 - 2.5; // Lower car tiny bit more

let playerControlMode = 'character'; // 'character' or 'car'
let currentDrivingCar = null; // Reference to the car object being driven, or null

let character = {
    position: new THREE.Vector3(0, GROUND_LEVEL_Y, 0), // Use constant
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, -1), // Initial facing direction
    state: 'idle', // 'idle' or 'walk' or 'run' or 'jump' or 'punch'
    currentAngle: 0,
    currentFrame: 0,
    frameTime: 0,
    isOnGround: true,
    isPunching: false, // Add punching flag
    punchedThisAction: false, // Ensure punch hits only once
    jumpStartForward: new THREE.Vector3(0, 0, -1), // Store forward vector at jump start
    lastMovementForward: new THREE.Vector3(0, 0, -1) // Store forward vector from last move
};

let car = {
    position: new THREE.Vector3(2, CAR_Y_POS, -5), // Initial car position
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, -1), // Initial car facing direction (along -Z, matching angle=PI)
    angle: Math.PI, // Initial car angle (radians, matching forward vector)
    currentAngleSprite: 0, // The angle used for selecting sprite texture
    sprite: null, // To hold the car's Mesh object
    textures: {}, // { 0: tex, 22.5: tex, ... }
    baseY: CAR_Y_POS // Store the base Y position
};

// Add state for the second car
let car2 = {
    position: new THREE.Vector3(-5, CAR_Y_POS - 0.1, -10), // Different initial position, slightly lower
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, 1), // Initial facing direction (along +Z)
    angle: 0, // Initial car angle (radians, matching forward vector)
    currentAngleSprite: 0, // The angle used for selecting sprite texture
    sprite: null, // To hold the car's Mesh object
    textures: {}, // Separate textures object
    baseY: CAR_Y_POS - 0.1 // Store the base Y position for car 2
};

let keyboard = {}; // Keep track of pressed keys

// --- Textures & Objects State ---
let textures = {
    idle: {}, // { 0: [tex0, tex1, ...], 45: [...], ... }
    walk: {},  // { 0: [tex0, tex1, ...], 45: [...], ... }
    run: {},   // { 0: [tex0, tex1, ...], 45: [...], ... }
    jump: {},   // { 0: [tex0, tex1, ...], 45: [...], ... }
    punch: {}   // { 0: [tex0, tex1, ...], 45: [...], ... }
};
let treeTextures = {}; // { 0: tex, 22.5: tex, ... }
let treeSprites = [];  // Array to hold tree mesh objects
let treePositions = [ // Define positions for trees
    new THREE.Vector3(-10, TREE_Y_POS, -15),
    new THREE.Vector3(15, TREE_Y_POS, -10),
    new THREE.Vector3(-5, TREE_Y_POS, -25),
    new THREE.Vector3(10, TREE_Y_POS, -30),
    new THREE.Vector3(-18, TREE_Y_POS, -8),
];

let carTextures = {}; // Car Textures (renamed from car.textures)
let npcs = []; // Array to hold NPC state objects
let npcTextures = { idle: {}, walk: {} }; // NPC Textures
let grassTexture = null; // Single Grass Texture
let powTexture = null; // Texture for the POW effect
let activePowEffects = []; // Array for managing active POW sprites
let buildingTexture = null; // Texture for skyscrapers

// --- Loading State --- (Flags)
let texturesLoaded = false;
let treeTexturesLoaded = false;
let carTexturesLoaded = false;
let npcTexturesLoaded = false; // Add flag for NPC textures
let car2TexturesLoaded = false; // Add flag for Car 2 textures

// --- Loaders --- 
let textureLoader = new THREE.TextureLoader();

// --- Camera State --- 
let cameraHorizontalAngle = 0;
// Initialize vertical angle to character's angle
let cameraVerticalAngle = CAMERA_VERTICAL_ANGLE_CHARACTER_RAD;
let targetCameraVerticalAngle = CAMERA_VERTICAL_ANGLE_CHARACTER_RAD;

// --- Particle System State ---
let dustParticles = null; // THREE.Points object
let dustParticleGeometry = null;
let dustParticleMaterial = null;
let dustParticleData = []; // Array to manage individual particle info
let nextDustParticleIndex = 0;

// --- Ambient Dust State ---
let ambientDustParticles = null;
let ambientDustGeometry = null;
let ambientDustMaterial = null;
let ambientDustData = []; // Array to manage individual ambient particle info

// --- Skyscraper Positions --- 
const skyscraperPositions = [
    // Near start
    new THREE.Vector3(-15, 0, -10), 
    new THREE.Vector3( 15, 0, -15), 
    new THREE.Vector3(-10, 0, -30), 
    new THREE.Vector3( 20, 0, -25), 
    new THREE.Vector3(-25, 0, -20), 
    new THREE.Vector3( 25, 0, -40), 
    new THREE.Vector3(-30, 0, -5), 
    // Further out
    new THREE.Vector3( 35, 0, -60),
    new THREE.Vector3(-30, 0, -55),
    new THREE.Vector3( 10, 0, -80),
    new THREE.Vector3(-15, 0, -90),
    new THREE.Vector3( 40, 0, -110),
    new THREE.Vector3(-45, 0, -100),
    new THREE.Vector3( 30, 0, -130),
    new THREE.Vector3(-20, 0, -150),
    new THREE.Vector3( 50, 0, -170),
    new THREE.Vector3(-55, 0, -160),
];

// Moved function definition before init
function createSkyscrapers() {
    const geometryBase = new THREE.BoxGeometry(SKYSCRAPER_BASE_SIZE, 1, SKYSCRAPER_BASE_SIZE); // Height will be scaled

    if (!buildingTexture) {
        console.warn("Building texture not loaded, cannot create skyscrapers with texture.");
        // Optionally create basic grey skyscrapers as fallback?
        return;
    }

    for (const pos of skyscraperPositions) {
        const height = SKYSCRAPER_MIN_HEIGHT + Math.random() * (SKYSCRAPER_MAX_HEIGHT - SKYSCRAPER_MIN_HEIGHT);
        
        // Clone texture for unique repeat settings
        const uniqueBuildingTexture = buildingTexture.clone();
        uniqueBuildingTexture.needsUpdate = true; // Important!
        // Set repeat based on size - let's assume texture is designed for roughly 4x4 units
        const repeatX = SKYSCRAPER_BASE_SIZE / 4;
        const repeatY = height / 4;
        uniqueBuildingTexture.repeat.set(repeatX, repeatY);

        // Create unique material with building texture and slight color tint
        const tintValue = 0.8 + Math.random() * 0.2; // Light grey tint (0.8 to 1.0)
        const material = new THREE.MeshStandardMaterial({
             map: uniqueBuildingTexture, // Use the building texture
             color: new THREE.Color(tintValue, tintValue, tintValue), // Apply tint
             roughness: 0.95, 
             metalness: 0.0   
        });

        const skyscraper = new THREE.Mesh(geometryBase, material);
        
        // Scale the height
        skyscraper.scale.y = height;
        
        // Position the base on the ground (Y=0)
        skyscraper.position.set(pos.x, height / 2, pos.z); 

        scene.add(skyscraper);
    }
    console.log(`Created ${skyscraperPositions.length} skyscrapers.`);
}

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();

    // Load Skybox
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    const skyboxBasePath = '/skybox/';
    const skyboxUrls = [
        'Daylight Box_Right.bmp', // +X
        'Daylight Box_Left.bmp',  // -X
        'Daylight Box_Top.bmp',   // +Y
        'Daylight Box_Bottom.bmp',// -Y
        'Daylight Box_Front.bmp', // +Z
        'Daylight Box_Back.bmp'   // -Z
    ];
    const skyboxTexture = cubeTextureLoader.setPath(skyboxBasePath).load(skyboxUrls);
    scene.background = skyboxTexture;

    // Adjust Fog for darker/grittier feel - Further decrease density
    scene.fog = new THREE.FogExp2(0x333333, 0.025); // Density reduced from 0.030

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); // Adjust camera position for ground plane view
    camera.position.set(0, 5, 10); // Adjust camera position for ground plane view

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // Apply tone mapping for a more cinematic/gritty look
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.getElementById('app').appendChild(renderer.domElement);

    // Post-processing Composer
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Assign to the global bloomPass variable
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        BASE_BLOOM_STRENGTH, // Use updated lower base strength
        0.4, // radius (slightly smaller?)
        0.15  // threshold (slightly higher, less blooms)
    );
    composer.addPass(bloomPass);

    // Add Color Correction Pass for Saturation
    const colorCorrectionPass = new ShaderPass(ColorCorrectionShader);
    // Increase saturation by multiplying RGB values
    colorCorrectionPass.uniforms['mulRGB'].value.set(SATURATION_MULTIPLIER, SATURATION_MULTIPLIER, SATURATION_MULTIPLIER);
    // You could also adjust contrast/brightness here if needed:
    // colorCorrectionPass.uniforms['powRGB'].value.set( exponent, exponent, exponent ); // Affects contrast
    // colorCorrectionPass.uniforms['addRGB'].value.set( rAdd, gAdd, bAdd ); // Affects brightness offset
    composer.addPass(colorCorrectionPass);

    // Add OutputPass LAST for correct color space and tone mapping handling
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Lighting - Increase both ambient and directional
    const ambientLight = new THREE.AmbientLight(0xaaaaaa, 0.6); // Increased from 0.5
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6); // Increased from 0.4
    directionalLight.position.set(5, 10, 7.5); 
    scene.add(directionalLight);

    // Ground plane - Restore this
    const groundTexture = textureLoader.load('/textures/ground.webp'); // Load the texture
    groundTexture.wrapS = THREE.RepeatWrapping; // Enable horizontal wrapping
    groundTexture.wrapT = THREE.RepeatWrapping; // Enable vertical wrapping
    groundTexture.repeat.set(125, 275); // Adjust repeat for new larger size (250x550)

    const groundGeometry = new THREE.PlaneGeometry(250, 550); // Make ground larger
    // const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, side: THREE.DoubleSide }); // Grey ground
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        map: groundTexture, // Apply the texture map
        side: THREE.DoubleSide, 
        roughness: 0.9, // Increase roughness to reduce shine
        metalness: 0.1,  // Reduce metalness
        emissive: 0x222222, // Increase emissive color slightly (lighter grey)
        emissiveIntensity: 5.0 // Increase intensity further
    }); 
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Grass Texture (Load it here)
    grassTexture = textureLoader.load('/textures/grass.webp');
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(2, 2); // Adjust repeat as needed for patch size

    // Building Texture (Load it here)
    buildingTexture = textureLoader.load('/textures/building.webp');
    buildingTexture.wrapS = THREE.RepeatWrapping;
    buildingTexture.wrapT = THREE.RepeatWrapping;
    // Base repeat will be adjusted per skyscraper

    // Road plane
    const roadTexture = textureLoader.load('/textures/road.webp');
    roadTexture.wrapS = THREE.RepeatWrapping; // Repeat along the length
    roadTexture.wrapT = THREE.RepeatWrapping; // Repeat across the width (optional, could clamp)
    const roadLength = 500; // Make road much longer
    roadTexture.repeat.set(1, roadLength / ROAD_WIDTH); // Use global constant (changed to uppercase)

    const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, roadLength); // Use global constant
    const roadMaterial = new THREE.MeshStandardMaterial({
        map: roadTexture,
        side: THREE.DoubleSide, // Can be FrontSide if camera won't go below ground
        transparent: false, // Assuming road texture is opaque
        roughness: 0.9, // Increase roughness
        metalness: 0.1  // Reduce metalness
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2; // Lay it flat on the ground
    road.position.set(0, 0.01, -roadLength / 2 + 5); // Adjust position for new length
    scene.add(road);

    // --- Crossroads ---
    const crossroadWidth = ROAD_WIDTH; // Use global constant for consistency
    const crossroadLength = 100; // Make crossroads extend further
    const crossroadPositionsZ = [-20, -60, -100, -140, -180, -220]; // Add more crossroad positions

    for (const zPos of crossroadPositionsZ) {
        const crossroadTexture = roadTexture.clone(); // Clone texture for independent repetition
        crossroadTexture.needsUpdate = true; // Important when cloning textures
        crossroadTexture.repeat.set(1, crossroadLength / crossroadWidth); // Repeat along its length

        const crossroadGeometry = new THREE.PlaneGeometry(crossroadWidth, crossroadLength);
        const crossroadMaterial = new THREE.MeshStandardMaterial({
            map: crossroadTexture,
            side: THREE.DoubleSide,
            transparent: false,
            roughness: 0.9, // Increase roughness
            metalness: 0.1  // Reduce metalness
        });
        const crossroad = new THREE.Mesh(crossroadGeometry, crossroadMaterial);
        crossroad.rotation.x = -Math.PI / 2; // Lay flat
        crossroad.rotation.z = Math.PI / 2; // Rotate to be perpendicular
        crossroad.position.set(0, 0.01, zPos); // Position along the main road, slightly above ground
        scene.add(crossroad);
    }

    // Create Skyscrapers (Call remains here)
    createSkyscrapers();

    // Initialize Particle System (Car Dust)
    createDustParticles();
    // Initialize Ambient Dust System
    createAmbientDustParticles();

    // Load POW Texture
    powTexture = textureLoader.load('/sprites/effects/pow.webp');

    // Load Character Textures
    loadAllTextures().then(() => {
        console.log("Character textures loaded!");
        texturesLoaded = true;
        createCharacterSprite();
        return loadTreeTextures(); 
    }).then(() => {
        console.log("Tree textures loaded!");
        treeTexturesLoaded = true;
        createTrees();
        createGrassPatches();
        // Load car textures next
        return loadCarTextures();
    }).then(() => {
        console.log("Car textures loaded!");
        carTexturesLoaded = true;
        createCar(); // Create car after its textures are loaded
        // Load car 2 textures next
        return loadCar2Textures();
    }).then(() => {
        console.log("Car 2 textures loaded!");
        car2TexturesLoaded = true;
        createCar2(); // Create car 2 after its textures are loaded
        // Load NPC Textures
        return loadNpcTextures();
    }).then(() => {
        console.log("NPC textures loaded!");
        npcTexturesLoaded = true;
        createNpcs(); // Create NPCs after their textures are loaded
        if (!animationFrameId) {
            animate();
        }
    }).catch(err => {
        console.error("Error loading textures:", err);
    });

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // Add mouse move listener for camera control
    window.addEventListener('mousemove', onMouseMove);
    // Add click listener for pointer lock
    document.body.addEventListener('click', () => {
        // Check if pointer lock is already active or if the document cannot lock
        if(document.pointerLockElement !== renderer.domElement) {
            renderer.domElement.requestPointerLock().catch(err => {
                console.warn('Pointer lock request failed:', err);
            });
        }
    });
    // Add mousedown listener for punching
    window.addEventListener('mousedown', onMouseDown);
}

async function loadAllTextures() {
    const promises = [];
    const states = {
        idle: "1702ef2e-9e8b-4a54-b327-09cc1ba22ab3", 
        walk: "8f41066e-26b7-4dd1-9dde-14d95d92f55f",
        run: "399a15c9-b488-49ab-b4fd-3a447237a974",
        jump: "4468dfb8-c011-4b43-bbaa-765d32f52f4b",
        punch: "26ef782f-b3f7-4a71-83db-66d0fbeedd9d" // Add punch state prefix
    };

    console.log("Loading textures with prefixes:", states);

    // Vite handles the /public directory automatically
    const basePath = '/sprites/'; // Path relative to /public

    for (const [state, baseFileNamePart] of Object.entries(states)) {
        textures[state] = {};
        const statePath = `${basePath}${state}/`; // e.g., /sprites/idle/

        if (!baseFileNamePart) {
            console.error(`Missing filename prefix configuration for state: ${state}`);
            continue;
        }

        for (const angle of ANGLES) {
            textures[state][angle] = [];
            const angleString = String(angle).replace('.', '_');
            
            // Conditionally add _0 for directory name
            const angleDirName = angleString.includes('_') ? angleString : `${angleString}_0`;
            const anglePath = `${statePath}angle_${angleDirName}/`; // Use angleDirName

            for (let frame = 0; frame < FRAME_COUNT; frame++) {
                const framePadded = String(frame).padStart(4, '0');
                
                // Conditionally add the _0 based on whether angleString has an underscore
                const anglePartInFilename = angleString.includes('_') ? angleString : `${angleString}_0`;
                
                const fileName = `${baseFileNamePart}_angle_${anglePartInFilename}_${framePadded}.webp`;
                const filePath = anglePath + fileName;

                const promise = new Promise((resolve, reject) => {
                    // TextureLoader handles paths relative to the root or /public
                    textureLoader.load(filePath,
                        (texture) => {
                            texture.magFilter = THREE.LinearFilter; // Smoother look
                            texture.minFilter = THREE.LinearFilter;
                            textures[state][angle][frame] = texture;
                            resolve(texture);
                        },
                        undefined,
                        (err) => {
                            console.error(`Failed to load texture: ${filePath}`, err);
                            reject(new Error(`Failed to load texture: ${filePath}`));
                        }
                    );
                });
                promises.push(promise);
            }
        }
    }
    await Promise.all(promises);
}

async function loadTreeTextures() {
    const promises = [];
    const treePrefix = "a74120be-2c05-4551-8334-bea3dab1fa74";
    const basePath = '/sprites/objects/tree/'; // Path relative to /public
    const framePadded = '0000'; // Inanimate objects use only frame 0

    console.log(`Loading tree textures with prefix: ${treePrefix}`);

    for (const angle of ANGLES) {
        const angleString = String(angle).replace('.', '_');
        // Trees seem to use the same _0/_5 convention in filenames as characters
        const anglePartInFilename = angleString.includes('_') ? angleString : `${angleString}_0`;
        const fileName = `${treePrefix}_angle_${anglePartInFilename}_${framePadded}.webp`;
        const filePath = basePath + fileName;

        const promise = new Promise((resolve, reject) => {
            textureLoader.load(filePath,
                (texture) => {
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    treeTextures[angle] = texture;
                    resolve(texture);
                },
                undefined,
                (err) => {
                    console.error(`Failed to load tree texture: ${filePath}`, err);
                    // Don't reject the whole process, just skip this texture
                    resolve(null); 
                }
            );
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}

async function loadCarTextures() {
    const promises = [];
    const carPrefix = CAR_SPRITE_PREFIX; // Use the defined constant
    const basePath = '/sprites/car/'; // Path relative to /public
    const framePadded = '0000'; // Car is inanimate, use only frame 0

    console.log(`Loading car textures with prefix: ${carPrefix} for ${NUM_CAR_ANGLES} angles`);

    for (const angle of CAR_ANGLES) { // Iterate through the 64 angles
        // Format angle for filename (e.g., 5.625 -> 5_6, 11.25 -> 11_2, 0.0 -> 0_0)
        const angleFloor = Math.floor(angle);
        // Custom rounding: Use Math.round normally, but handle the .25 case specially
        const decimalPartTimes10 = (angle - angleFloor) * 10;
        let angleDecimal;
        // Check if the decimal part is extremely close to 2.5 (handles 11.25, 56.25, etc.)
        if (Math.abs(decimalPartTimes10 - 2.5) < 0.01) { 
            angleDecimal = 2; // Force to 2 for the .25 case, matching filenames
        } else {
            angleDecimal = Math.round(decimalPartTimes10); // Use standard rounding otherwise
        }
        const angleString = `${angleFloor}_${angleDecimal}`;

        const fileName = `${carPrefix}_angle_${angleString}_${framePadded}.webp`;
        const filePath = basePath + fileName;

        const promise = new Promise((resolve, reject) => {
            textureLoader.load(filePath,
                (texture) => {
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    // Use the angle number (float) as the key
                    car.textures[angle] = texture; 
                    resolve(texture);
                },
                undefined,
                (err) => {
                    console.error(`Failed to load car texture: ${filePath}`, err);
                    resolve(null); // Don't fail everything
                }
            );
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}

async function loadCar2Textures() {
    const promises = [];
    const carPrefix = CAR2_SPRITE_PREFIX; // Use the second car's prefix
    const basePath = '/sprites/car2/'; // Path relative to /public/sprites/car2/
    const framePadded = '0000'; // Car is inanimate, use only frame 0

    console.log(`Loading car 2 textures with prefix: ${carPrefix} for ${NUM_CAR_ANGLES} angles`);

    for (const angle of CAR_ANGLES) { // Iterate through the 64 angles
        // Format angle for filename (e.g., 5.625 -> 5_6, 11.25 -> 11_2, 0.0 -> 0_0)
        const angleFloor = Math.floor(angle);
        // Custom rounding: Use Math.round normally, but handle the .25 case specially
        const decimalPartTimes10 = (angle - angleFloor) * 10;
        let angleDecimal;
        if (Math.abs(decimalPartTimes10 - 2.5) < 0.01) { 
            angleDecimal = 2; 
        } else {
            angleDecimal = Math.round(decimalPartTimes10); 
        }
        const angleString = `${angleFloor}_${angleDecimal}`;

        const fileName = `${carPrefix}_angle_${angleString}_${framePadded}.webp`;
        const filePath = basePath + fileName;

        const promise = new Promise((resolve, reject) => {
            textureLoader.load(filePath,
                (texture) => {
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    // Use the angle number (float) as the key
                    car2.textures[angle] = texture; // Store in car2's texture object
                    resolve(texture);
                },
                undefined,
                (err) => {
                    console.error(`Failed to load car 2 texture: ${filePath}`, err);
                    resolve(null); // Don't fail everything
                }
            );
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}

async function loadNpcTextures() {
    const promises = [];
    const npcStates = {
        idle: "ab53bb77-f48c-4055-8e66-d8d56a26cdf4",
        walk: "c8db61a1-fda4-4f19-9db0-acdbcd2179de"
    };
    const basePath = '/sprites/npc/';
    const frameCount = NPC_FRAME_COUNT; 
    const angles = NPC_ANGLES;

    console.log("Loading NPC textures...");

    for (const [state, prefix] of Object.entries(npcStates)) {
        npcTextures[state] = {};
        const statePath = `${basePath}${state}/`; // e.g., /sprites/npc/walk/

        for (const angle of angles) {
            npcTextures[state][angle] = [];
            // NPC angles are always _0
            const angleDirName = `${angle}_0`; 
            const anglePath = `${statePath}angle_${angleDirName}/`;

            for (let frame = 0; frame < frameCount; frame++) {
                const framePadded = String(frame).padStart(4, '0');
                const fileName = `${prefix}_angle_${angleDirName}_${framePadded}.webp`;
                const filePath = anglePath + fileName;

                const promise = new Promise((resolve, reject) => {
                    textureLoader.load(filePath,
                        (texture) => {
                            texture.magFilter = THREE.LinearFilter;
                            texture.minFilter = THREE.LinearFilter;
                            npcTextures[state][angle][frame] = texture;
                            resolve(texture);
                        },
                        undefined,
                        (err) => {
                            console.warn(`Failed to load NPC texture: ${filePath}`, err);
                            // Don't reject, just resolve null so loading continues
                            resolve(null);
                        }
                    );
                });
                promises.push(promise);
            }
        }
    }
    try {
        await Promise.all(promises);
    } catch (error) {
        console.error("Error occurred during NPC texture loading, but continuing...");
    }
}

function createCharacterSprite() {
    // Use lastMovementForward.angle() if available, else default
    // TODO: Need to calculate initial angle from initial forward vector
    const initialAngle = 180; // Default based on initial forward (0,0,-1)
    const initialTexture = textures.idle[initialAngle]?.[0]; 
    if (!initialTexture) {
        console.error("Initial texture not available for character!");
        // Don't create the sprite if textures aren't ready
        return; 
    }

    const material = new THREE.MeshBasicMaterial({
        map: initialTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide
    });

    const geometry = new THREE.PlaneGeometry(SPRITE_SCALE, SPRITE_SCALE);
    characterSprite = new THREE.Mesh(geometry, material);
    characterSprite.position.copy(character.position);
    scene.add(characterSprite);
    console.log("Character sprite created at:", characterSprite.position);
}

function createTrees() {
    const initialTreeTexture = treeTextures[0]; // Use angle 0 initially
    if (!initialTreeTexture) {
        console.warn("Initial tree texture (angle 0) not loaded, cannot create trees.");
        return;
    }

    for (const position of treePositions) {
        const material = new THREE.MeshBasicMaterial({
            map: initialTreeTexture.clone(),
            transparent: true,
            alphaTest: 0.5, 
            side: THREE.DoubleSide,
            color: 0xaaaaaa // Add color tint to darken
        });
        const geometry = new THREE.PlaneGeometry(TREE_SCALE, TREE_SCALE);
        const treeSprite = new THREE.Mesh(geometry, material);
        treeSprite.position.copy(position); // Set position
        scene.add(treeSprite);
        treeSprites.push(treeSprite);
    }
    console.log(`Created ${treeSprites.length} trees.`);
}

function createGrassPatches() {
    if (!grassTexture) {
        console.warn("Grass texture not loaded, cannot create grass patches.");
        return;
    }

    for (const treePos of treePositions) {
        // Randomize scale slightly
        const randomScaleFactor = 0.8 + Math.random() * 0.4; // e.g., 80% to 120% of original
        const currentPatchScale = GRASS_PATCH_SCALE * randomScaleFactor;

        // Use CircleGeometry instead of PlaneGeometry
        // const grassGeometry = new THREE.PlaneGeometry(GRASS_PATCH_SCALE, GRASS_PATCH_SCALE);
        const grassGeometry = new THREE.CircleGeometry(currentPatchScale / 2, 32); // Radius is half the scale, 32 segments for smoothness
        
        const grassMaterial = new THREE.MeshStandardMaterial({
            map: grassTexture,
            side: THREE.DoubleSide, 
            roughness: 0.9, // Increase roughness
            metalness: 0.1  // Reduce metalness
            // Consider alphaTest if grass texture has transparency
            // transparent: true, 
            // alphaTest: 0.5 
        });
        const grassPatch = new THREE.Mesh(grassGeometry, grassMaterial);
        grassPatch.rotation.x = -Math.PI / 2; // Lay flat
        // Apply random rotation around the vertical axis (after laying flat)
        grassPatch.rotation.z = Math.random() * Math.PI * 2;
        
        // Use tree's X/Z but specific Y for grass
        grassPatch.position.set(treePos.x, GRASS_Y_POS, treePos.z);
        scene.add(grassPatch);
    }
    console.log(`Created ${treePositions.length} grass patches.`);
}

function createCar() {
    const initialCarTexture = car.textures[0]; // Start with angle 0 for car 1
    if (!initialCarTexture) {
        console.warn("Initial car texture (angle 0) not loaded, cannot create car.");
        return;
    }

    const material = new THREE.MeshBasicMaterial({
        map: initialCarTexture.clone(),
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        color: 0xaaaaaa // Add color tint to darken
    });
    const geometry = new THREE.PlaneGeometry(CAR_SCALE, CAR_SCALE * 0.6); // Adjust aspect ratio if needed
    car.sprite = new THREE.Mesh(geometry, material);
    car.sprite.position.copy(car.position);
    scene.add(car.sprite);
    console.log(`Created car at: ${car.position.x}, ${car.position.z}`);
}

// Create function for car 2
function createCar2() {
    const initialCarTexture = car2.textures[0]; // Start with angle 0 for car 2
    if (!initialCarTexture) {
        console.warn("Initial car 2 texture (angle 0) not loaded, cannot create car 2.");
        return;
    }

    const material = new THREE.MeshBasicMaterial({
        map: initialCarTexture.clone(),
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        // Keep blue car brighter
        // color: 0xaaaaaa 
    });
    const geometry = new THREE.PlaneGeometry(CAR_SCALE, CAR_SCALE * 0.6); // Use same scale for now
    car2.sprite = new THREE.Mesh(geometry, material);
    car2.sprite.position.copy(car2.position);
    scene.add(car2.sprite);
    console.log(`Created car 2 at: ${car2.position.x}, ${car2.position.z}`);
}

function createDustParticles() {
    dustParticleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_DUST_PARTICLES * 3);
    const colors = new Float32Array(MAX_DUST_PARTICLES * 3); // To control alpha via color

    // Initialize particle data array
    for (let i = 0; i < MAX_DUST_PARTICLES; i++) {
        dustParticleData.push({ 
            position: new THREE.Vector3(), 
            velocity: new THREE.Vector3(), 
            lifetime: 0, // 0 means inactive
            alpha: 0
        });
        // Initialize buffer attributes to 0
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        colors[i * 3] = 1; // R
        colors[i * 3 + 1] = 1; // G
        colors[i * 3 + 2] = 1; // B (alpha is handled by transparency + material opacity? Let's try vertex color alpha via transparency)
    }

    dustParticleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustParticleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    dustParticleMaterial = new THREE.PointsMaterial({
        size: 0.1,
        // map: dustTexture, // Optional: Use a texture
        vertexColors: true,
        transparent: true,
        opacity: 0.7, // Initial overall opacity
        blending: THREE.AdditiveBlending, // Make them glow slightly
        depthWrite: false // Prevent particles hiding each other oddly
    });

    dustParticles = new THREE.Points(dustParticleGeometry, dustParticleMaterial);
    scene.add(dustParticles);
    console.log("Dust particle system created.");
}

// --- Ambient Dust Functions ---
function createAmbientDustParticles() {
    ambientDustGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(AMBIENT_DUST_COUNT * 3);

    // Initialize particle data array
    for (let i = 0; i < AMBIENT_DUST_COUNT; i++) {
        const x = (Math.random() - 0.5) * AMBIENT_DUST_BOX_SIZE;
        const y = Math.random() * (AMBIENT_DUST_BOX_SIZE * 0.5); // Spawn lower half mostly
        const z = (Math.random() - 0.5) * AMBIENT_DUST_BOX_SIZE;
        
        ambientDustData.push({ 
            position: new THREE.Vector3(x, y, z), 
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * AMBIENT_DUST_SPEED * 0.1, // Very slow drift
                (Math.random() - 0.5) * AMBIENT_DUST_SPEED * 0.1, 
                (Math.random() - 0.5) * AMBIENT_DUST_SPEED * 0.1
            ),
            baseY: y // Store initial Y to maybe reset later or oscillate
        });
        // Initialize buffer attributes
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }

    ambientDustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    ambientDustMaterial = new THREE.PointsMaterial({
        size: 2, // Size in pixels when sizeAttenuation is false
        color: 0xaaaaaa, // Dim grey/brownish color
        transparent: true,
        opacity: 0.4, // Make them subtle
        blending: THREE.NormalBlending, // Not additive, just normal blend
        depthWrite: false, // Prevent particles hiding each other oddly
        sizeAttenuation: false // Prevent billboarding/scaling with distance
    });

    ambientDustParticles = new THREE.Points(ambientDustGeometry, ambientDustMaterial);
    // Add directly to the scene now, its position won't be updated frame-by-frame
    scene.add(ambientDustParticles); 
    console.log("Ambient dust particle system created.");
}

function updateAmbientDustParticles(deltaTime) {
    if (!ambientDustParticles) return;

    // Remove the lines that centered the particle system on the camera
    // ambientDustParticles.position.x = camera.position.x;
    // ambientDustParticles.position.z = camera.position.z;
    // Remove the check to add to scene, as it's added once in create...
    // if (!ambientDustParticles.parent) {
    //     scene.add(ambientDustParticles);
    // }

    const positions = ambientDustGeometry.attributes.position.array;
    const halfBox = AMBIENT_DUST_BOX_SIZE / 2;
    const boxHeight = AMBIENT_DUST_BOX_SIZE * 0.5; // Max height relative to particle system center

    for (let i = 0; i < AMBIENT_DUST_COUNT; i++) {
        const particle = ambientDustData[i];
        
        // Update position based on velocity
        particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

        // Simple wrapping logic within the box centered around the particle system's position
        if (particle.position.x > halfBox) particle.position.x -= AMBIENT_DUST_BOX_SIZE;
        if (particle.position.x < -halfBox) particle.position.x += AMBIENT_DUST_BOX_SIZE;
        if (particle.position.y > boxHeight) particle.position.y -= boxHeight; // Wrap Y within its range
        if (particle.position.y < 0) particle.position.y += boxHeight; // Wrap Y 
        if (particle.position.z > halfBox) particle.position.z -= AMBIENT_DUST_BOX_SIZE;
        if (particle.position.z < -halfBox) particle.position.z += AMBIENT_DUST_BOX_SIZE;

        // Update buffers
        positions[i * 3] = particle.position.x;
        positions[i * 3 + 1] = particle.position.y;
        positions[i * 3 + 2] = particle.position.z;
    }

    ambientDustGeometry.attributes.position.needsUpdate = true;
}

function createNpcs() {
    if (!npcTexturesLoaded) return;

    const npcScale = SPRITE_SCALE * 1.0; // Make NPCs same size as player
    const npcYPos = npcScale / 2 - 0.075; // Same ground logic as player

    for (let i = 0; i < NUM_NPCS; i++) {
        const startX = (Math.random() - 0.5) * 40; // Spread them out initially
        const startZ = -5 - Math.random() * 40;
        const startPos = new THREE.Vector3(startX, npcYPos, startZ);
        
        // Ensure they don't start on road
        if (Math.abs(startPos.x) < ROAD_WIDTH / 2 + 1) startPos.x += Math.sign(startPos.x || 1) * (ROAD_WIDTH / 2 + 2);

        const initialState = Math.random() < 0.5 ? 'idle' : 'walk';
        const initialAngle = NPC_ANGLES[Math.floor(Math.random() * NPC_ANGLES.length)];
        const initialTexture = npcTextures[initialState]?.[initialAngle]?.[0];
        
        if (!initialTexture) {
            console.warn(`Could not get initial texture for NPC ${i}, state: ${initialState}, angle: ${initialAngle}. Skipping.`);
            continue;
        }

        const material = new THREE.MeshBasicMaterial({
            map: initialTexture, 
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            color: 0xbbbbbb // Slightly different tint for NPCs
        });
        const geometry = new THREE.PlaneGeometry(npcScale, npcScale);
        const sprite = new THREE.Mesh(geometry, material);
        sprite.position.copy(startPos);
        scene.add(sprite);

        npcs.push({
            id: i,
            position: startPos,
            velocity: new THREE.Vector3(),
            forward: new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), initialAngle * Math.PI / 180),
            state: initialState,
            targetPosition: startPos.clone(), // Initially target current spot
            timeUntilNextDecision: NPC_MIN_DECISION_TIME + Math.random() * (NPC_MAX_DECISION_TIME - NPC_MIN_DECISION_TIME),
            currentAngle: initialAngle,
            currentFrame: 0,
            frameTime: 0,
            sprite: sprite,
        });
    }
    console.log(`Created ${npcs.length} NPCs.`);
}

// --- POW Effect Functions ---
function createPowEffect(position) {
    if (!powTexture) return;

    const material = new THREE.MeshBasicMaterial({
        map: powTexture,
        transparent: true,
        alphaTest: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 1.0
    });
    const geometry = new THREE.PlaneGeometry(POW_EFFECT_SCALE, POW_EFFECT_SCALE);
    const sprite = new THREE.Mesh(geometry, material);
    
    // Position slightly above the hit point
    sprite.position.copy(position);
    sprite.position.y += 0.5; 

    // Random initial tilt
    sprite.rotation.z = (Math.random() - 0.5) * 0.5;

    scene.add(sprite);

    activePowEffects.push({
        sprite: sprite,
        lifetime: POW_EFFECT_DURATION,
        timer: 0
    });
}

function updatePowEffects(deltaTime) {
    for (let i = activePowEffects.length - 1; i >= 0; i--) {
        const effect = activePowEffects[i];
        effect.lifetime -= deltaTime;
        effect.timer += deltaTime;

        if (effect.lifetime <= 0) {
            // Remove effect
            scene.remove(effect.sprite);
            // Dispose geometry and material if needed, though likely shared or minor overhead
            // effect.sprite.geometry.dispose(); 
            // effect.sprite.material.dispose();
            activePowEffects.splice(i, 1); // Remove from array
        } else {
            // Billboard
            effect.sprite.quaternion.copy(camera.quaternion);
            // Shake effect
            const shakeIntensity = 0.05;
            effect.sprite.position.x += (Math.random() - 0.5) * shakeIntensity;
            effect.sprite.position.y += (Math.random() - 0.5) * shakeIntensity;
            // Fade out
            effect.sprite.material.opacity = Math.max(0, effect.lifetime / POW_EFFECT_DURATION);
        }
    }
}

// --- Event Handlers ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    // Allow movement keys even if punching, but movement will be blocked in updateCharacter
    keyboard[event.code] = true;

    // Handle Jump (Takes priority over starting a punch)
    if (event.code === 'Space' && character.isOnGround && !character.isPunching) {
        character.velocity.y = JUMP_FORCE;
        character.isOnGround = false;
        character.jumpStartForward = character.forward.clone(); // Store current forward vector
        character.state = 'jump';
        // Reset jump animation frame?
        character.currentFrame = 0; 
        character.frameTime = 0;
    }

    // Handle Enter/Exit Car (Takes priority over starting a punch)
    if (event.code === 'KeyE') {
        if (playerControlMode === 'character' && !character.isPunching) {
            let enteredCar = null;
            // Check distance to car 1
            const distSqCar1 = character.position.distanceToSquared(car.position);
            if (distSqCar1 < INTERACTION_DISTANCE * INTERACTION_DISTANCE) {
                enteredCar = car;
                console.log("Near car 1");
            }
            // Check distance to car 2 (only if not already entering car 1)
            if (!enteredCar) {
                const distSqCar2 = character.position.distanceToSquared(car2.position);
                if (distSqCar2 < INTERACTION_DISTANCE * INTERACTION_DISTANCE) {
                    enteredCar = car2;
                    console.log("Near car 2");
                }
            }

            // If close to a car, enter it
            if (enteredCar) {
                playerControlMode = 'car';
                currentDrivingCar = enteredCar; // Set the currently driven car
                characterSprite.visible = false;
                // Optional: Reset car state (applies to the entered car)
                currentDrivingCar.velocity.set(0, 0, 0);
                
                // Snap camera behind the entered car
                cameraHorizontalAngle = currentDrivingCar.angle + Math.PI; 
                targetCameraVerticalAngle = CAMERA_VERTICAL_ANGLE_CAR_RAD;
                forceCameraUpdate(); // Force immediate camera update based on the new target

                console.log("Entered car", currentDrivingCar === car ? 1 : 2);
            }
        } else if (playerControlMode === 'car' && currentDrivingCar) { // Check if driving a car
            playerControlMode = 'character';
            targetCameraVerticalAngle = CAMERA_VERTICAL_ANGLE_CHARACTER_RAD;
            
            // Place character beside the car they were driving - Increase offset multiplier
            const offset = currentDrivingCar.forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0), Math.PI / 2).multiplyScalar(2.5); // Increased from 1.5
            character.position.copy(currentDrivingCar.position).add(offset);
            character.position.y = GROUND_LEVEL_Y; 
            character.velocity.set(0, 0, 0);
            character.state = 'idle'; 
            characterSprite.position.copy(character.position); 
            characterSprite.visible = true;
            
            // Reset driving car reference
            currentDrivingCar = null;
            console.log("Exited car");
        }
    }
}

function onKeyUp(event) {
    keyboard[event.code] = false;
}

function onMouseMove(event) {
    // Adjust horizontal angle based on mouse movement
    cameraHorizontalAngle -= event.movementX * MOUSE_SENSITIVITY;
    // Remove vertical angle adjustment
    // cameraVerticalAngle -= event.movementY * MOUSE_SENSITIVITY;

    // Remove clamping as the vertical angle is now fixed
    // cameraVerticalAngle = Math.max(-Math.PI / 4, Math.min(Math.PI / 3, cameraVerticalAngle)); 
}

// Add MouseDown handler
function onMouseDown(event) {
    // Check for left mouse button (button 0)
    if (event.button === 0 && playerControlMode === 'character' && character.isOnGround && !character.isPunching && character.state !== 'jump') {
        character.state = 'punch';
        character.isPunching = true;
        character.punchedThisAction = false; // Reset hit flag for this punch
        character.currentFrame = 0;
        character.frameTime = 0;
        // Stop any existing horizontal movement when punch starts
        character.velocity.x = 0;
        character.velocity.z = 0;
    }
}

// --- Update Logic ---
function updateCharacter(deltaTime) {
    if (!characterSprite || !texturesLoaded) return;

    // Apply Gravity (unless punching on ground)
    if (!character.isOnGround) {
        character.velocity.y -= GRAVITY * deltaTime;
    }

    // 1. Determine Horizontal Movement Intention
    let wantsToMoveHorizontally = false;
    let wantsToRun = false;
    const moveDirection = new THREE.Vector3();

    if (keyboard['ShiftLeft']) { 
        wantsToRun = true;
    }
    if (keyboard['KeyW'] || keyboard['KeyS'] || keyboard['KeyA'] || keyboard['KeyD']) {
         wantsToMoveHorizontally = true;
         // Re-calculate moveDirection based on current keys for state check on punch end
         if (keyboard['KeyW']) { moveDirection.z += 1; }
         if (keyboard['KeyS']) { moveDirection.z -= 1; }
         if (keyboard['KeyA']) { moveDirection.x -= 1; }
         if (keyboard['KeyD']) { moveDirection.x += 1; }
    }

    // 2. Update State (only if on ground and not punching/jumping)
    if (character.isOnGround && !character.isPunching && character.state !== 'jump') {
        if (wantsToMoveHorizontally) {
            character.state = wantsToRun ? 'run' : 'walk';
        } else {
            character.state = 'idle';
        }
    }

    // 3. Apply Horizontal Velocity (ONLY if not punching)
    if (!character.isPunching) {
        character.velocity.x = 0;
        character.velocity.z = 0;
        if (wantsToMoveHorizontally && character.state !== 'jump') { // Don't allow air control while jumping
            const speed = (character.isOnGround && wantsToRun) ? RUN_SPEED : MOVEMENT_SPEED;
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();
            const forward = cameraDirection.clone();
            const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
            const horizontalVelocity = new THREE.Vector3();
            horizontalVelocity.add(forward.multiplyScalar(moveDirection.z));
            horizontalVelocity.add(right.multiplyScalar(moveDirection.x));

            // Update character forward direction based on horizontal movement *before* applying speed
            if (horizontalVelocity.lengthSq() > 0.001) {
                character.forward.copy(horizontalVelocity).normalize();
                character.lastMovementForward.copy(character.forward); // Update last movement direction
            }
            
            // Apply speed to velocity
            horizontalVelocity.normalize().multiplyScalar(speed);
            character.velocity.x = horizontalVelocity.x;
            character.velocity.z = horizontalVelocity.z;
        }
    } // Else: velocity remains 0 if punching

    // 4. Collision Check (Always check potential position)
    const potentialPosition = character.position.clone().add(character.velocity.clone().multiplyScalar(deltaTime));
    let collisionDetected = false;
    // Tree collision check
    for (const treePos of treePositions) {
        const dxTree = potentialPosition.x - treePos.x;
        const dzTree = potentialPosition.z - treePos.z;
        const distSqTree = dxTree * dxTree + dzTree * dzTree;
        const radiiSumTree = CHARACTER_COLLISION_RADIUS + TREE_COLLISION_RADIUS;
        if (distSqTree < radiiSumTree * radiiSumTree) {
            collisionDetected = true;
            break; 
        }
    }

    // Car collision check (only if not already collided with tree)
    if (!collisionDetected && car.sprite) { // Check if car exists
        const dxCar = potentialPosition.x - car.position.x;
        const dzCar = potentialPosition.z - car.position.z;
        const distSqCar = dxCar * dxCar + dzCar * dzCar;
        const radiiSumCar = CHARACTER_COLLISION_RADIUS + CAR_COLLISION_RADIUS;
        if (distSqCar < radiiSumCar * radiiSumCar) {
            collisionDetected = true;
            // No break needed here as it's the last check
        }
    }
    // Add collision check for car 2
    if (!collisionDetected && car2.sprite) { // Check if car2 exists
        const dxCar2 = potentialPosition.x - car2.position.x;
        const dzCar2 = potentialPosition.z - car2.position.z;
        const distSqCar2 = dxCar2 * dxCar2 + dzCar2 * dzCar2;
        const radiiSumCar2 = CHARACTER_COLLISION_RADIUS + CAR_COLLISION_RADIUS; // Assume same radius
        if (distSqCar2 < radiiSumCar2 * radiiSumCar2) {
            collisionDetected = true;
        }
    }

    // Building collision check
    if (!collisionDetected) {
        if (isCollidingWithSkyscraper(potentialPosition, CHARACTER_COLLISION_RADIUS)) {
            collisionDetected = true;
        }
    }

    // 5. Update Position (only if no collision)
    if (!collisionDetected) {
        character.position.copy(potentialPosition);
    } else {
        // If collided while trying to move, stop velocity
        character.velocity.x = 0;
        character.velocity.z = 0;
    }

    // 5b. Ground Collision Check
    if (!character.isOnGround && character.position.y <= GROUND_LEVEL_Y) {
        character.position.y = GROUND_LEVEL_Y;
        character.velocity.y = 0;
        character.isOnGround = true;
        // Landed: transition to idle/walk/run based on keys, unless mid-punch
        if (!character.isPunching) { 
             if (wantsToMoveHorizontally) {
                 character.state = wantsToRun ? 'run' : 'walk';
             } else {
                 character.state = 'idle';
             }
        }
    }
    
    characterSprite.position.copy(character.position);

    // 6. Determine Correct Angle for Sprites
    const vecToCam = new THREE.Vector3().subVectors(camera.position, character.position);
    vecToCam.y = 0;
    vecToCam.normalize();

    // Determine which forward vector to use for sprite angle calculation
    let facingDirection;
    if (character.state === 'jump') {
        facingDirection = character.jumpStartForward.clone();
    } else { // idle, walk, run all use the last direction moved
        facingDirection = character.lastMovementForward.clone();
    }
    facingDirection.y = 0;
    // Normalize only if needed (should already be normalized)
    if (facingDirection.lengthSq() > 0.001) { 
        facingDirection.normalize();
    }

    const angleIncrement = 22.5; // Angle step for 16 directions
    const numAngles = ANGLES.length; // Should be 16

    // Calculate angle ONLY if vectors are valid
    if (facingDirection.lengthSq() > 0.001 && vecToCam.lengthSq() > 0.001) {
        const charAngleRad = Math.atan2(facingDirection.x, facingDirection.z);
        const camAngleRad = Math.atan2(vecToCam.x, vecToCam.z);
        let relativeAngleRad = charAngleRad - camAngleRad;
        relativeAngleRad = (relativeAngleRad + Math.PI * 3) % (Math.PI * 2) - Math.PI; // Normalize to -PI to PI
        let angleDeg = THREE.MathUtils.radToDeg(relativeAngleRad);
        angleDeg = (angleDeg + 360) % 360; // Normalize to [0, 360)
        angleDeg = (360 - angleDeg) % 360; // Apply mirroring fix
        const quantizedIndex = Math.round(angleDeg / angleIncrement) % numAngles;
        character.currentAngle = ANGLES[quantizedIndex];
    } // else: Keep previous angle if vectors are zero length

    // 7. Update Animation Frame & Punch Hit Check
    character.frameTime += deltaTime;
    let currentFrameDuration;
    switch (character.state) {
        case 'run': currentFrameDuration = RUN_FRAME_DURATION; break;
        case 'walk': currentFrameDuration = WALK_FRAME_DURATION; break;
        case 'jump': currentFrameDuration = JUMP_FRAME_DURATION; break;
        case 'punch': currentFrameDuration = PUNCH_FRAME_DURATION; break;
        default: currentFrameDuration = IDLE_FRAME_DURATION; break;
    }

    if (character.frameTime >= currentFrameDuration) {
        character.frameTime -= currentFrameDuration;
        const previousFrame = character.currentFrame;
        const nextFrame = (character.currentFrame + 1) % FRAME_COUNT;
        character.currentFrame = nextFrame; // Update frame first

        // --- Punch Hit Detection --- (On specific frame)
        if (character.state === 'punch' && previousFrame === PUNCH_DAMAGE_FRAME -1 && !character.punchedThisAction) {
            const checkOffset = character.forward.clone().multiplyScalar(PUNCH_HIT_RANGE * 0.5); // Check slightly in front
            const checkPos = character.position.clone().add(checkOffset);
            checkPos.y += 0.5; // Check slightly higher than feet
            
            for (const npc of npcs) {
                if (npc.state !== 'hit') { // Don't hit already hit NPCs
                    const distSq = checkPos.distanceToSquared(npc.position);
                    const hitRadius = PUNCH_HIT_RANGE + NPC_COLLISION_RADIUS;
                    if (distSq < hitRadius * hitRadius) {
                        console.log("Hit NPC!", npc.id);
                        npc.state = 'hit';
                        npc.velocity.copy(character.forward).multiplyScalar(HIT_IMPULSE_HORIZONTAL);
                        npc.velocity.y = HIT_IMPULSE_VERTICAL;
                        npc.timeUntilNextDecision = 10; // Prevent immediate decisions after being hit
                        createPowEffect(npc.position);
                        character.punchedThisAction = true; // Mark punch as landed
                        break; // Hit one NPC per punch
                    }
                }
            }
        }
        // --- End Punch Hit Detection ---

        // Check if punch animation finished
        if (character.state === 'punch' && nextFrame === 0) {
            character.isPunching = false;
            // Re-evaluate state after punch finishes
            if (wantsToMoveHorizontally) {
                 character.state = wantsToRun ? 'run' : 'walk';
             } else {
                 character.state = 'idle';
             }
            character.currentFrame = 0; // Reset frame for new state
        } 
    }

    // 8. Update Sprite Material
    const currentAnimationTextures = textures[character.state]?.[character.currentAngle];
    if (currentAnimationTextures && currentAnimationTextures[character.currentFrame]) {
        characterSprite.material.map = currentAnimationTextures[character.currentFrame];
        characterSprite.material.needsUpdate = true;
    } else {
        // Fallback if texture is missing (e.g., during initial load)
        const fallbackTexture = textures.idle?.[0]?.[0];
        if (fallbackTexture && characterSprite.material.map !== fallbackTexture) {
             characterSprite.material.map = fallbackTexture;
             characterSprite.material.needsUpdate = true;
        }
    }

    // 9. Billboard the sprite
    const lookAtTarget = new THREE.Vector3(camera.position.x, characterSprite.position.y, camera.position.z);
    characterSprite.lookAt(lookAtTarget);
}

function updateTrees(deltaTime) {
    if (!treeTexturesLoaded) return;

    const angleIncrement = 22.5; // Angle step for 16 directions
    const numAngles = ANGLES.length; // Should be 16

    for (const treeSprite of treeSprites) {
        // 1. Calculate Angle to Camera
        const vecToCam = new THREE.Vector3().subVectors(camera.position, treeSprite.position);
        vecToCam.y = 0; // Ignore vertical difference
        
        if (vecToCam.lengthSq() > 0.001) {
            vecToCam.normalize();
            const camAngleRad = Math.atan2(vecToCam.x, vecToCam.z);
            let angleDeg = THREE.MathUtils.radToDeg(camAngleRad);
            angleDeg = (angleDeg + 360) % 360; // Normalize to [0, 360)
            
            // Quantize to nearest angle
            const quantizedIndex = Math.round(angleDeg / angleIncrement) % numAngles;
            const quantizedAngle = ANGLES[quantizedIndex];
            
            // 2. Update Texture if needed
            const targetTexture = treeTextures[quantizedAngle];
            if (targetTexture && treeSprite.material.map !== targetTexture) {
                treeSprite.material.map = targetTexture;
                treeSprite.material.needsUpdate = true;
            }
        } // else keep current texture if camera is directly above/below

        // 3. Billboard the sprite
        const lookAtTarget = new THREE.Vector3(camera.position.x, treeSprite.position.y, camera.position.z);
        treeSprite.lookAt(lookAtTarget);
    }
}

function updateCar(drivingCar, deltaTime) { // Accept the car object being driven
    // No need for these checks now, called conditionally
    // if (!car.sprite || !carTexturesLoaded) return; 

    let accelerationInput = 0;
    let steeringInput = 0;

    // Input is always read when this function is called (because playerControlMode === 'car')
    if (keyboard['KeyW']) { accelerationInput = 1; }
    else if (keyboard['KeyS']) { accelerationInput = -1; }
    if (keyboard['KeyA']) { steeringInput = 1; }
    else if (keyboard['KeyD']) { steeringInput = -1; }
    
    // --- Physics (operate on drivingCar) ---
    const forwardSpeed = drivingCar.velocity.dot(drivingCar.forward);

    if (Math.abs(forwardSpeed) > 0.1) {
        const turnRate = CAR_TURN_SPEED * steeringInput * (forwardSpeed > 0 ? 1 : -1); 
        drivingCar.angle += turnRate * deltaTime;
        drivingCar.forward.set(Math.sin(drivingCar.angle), 0, Math.cos(drivingCar.angle)).normalize();
    }

    let accelerationForce = 0;
    if (accelerationInput > 0) { accelerationForce = CAR_ACCELERATION; }
    else if (accelerationInput < 0) {
        if (forwardSpeed > 0.1) { accelerationForce = -CAR_BRAKING; }
        else { accelerationForce = CAR_ACCELERATION * accelerationInput; }
    }

    const frictionForce = drivingCar.velocity.clone().multiplyScalar(-CAR_FRICTION);
    drivingCar.velocity.add(drivingCar.forward.clone().multiplyScalar(accelerationForce * deltaTime));
    drivingCar.velocity.add(frictionForce.clone().multiplyScalar(deltaTime));

    if (drivingCar.velocity.lengthSq() > MAX_CAR_SPEED * MAX_CAR_SPEED) {
        drivingCar.velocity.normalize().multiplyScalar(MAX_CAR_SPEED);
    }
    
    // Adjust Bloom Strength based on Speed of the driven car
    const currentSpeed = drivingCar.velocity.length();
    const speedFactor = Math.min(currentSpeed / MAX_CAR_SPEED, 1.0); 
    if (bloomPass) { 
        bloomPass.strength = BASE_BLOOM_STRENGTH + (MAX_BLOOM_STRENGTH - BASE_BLOOM_STRENGTH) * speedFactor;
    }

    const potentialPosition = drivingCar.position.clone().add(drivingCar.velocity.clone().multiplyScalar(deltaTime));
    let collisionDetected = false;
    // Collision check vs Trees
    for (const treePos of treePositions) {
        const dx = potentialPosition.x - treePos.x;
        const dz = potentialPosition.z - treePos.z;
        const distSqXZ = dx * dx + dz * dz; 
        const radiiSum = CAR_COLLISION_RADIUS + TREE_COLLISION_RADIUS;
        if (distSqXZ < radiiSum * radiiSum) {
            // Calculate rebound vector
            const reboundDir = drivingCar.position.clone().sub(treePos).normalize();
            reboundDir.y = 0; // Keep rebound horizontal
            drivingCar.velocity.copy(reboundDir).multiplyScalar(CAR_REBOUND_SPEED); // Apply rebound speed
            collisionDetected = true;
            break; 
        }
    }
    // Collision check vs the OTHER car
    const otherCar = (drivingCar === car) ? car2 : car;
    if (!collisionDetected && otherCar.sprite) {
        const dx = potentialPosition.x - otherCar.position.x;
        const dz = potentialPosition.z - otherCar.position.z;
        const distSqXZ = dx * dx + dz * dz;
        const radiiSum = CAR_COLLISION_RADIUS + CAR_COLLISION_RADIUS; // Car vs Car
        if (distSqXZ < radiiSum * radiiSum) {
             // Calculate rebound vector
             const reboundDir = drivingCar.position.clone().sub(otherCar.position).normalize();
             reboundDir.y = 0; // Keep rebound horizontal
             drivingCar.velocity.copy(reboundDir).multiplyScalar(CAR_REBOUND_SPEED); 
             // Maybe apply some force to the other car too?
             // const impulseDir = drivingCar.position.clone().sub(otherCar.position).normalize();
             // otherCar.velocity.add(impulseDir.multiplyScalar(-CAR_REBOUND_SPEED * 0.5)); // Push other car slightly less
             collisionDetected = true;
        }
    }
    // Collision check vs Buildings
    let buildingCollisionPoint = null; 
    if (!collisionDetected) { // Only check if no other collision detected yet
         buildingCollisionPoint = isCollidingWithSkyscraper(potentialPosition, CAR_COLLISION_RADIUS);
         if (buildingCollisionPoint) {
             // Calculate rebound vector from building center (approximation)
             const reboundDir = drivingCar.position.clone().sub(buildingCollisionPoint).normalize();
             reboundDir.y = 0; // Keep rebound horizontal
             drivingCar.velocity.copy(reboundDir).multiplyScalar(CAR_REBOUND_SPEED); 
             collisionDetected = true;
         }
    }

    // Update position ONLY if no collision occurred *this frame*
    if (!collisionDetected) {
        drivingCar.position.add(drivingCar.velocity.clone().multiplyScalar(deltaTime));
    } // Else: Position doesn't update, velocity is now the rebound velocity

    // Use the specific car's baseY for the ground check
    if (drivingCar.position.y < drivingCar.baseY) {
        drivingCar.position.y = drivingCar.baseY;
        drivingCar.velocity.y = 0; 
    }

    // --- Update Sprite --- (Visuals handled by updateCarVisuals now)
    // drivingCar.sprite.position.copy(drivingCar.position); // Position update still needed here?
    // Let updateCarVisuals handle this, it's called right after
    updateCarVisuals(drivingCar, deltaTime); // Update visuals of the driven car
}

// Renamed updateCar2 to updateCarVisuals and made it generic
function updateCarVisuals(carObj, deltaTime) { 
    if (!carObj.sprite) return; // Simplified check

    // --- Apply Friction --- (Moved from updateCar)
    // Apply friction regardless of whether car is driven
    const frictionForce = carObj.velocity.clone().multiplyScalar(-CAR_FRICTION);
    carObj.velocity.add(frictionForce.clone().multiplyScalar(deltaTime));

    // --- Update Position based on Velocity --- (Moved from updateCar)
    // Collision detection for non-driven cars isn't implemented here,
    // they might clip trees/other cars if left moving.
    // For now, just update position based on velocity.
    carObj.position.add(carObj.velocity.clone().multiplyScalar(deltaTime));

    // --- Ground Check --- (Moved from updateCar)
    if (carObj.position.y < carObj.baseY) {
        carObj.position.y = carObj.baseY;
        carObj.velocity.y = 0; 
    }

    // --- Update Sprite Position --- 
    carObj.sprite.position.copy(carObj.position);

    // --- Update Sprite Angle --- 
    const vecToCam = new THREE.Vector3().subVectors(camera.position, carObj.position);
    vecToCam.y = 0;
    
    if (vecToCam.lengthSq() > 0.001) {
        vecToCam.normalize();
        const carWorldAngleRad = carObj.angle; 
        const camAngleRad = Math.atan2(vecToCam.x, vecToCam.z);
        let relativeAngleRad = camAngleRad - carWorldAngleRad;
        relativeAngleRad = (relativeAngleRad + Math.PI * 4) % (Math.PI * 2); 
        let angleDeg = THREE.MathUtils.radToDeg(relativeAngleRad);
        
        const angleIncrement = CAR_ANGLE_INCREMENT;
        const numAngles = NUM_CAR_ANGLES;
        const quantizedIndex = Math.round(angleDeg / angleIncrement) % numAngles;
        carObj.currentAngleSprite = CAR_ANGLES[quantizedIndex]; 

        const targetTexture = carObj.textures[carObj.currentAngleSprite];
        if (targetTexture && carObj.sprite.material.map !== targetTexture) {
            carObj.sprite.material.map = targetTexture;
            carObj.sprite.material.needsUpdate = true;
        }
    } // else: Angle calc skipped if camera is directly above/below

    // Billboard the sprite using lookAt (Moved outside the if block)
    // Correct the lookAt target to use camera's Z position
    const lookAtTarget = new THREE.Vector3(camera.position.x, carObj.sprite.position.y, camera.position.z); 
    carObj.sprite.lookAt(lookAtTarget);
}

// Force camera update (used for snapping)
function forceCameraUpdate() {
    if (!camera) return;

    let currentTargetPos;
    let offsetToUse;
    if (playerControlMode === 'car' && currentDrivingCar) { // Use currentDrivingCar
        currentTargetPos = currentDrivingCar.position.clone().add(CAMERA_TARGET_OFFSET);
        offsetToUse = CAMERA_OFFSET_CAR; // Use car offset
    } else if (playerControlMode === 'character' && character) {
        currentTargetPos = character.position.clone().add(CAMERA_TARGET_OFFSET);
        offsetToUse = CAMERA_OFFSET; // Use character offset
    } else {
        return; // No valid target
    }
    const targetPos = currentTargetPos;

    const rotationY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraHorizontalAngle);
    const rotationX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), cameraVerticalAngle);
    const cameraRotation = new THREE.Quaternion().multiplyQuaternions(rotationY, rotationX);
    const desiredOffset = offsetToUse.clone().applyQuaternion(cameraRotation);
    const desiredPosition = targetPos.clone().add(desiredOffset);

    // Clamp Y position
    if (desiredPosition.y < CAMERA_MIN_Y) {
        desiredPosition.y = CAMERA_MIN_Y;
    }

    // Set camera position directly
    camera.position.copy(desiredPosition);
    camera.lookAt(targetPos);
}

function updateCamera(deltaTime) {
    if (!camera) return;
    
    let currentTargetPos;
    let isDriving = false;
    let offsetToUse = CAMERA_OFFSET; // Default to character offset
    if (playerControlMode === 'car' && currentDrivingCar) { // Use currentDrivingCar
        currentTargetPos = currentDrivingCar.position.clone().add(CAMERA_TARGET_OFFSET);
        isDriving = true;
        offsetToUse = CAMERA_OFFSET_CAR; // Use car offset
    } else if (playerControlMode === 'character' && character) {
        currentTargetPos = character.position.clone().add(CAMERA_TARGET_OFFSET);
    } else {
        return; // No valid target
    }

    const targetPos = currentTargetPos;

    // --- Update Camera Angles ---
    let finalHorizontalAngle = cameraHorizontalAngle;
    if (isDriving && currentDrivingCar) { // Check currentDrivingCar exists
        // Target angle is PI radians opposite the car's angle (to look from behind)
        const targetHorizontalAngle = currentDrivingCar.angle + Math.PI; 

        // Lerp horizontal angle towards target angle
        // Need to handle angle wrapping correctly for lerp
        const currentAngle = cameraHorizontalAngle;
        const shortestAngle = Math.atan2(Math.sin(targetHorizontalAngle - currentAngle), Math.cos(targetHorizontalAngle - currentAngle));
        const angleLerpFactor = 1.0 - Math.exp(-CAMERA_ANGLE_FOLLOW_SPEED * deltaTime);
        cameraHorizontalAngle += shortestAngle * angleLerpFactor;
        finalHorizontalAngle = cameraHorizontalAngle; // Use the lerped angle
    } // else: Use the mouse-controlled angle

    // Smoothly interpolate the actual vertical angle towards the target
    const verticalLerpFactor = 1.0 - Math.exp(-CAMERA_VERTICAL_SMOOTH_SPEED * deltaTime);
    cameraVerticalAngle = THREE.MathUtils.lerp(cameraVerticalAngle, targetCameraVerticalAngle, verticalLerpFactor);

    // Use the interpolated vertical angle
    const finalVerticalAngle = cameraVerticalAngle;

    // --- Calculate Camera Position ---
    // 2. Calculate Rotation based on Final Angles
    const rotationY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), finalHorizontalAngle);
    const rotationX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), finalVerticalAngle);
    const cameraRotation = new THREE.Quaternion().multiplyQuaternions(rotationY, rotationX);

    // 3. Calculate Desired Camera Position
    const desiredOffset = offsetToUse.clone().applyQuaternion(cameraRotation);
    const desiredPosition = targetPos.clone().add(desiredOffset);

    // 4. Prevent Camera Floor Clipping
    if (desiredPosition.y < CAMERA_MIN_Y) {
        desiredPosition.y = CAMERA_MIN_Y;
    }

    // 5. Smoothly Interpolate Camera Position
    const lerpFactor = 1.0 - Math.exp(-CAMERA_SMOOTH_SPEED * deltaTime);
    if (deltaTime > 0) { 
         camera.position.lerp(desiredPosition, lerpFactor);
    }
   
    // 6. Look At Target
    camera.lookAt(targetPos);
}

function updateNpcs(deltaTime) {
    if (!npcTexturesLoaded) return;

    const angleIncrement = NPC_ANGLE_INCREMENT;
    const numAngles = NPC_ANGLES.length;
    const npcYPos = (SPRITE_SCALE * 1.0) / 2 - 0.075; // Recalculate based on scale used in createNpcs

    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];

        // --- Handle Hit State --- 
        if (npc.state === 'hit') {
            // Apply gravity
            npc.velocity.y -= GRAVITY * deltaTime;
            // Update position
            npc.position.add(npc.velocity.clone().multiplyScalar(deltaTime));
            npc.sprite.position.copy(npc.position);
            // Check for ground hit
            if (npc.position.y <= npcYPos) {
                npc.position.y = npcYPos;
                npc.velocity.set(0,0,0);
                npc.state = 'idle'; // TODO: Maybe a downed state?
                npc.currentFrame = 0;
                npc.frameTime = 0;
                npc.timeUntilNextDecision = 1.0 + Math.random() * 2.0; // Recover quickly
            }
            // Billboarding (still needed)
            const lookAtTarget = new THREE.Vector3(camera.position.x, npc.sprite.position.y, camera.position.z);
            npc.sprite.lookAt(lookAtTarget);
            continue; // Skip normal logic if hit
        }

        // --- Decision Making (only if not hit) ---
        npc.timeUntilNextDecision -= deltaTime;
        if (npc.timeUntilNextDecision <= 0) {
            const newState = Math.random() < 0.6 ? 'walk' : 'idle'; // Bias towards walking
            npc.state = newState;
            npc.currentFrame = 0; // Reset frame on state change
            npc.frameTime = 0;

            if (newState === 'walk') {
                // Set fixed forward direction for walking (+Z axis = 0 degrees)
                npc.forward.set(0, 0, 1);
                // Removed random target position calculation
            } else { // Idle
                npc.velocity.set(0, 0, 0);
                // Optionally keep the forward vector from the last walk? Or reset?
                // Let's keep the last forward vector for idle state angle calculation.
                npc.targetPosition.copy(npc.position); // No target when idle
            }
            npc.timeUntilNextDecision = NPC_MIN_DECISION_TIME + Math.random() * (NPC_MAX_DECISION_TIME - NPC_MIN_DECISION_TIME);
        }

        // --- Movement (only if not hit) ---
        // let targetReached = false; // Removed targetReached logic
        if (npc.state === 'walk') {
            // Always move in the fixed forward direction
            npc.velocity.copy(npc.forward).multiplyScalar(NPC_WALK_SPEED);
            // Removed target checking logic, NPC walks until decision timer changes state or collision
        }

        // --- Collision Check (only if not hit) ---
        const potentialPosition = npc.position.clone().add(npc.velocity.clone().multiplyScalar(deltaTime));
        let collisionDetected = false;
        // Vs Trees
        for (const treePos of treePositions) {
            const radiiSum = NPC_COLLISION_RADIUS + TREE_COLLISION_RADIUS;
            if (potentialPosition.distanceToSquared(treePos) < radiiSum * radiiSum) {
                collisionDetected = true; break;
            }
        }
        // Vs Car
        if (!collisionDetected && car.sprite && currentDrivingCar !== car) {
             const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS;
             const distSq = potentialPosition.distanceToSquared(car.position);
             if (distSq < radiiSum * radiiSum) {
                 collisionDetected = true;
                 // --- Static Car 1 Hit NPC Logic --- 
                 if (npc.state !== 'hit') { 
                     console.log("Static Car 1 hit NPC!", npc.id);
                     npc.state = 'hit';
                     // Impulse from car's forward (or default if static)
                     let impulseDirection = car.forward.clone(); 
                     if(impulseDirection.lengthSq() < 0.01) impulseDirection.set(0,0,1); // Default impulse
                     impulseDirection.normalize();
                     npc.velocity.copy(impulseDirection).multiplyScalar(CAR_HIT_IMPULSE_HORIZONTAL * 0.5); // Less impulse
                     npc.velocity.y = CAR_HIT_IMPULSE_VERTICAL * 0.5;
                     npc.timeUntilNextDecision = 10; 
                     createPowEffect(npc.position);
                     npc.position.add(npc.velocity.clone().multiplyScalar(deltaTime)); 
                     npc.sprite.position.copy(npc.position);
                 }
              }
         }
         // Vs Car 2
         if (!collisionDetected && car2.sprite && currentDrivingCar !== car2) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(car2.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- Static Car 2 Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("Static Car 2 hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = car2.forward.clone();
                      if(impulseDirection.lengthSq() < 0.01) impulseDirection.set(0,0,1);
                      impulseDirection.normalize();
                      npc.velocity.copy(impulseDirection).multiplyScalar(CAR_HIT_IMPULSE_HORIZONTAL * 0.5);
                      npc.velocity.y = CAR_HIT_IMPULSE_VERTICAL * 0.5;
                      npc.timeUntilNextDecision = 10; 
                      createPowEffect(npc.position);
                      npc.position.add(npc.velocity.clone().multiplyScalar(deltaTime)); 
                      npc.sprite.position.copy(npc.position);
                  }
               }
          }
         // Vs DRIVEN Car (if any)
         if (!collisionDetected && playerControlMode === 'car' && currentDrivingCar && currentDrivingCar.sprite) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(currentDrivingCar.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- DRIVEN Car Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("DRIVEN Car hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = currentDrivingCar.velocity.clone(); 
                      if (impulseDirection.lengthSq() < 0.01) {
                          impulseDirection = currentDrivingCar.forward.clone();
                      }
                      impulseDirection.normalize();
                      npc.velocity.copy(impulseDirection).multiplyScalar(CAR_HIT_IMPULSE_HORIZONTAL);
                      npc.velocity.y = CAR_HIT_IMPULSE_VERTICAL; 
                      npc.timeUntilNextDecision = 10; 
                      createPowEffect(npc.position);
                      npc.position.add(npc.velocity.clone().multiplyScalar(deltaTime)); 
                      npc.sprite.position.copy(npc.position);
                  }
                  // --- End DRIVEN Car Hit NPC Logic ---
               }
          }
         // Vs Player
        if (!collisionDetected && playerControlMode === 'character') {
             const radiiSum = NPC_COLLISION_RADIUS + CHARACTER_COLLISION_RADIUS;
             if (potentialPosition.distanceToSquared(character.position) < radiiSum * radiiSum) {
                collisionDetected = true;
             }
        }
        // Vs Other NPCs
        if (!collisionDetected) {
            for (let j = 0; j < npcs.length; j++) {
                if (i === j) continue; // Don't check self
                const otherNpc = npcs[j];
                const radiiSum = NPC_COLLISION_RADIUS + NPC_COLLISION_RADIUS;
                if (potentialPosition.distanceToSquared(otherNpc.position) < radiiSum * radiiSum) {
                    collisionDetected = true; break;
                }
            }
        }
        // Vs Buildings
        if (!collisionDetected) {
            if (isCollidingWithSkyscraper(potentialPosition, NPC_COLLISION_RADIUS)) {
                collisionDetected = true;
            }
        }
        
        // --- Position Update (only if not hit) ---
        if (!collisionDetected) {
            npc.position.add(npc.velocity.clone().multiplyScalar(deltaTime));
        } else {
             // Stop velocity ONLY if collision detected AND npc is NOT in the hit state
             // This prevents the car hit impulse from being immediately zeroed.
            if (npc.state !== 'hit') { 
                npc.velocity.set(0, 0, 0); // Stop if collision
            }
             if (npc.state === 'walk') { // If walking and collided, choose new target soon
                 npc.timeUntilNextDecision = 0.2 + Math.random() * 0.5;
                 // npc.targetPosition.copy(npc.position); // No target concept anymore
             }
        }
        npc.sprite.position.copy(npc.position);

        // --- Animation ---
        if (npc.state !== 'hit') { // Only update animation frame if not in hit state
            npc.frameTime += deltaTime;
            const currentFrameDuration = npc.state === 'idle' ? NPC_IDLE_FRAME_DURATION : NPC_WALK_FRAME_DURATION;
            if (npc.frameTime >= currentFrameDuration) {
                npc.frameTime -= currentFrameDuration;
                npc.currentFrame = (npc.currentFrame + 1) % NPC_FRAME_COUNT;
            }
        }

        // --- Angle Calculation ---
        // Skip angle recalculation if the NPC is in the 'hit' state to preserve the pre-hit angle
        if (npc.state !== 'hit') {
            const vecToCam = new THREE.Vector3().subVectors(camera.position, npc.position);
            vecToCam.y = 0;
            vecToCam.normalize();
            const facingDirection = npc.forward.clone(); // Use NPC's forward vector (now fixed when walking)
            facingDirection.y = 0;
            if (facingDirection.lengthSq() === 0) facingDirection.z = -1; // Default if no direction (e.g., initial idle)
            facingDirection.normalize();

            if (facingDirection.lengthSq() > 0.001 && vecToCam.lengthSq() > 0.001) {
                const npcAngleRad = Math.atan2(facingDirection.x, facingDirection.z);
                const camAngleRad = Math.atan2(vecToCam.x, vecToCam.z);
                let relativeAngleRad = npcAngleRad - camAngleRad;
                relativeAngleRad = (relativeAngleRad + Math.PI * 3) % (Math.PI * 2) - Math.PI; // Normalize -PI to PI
                let angleDeg = THREE.MathUtils.radToDeg(relativeAngleRad);
                angleDeg = (angleDeg + 360) % 360; // Normalize 0-360
                
                // Quantize to nearest NPC angle (45 degree increments)
                const quantizedIndex = Math.round(angleDeg / angleIncrement) % numAngles;
                npc.currentAngle = NPC_ANGLES[quantizedIndex];
            } // else keep previous angle
        } // End of check for npc.state !== 'hit' for angle calculation

        // --- Texture Update ---
        // Always update texture based on current state, angle, and frame
        const stateTextures = npcTextures[npc.state]; // Use npcTextures, not textures
        if (stateTextures && stateTextures[npc.currentAngle] && stateTextures[npc.currentAngle][npc.currentFrame]) {
            npc.sprite.material.map = stateTextures[npc.currentAngle][npc.currentFrame];
            npc.sprite.material.needsUpdate = true;
        } else {
             // Fallback if texture missing
             const fallbackTexture = npcTextures.idle?.[0]?.[0]; 
             if (fallbackTexture && npc.sprite.material.map !== fallbackTexture) {
                  npc.sprite.material.map = fallbackTexture;
                  npc.sprite.material.needsUpdate = true;
             }
        }

        // --- Billboarding (only if not hit) ---
        const lookAtTarget = new THREE.Vector3(camera.position.x, npc.sprite.position.y, camera.position.z);
        npc.sprite.lookAt(lookAtTarget);
    }
}

// --- Animation Loop ---
let animationFrameId = null;
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    // Update camera position and rotation
    updateCamera(deltaTime);

    if (texturesLoaded && playerControlMode === 'character') {
        updateCharacter(deltaTime);
    }
    if (treeTexturesLoaded) {
        updateTrees(deltaTime);
    }
    
    // Update the currently driven car (if any)
    if (playerControlMode === 'car' && currentDrivingCar) {
        updateCar(currentDrivingCar, deltaTime);
    } else {
        // Reset bloom if not driving
        if (bloomPass && bloomPass.strength !== BASE_BLOOM_STRENGTH) {
            bloomPass.strength = BASE_BLOOM_STRENGTH;
        }
    }
    
    // Update visuals for non-driven cars
    if (carTexturesLoaded && currentDrivingCar !== car) {
        updateCarVisuals(car, deltaTime);
    }
    if (car2TexturesLoaded && currentDrivingCar !== car2) {
        updateCarVisuals(car2, deltaTime);
    }

    if (npcTexturesLoaded) { // Update NPCs
        updateNpcs(deltaTime);
    }
    
    // Update particles (Car Dust)
    updateParticles(deltaTime);
    // Update Ambient Dust
    updateAmbientDustParticles(deltaTime);
    updatePowEffects(deltaTime); // Add call to update POW effects

    composer.render(); 
}

function emitDustParticle() {
    const particle = dustParticleData[nextDustParticleIndex];

    // Calculate emission position behind the car
    const rearOffset = car.forward.clone().negate().multiplyScalar(CAR_SCALE * 0.4); // Offset from car center
    particle.position.copy(car.position).add(rearOffset);
    particle.position.y = CAR_Y_POS + 0.1; // Start slightly above car base

    // Calculate velocity (mostly up and back, with spread)
    const spread = 1.5;
    particle.velocity.set(
        (Math.random() - 0.5) * spread, 
        Math.random() * 1.0 + 0.5, // Upwards bias
        (Math.random() - 0.5) * spread 
    );
    // Add some velocity opposite to car's forward movement
    particle.velocity.add(car.forward.clone().negate().multiplyScalar(1.0 + Math.random()));
    // Add small component of car's actual velocity
    particle.velocity.add(car.velocity.clone().multiplyScalar(0.1)); 

    particle.lifetime = DUST_PARTICLE_LIFETIME * (0.8 + Math.random() * 0.4); // Randomize lifetime slightly
    particle.alpha = 1.0; // Start fully visible

    // Update the specific particle's position in the buffer
    const i = nextDustParticleIndex;
    dustParticleGeometry.attributes.position.setXYZ(i, particle.position.x, particle.position.y, particle.position.z);
    // Initial color (white)
    dustParticleGeometry.attributes.color.setXYZ(i, 1, 1, 1); 

    nextDustParticleIndex = (nextDustParticleIndex + 1) % MAX_DUST_PARTICLES; // Cycle through particles
}

function updateParticles(deltaTime) {
    if (!dustParticles) return;

    // Emit new particles if driving
    if (playerControlMode === 'car') {
        const speed = car.velocity.length();
        const particlesToEmit = Math.floor(speed * DUST_EMISSION_RATE_PER_SPEED * deltaTime);
        for (let i = 0; i < particlesToEmit; i++) {
            emitDustParticle();
        }
    }

    const positions = dustParticleGeometry.attributes.position.array;
    const colors = dustParticleGeometry.attributes.color.array;
    let aliveParticles = 0;

    for (let i = 0; i < MAX_DUST_PARTICLES; i++) {
        const particle = dustParticleData[i];
        if (particle.lifetime > 0) {
            particle.lifetime -= deltaTime;
            if (particle.lifetime <= 0) {
                // Particle died
                particle.alpha = 0;
            } else {
                // Update position
                particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
                // Apply simple gravity/drag maybe?
                particle.velocity.y -= 0.5 * deltaTime; // Simple downward drift
                
                // Fade out alpha based on lifetime
                particle.alpha = particle.lifetime / DUST_PARTICLE_LIFETIME;

                // Update buffers
                positions[i * 3] = particle.position.x;
                positions[i * 3 + 1] = particle.position.y;
                positions[i * 3 + 2] = particle.position.z;
                // Update color alpha (using RGB for now, as PointsMaterial opacity is global)
                const alphaClamped = Math.max(0, Math.min(1, particle.alpha)) * 0.8; // Use 0.8 factor for base opacity
                colors[i * 3] = alphaClamped;
                colors[i * 3 + 1] = alphaClamped;
                colors[i * 3 + 2] = alphaClamped;
                aliveParticles++;
            }
        } else {
            // Ensure dead particles are invisible in buffers
            if(colors[i * 3] !== 0) { // Only update if not already 0
                positions[i * 3 + 1] = -1000; // Move dead particles far away
                colors[i * 3] = 0;
                colors[i * 3 + 1] = 0;
                colors[i * 3 + 2] = 0;
            }
        }
    }

    // Only update buffers if particles were alive or state changed
    if (aliveParticles > 0 || dustParticleGeometry.attributes.position.needsUpdate) {
        dustParticleGeometry.attributes.position.needsUpdate = true;
        dustParticleGeometry.attributes.color.needsUpdate = true;
    }

}

// --- Start ---
init(); 

// --- Collision Helper Functions ---
function isCollidingWithSkyscraper(position, radius) {
    const halfBase = SKYSCRAPER_BASE_SIZE / 2;
    for (const buildingPos of skyscraperPositions) {
        const minX = buildingPos.x - halfBase;
        const maxX = buildingPos.x + halfBase;
        const minZ = buildingPos.z - halfBase;
        const maxZ = buildingPos.z + halfBase;

        // Check Circle vs AABB collision (Simplified XZ check)
        const closestX = Math.max(minX, Math.min(position.x, maxX));
        const closestZ = Math.max(minZ, Math.min(position.z, maxZ));
        const distanceSq = (position.x - closestX) ** 2 + (position.z - closestZ) ** 2;
        
        if (distanceSq < radius * radius) {
            return buildingPos; // Return the position of the collided building
        }
    }
    return null; // No collision
}