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
// Import Water
import { Water } from 'three/examples/jsm/objects/Water.js';

let scene, camera, renderer;
let composer;
let bloomPass; // Declare bloomPass in the global scope
let characterSprite;
let clock = new THREE.Clock();
let crtPass; // Add variable for CRT pass
let isCrtEnabled = false; // State for CRT effect
let isLeftMouseDown = false;
let aimVerticalAngle = null;
let crosshairVerticalOffset = 0; // <-- Add this line to define and initialize
let activePoofEffects = [];
const POOF_LIFETIME = 0.7;

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
const CAR3_SPRITE_PREFIX = "0ec4b50a-30a0-4c57-a8aa-3a92326f1d5a"; // Prefix for car3
const CAR4_SPRITE_PREFIX = "99ea0672-e725-492e-b3e7-77fce135ee7c"; // Prefix for car4
const CAR5_SPRITE_PREFIX = "47d3ec38-0b11-4ddc-911b-8040d9cff939"; // Prefix for car5
const CAR6_SPRITE_PREFIX = "890f9dba-c49b-4ff5-812a-bd64c3b5fd19"; // Prefix for car6
const CAR7_SPRITE_PREFIX = "a44609b0-07fe-4d3c-aed6-85a681fe78e1"; // Prefix for car7
const CAR8_SPRITE_PREFIX = "5f43375b-a740-48e5-b8c6-22e371a63e27"; // Prefix for car8
const CAR9_SPRITE_PREFIX = "221f90e0-2acd-47a4-afa2-14a485bceb1c"; // Prefix for car9
const NUM_CAR_ANGLES = 64;
const CAR_ANGLE_INCREMENT = 360 / NUM_CAR_ANGLES; // 5.625 degrees
// Generate the 64 angles for the car (reused for both)
const CAR_ANGLES = Array.from({ length: NUM_CAR_ANGLES }, (_, i) => i * CAR_ANGLE_INCREMENT);

// Define similar constants for Tree angles
const NUM_TREE_ANGLES = 64;
const TREE_ANGLE_INCREMENT = 360 / NUM_TREE_ANGLES; // 5.625 degrees
const TREE_ANGLES = Array.from({ length: NUM_TREE_ANGLES }, (_, i) => i * TREE_ANGLE_INCREMENT);

const CAMERA_TARGET_OFFSET = new THREE.Vector3(0, 1.0, 0); // Look slightly above character feet
const CAMERA_OFFSET = new THREE.Vector3(0, 1.6, 1.8); // Zoom even closer (for character)
// Increase Y offset for car to raise camera height
const CAMERA_OFFSET_CAR = new THREE.Vector3(0, 3.5, 2.0); // Y decreased from 4.5 to 3.5 to lower camera
const CAMERA_MIN_Y = 0.5; // Minimum height camera can go (prevent floor clipping)
const CAMERA_SMOOTH_SPEED = 8.0; // Increased from 5.0 for snappier response
const CAMERA_ANGLE_FOLLOW_SPEED = 8.0; // Increased from 5.0 for snappier turning
const CAMERA_VERTICAL_SMOOTH_SPEED = 12.0; // Increased from 8.0 for faster vertical adjustments
const MOUSE_SENSITIVITY = 0.001; // Reduced from 0.002 for smoother mouse control
const CAMERA_VERTICAL_ANGLE_CHARACTER_RAD = THREE.MathUtils.degToRad(50);
const CAMERA_VERTICAL_ANGLE_CAR_RAD = THREE.MathUtils.degToRad(55);
const MAX_DUST_PARTICLES = 200;
const DUST_PARTICLE_LIFETIME = 1.5; // seconds
const DUST_EMISSION_RATE_PER_SPEED = 2; // Particles per second per unit of speed
const BASE_BLOOM_STRENGTH = 0.15; // Slightly increased base bloom
const MAX_BLOOM_STRENGTH = 0.4;  // Lower max bloom
const SKYSCRAPER_BASE_SIZE = 8;
const SKYSCRAPER_MIN_HEIGHT = 20;
const SKYSCRAPER_MAX_HEIGHT = 60;
// --- Island Dimensions ---
const ISLAND_WIDTH = 120; // X-axis
const ISLAND_LENGTH = 450; // Z-axis
const WATER_LEVEL_Y = -0.2; // Y position for water plane
// --- Fence Constants ---
const FENCE_HEIGHT = 4;
const FENCE_COLLISION_MARGIN = 0.5; // How far inside the island edge the collision boundary is
const FENCE_TEXTURE_SECTION_WIDTH = 2.0; // Assumed width in world units of one fence texture repeat
// --- End Fence Constants ---
// --- End Island Dimensions ---
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
const ROAD_WIDTH = 6; // Increased road width for more realism
const MAIN_ROAD_WIDTH = 8; // Width for the main avenue
const INTERSECTION_SIZE = 8; // Size of intersection areas
const SIDEWALK_WIDTH = 1.5; // Width of sidewalks in meters
const SIDEWALK_HEIGHT = 0.05; // Height of sidewalks above road level
const PUNCH_DAMAGE_FRAME = 5; // Frame in punch animation where damage is applied
const PUNCH_HIT_RANGE = 1.0;    // How far the punch reaches
const HIT_IMPULSE_HORIZONTAL = 8.0;
const HIT_IMPULSE_VERTICAL = 5.0;
const POW_EFFECT_SCALE = 1.0;
const POW_EFFECT_DURATION = 0.5; // seconds
const AMBIENT_DUST_COUNT = 500; // Number of ambient dust particles
const AMBIENT_DUST_BOX_SIZE = 50; // How large is the area they spawn/exist in
const AMBIENT_DUST_SPEED = 0.1;  // How fast they drift
const SATURATION_MULTIPLIER = 1.5; // Increased saturation
const CAR_HIT_IMPULSE_HORIZONTAL = 15.0; // For car hitting NPC
const CAR_HIT_IMPULSE_VERTICAL = 7.0;   // For car hitting NPC
const CAR_REBOUND_SPEED = 5.0; // Speed at which car bounces off obstacles

// --- State ---
const GROUND_LEVEL_Y = SPRITE_SCALE / 2 - 0.075; // Store ground level calculation
const TREE_Y_POS = TREE_SCALE / 2 - 0.4; // Lower trees further
const GRASS_Y_POS = 0.005; // Slightly above ground, below road/trees
const CAR_Y_POS = CAR_SCALE / 2 - 2.49; // Raised by 0.01 (from -2.5)

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
    baseY: CAR_Y_POS + 0.01// Store the base Y position
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
    baseY: CAR_Y_POS - 0.07, // Store the base Y position for car 2
    id: 'car2' // Add an ID for easier identification
};

// Add state for car 3
let car3 = {
    position: new THREE.Vector3(10, CAR_Y_POS - 0.2, -15), // Unique position
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(1, 0, 0), // Facing +X
    angle: Math.PI / 2, 
    currentAngleSprite: 0,
    sprite: null,
    textures: {}, 
    baseY: CAR_Y_POS + 0.05,
    id: 'car3'
};

// Add state for car 4
let car4 = {
    position: new THREE.Vector3(-10, CAR_Y_POS - 0.3, -20), // Unique position
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(-1, 0, 0), // Facing -X
    angle: -Math.PI / 2,
    currentAngleSprite: 0,
    sprite: null,
    textures: {},
    baseY: CAR_Y_POS + 0.05,
    id: 'car4'
};

// Add state for car 5
let car5 = {
    position: new THREE.Vector3(15, CAR_Y_POS, -25), 
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, 1), 
    angle: 0,
    currentAngleSprite: 0,
    sprite: null,
    textures: {},
    baseY: CAR_Y_POS, 
    id: 'car5'
};

// Add state for car 6
let car6 = {
    position: new THREE.Vector3(-15, CAR_Y_POS, -30), 
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, -1), 
    angle: Math.PI,
    currentAngleSprite: 0,
    sprite: null,
    textures: {},
    baseY: CAR_Y_POS, 
    id: 'car6'
};

// Add state for car 7
let car7 = {
    position: new THREE.Vector3(20, CAR_Y_POS, -35), 
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(1, 0, 0), 
    angle: Math.PI / 2,
    currentAngleSprite: 0,
    sprite: null,
    textures: {},
    baseY: CAR_Y_POS, 
    id: 'car7'
};

// Add state for car 8
/*
let car8 = {
    position: new THREE.Vector3(-20, CAR_Y_POS, -40), 
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(-1, 0, 0), 
    angle: -Math.PI / 2,
    currentAngleSprite: 0,
    sprite: null,
    textures: {},
    baseY: CAR_Y_POS, 
    id: 'car8'
};
*/

// Add state for car 9
/*
let car9 = {
    position: new THREE.Vector3(0, CAR_Y_POS, -45), // Center start
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, 1), 
    angle: 0,
    currentAngleSprite: 0,
    sprite: null,
    textures: {},
    baseY: CAR_Y_POS, 
    id: 'car9'
};
*/

// Array containing all car objects
let allCars = [car, car2, car3, car4, car5, car6, car7]; // Removed car8, car9

let keyboard = {}; // Keep track of pressed keys

// --- Textures & Objects State ---
let textures = {
    idle: {}, // { 0: [tex0, tex1, ...], 45: [...], ... }
    walk: {},  // { 0: [tex0, tex1, ...], 45: [...], ... }
    run: {},   // { 0: [tex0, tex1, ...], 45: [...], ... }
    jump: {},   // { 0: [tex0, tex1, ...], 45: [...], ... }
    punch: {},   // { 0: [tex0, tex1, ...], 45: [...], ... }
    idlegun: {},
    walkgun: {},
    rungun: {},
    gunaim: {},
    gunshoot: {}
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
let npcTextures = []; // NPC Textures - Will be an array of texture sets
let grassTexture = null; // Single Grass Texture
let powTexture = null; // Texture for the POW effect
let bangTexture = null; // Texture for the BANG effect (car hits)
let pewTexture = null; // Texture for the PEW effect (comic gun effect)
let activePowEffects = []; // Array for managing active POW sprites
let buildingTexture = null; // Texture for skyscrapers
let fenceTexture = null; // Texture for the fence
let muzzleTexture = null; // Texture for the muzzle flash
let poofTexture = null; // <-- Move poofTexture declaration here

// --- Loading State --- (Flags)
let texturesLoaded = false;
let treeTexturesLoaded = false;
let carTexturesLoaded = false;
let npcTexturesLoaded = false; // Add flag for NPC textures
let car2TexturesLoaded = false; // Add flag for Car 2 textures
let car3TexturesLoaded = false; // Add flag for Car 3 textures
let car4TexturesLoaded = false; // Add flag for Car 4 textures
let car5TexturesLoaded = false; // Add flag for Car 5 textures
let car6TexturesLoaded = false; // Add flag for Car 6 textures
let car7TexturesLoaded = false; // Add flag for Car 7 textures
// let car8TexturesLoaded = false; // Add flag for Car 8 textures
// let car9TexturesLoaded = false; // Add flag for Car 9 textures
let fenceTextureLoaded = false; // Flag for fence texture

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

// --- Skyscraper Positions (Updated for Island Shape) --- 
const skyscraperPositions = [
    // Near start (closer to center)
    new THREE.Vector3(-15, 0, -10), 
    new THREE.Vector3( 15, 0, -15), 
    new THREE.Vector3(-10, 0, -30), 
    new THREE.Vector3( 20, 0, -25), 
    new THREE.Vector3(-25, 0, -50), // Pulled in Z
    new THREE.Vector3( 25, 0, -70), // Pulled in Z
    new THREE.Vector3(-30, 0, -90), // Pulled in Z
    // Further out (still within island Z range [-225, 225])
    new THREE.Vector3( 35, 0, -120),
    new THREE.Vector3(-30, 0, -150),
    new THREE.Vector3( 10, 0, -180),
    new THREE.Vector3(-15, 0, -200),
    new THREE.Vector3( 40, 0, 50),   // Added some positive Z
    new THREE.Vector3(-45, 0, 80),   // Added some positive Z
    new THREE.Vector3( 30, 0, 110),  // Added some positive Z
    new THREE.Vector3(-20, 0, 140),  // Added some positive Z
    new THREE.Vector3( 50, 0, 170),  // Added some positive Z
    new THREE.Vector3(-55, 0, 200),  // Added some positive Z (Max X is 60)
];

// Define NPC types and their UUIDs
const npcTypes = [
    // { name: 'npc', idleId: 'ab53bb77-f48c-4055-8e66-d8d56a26cdf4', walkId: 'c8db61a1-fda4-4f19-9db0-acdbcd2179de' }, // Removed original NPC
    { name: 'npc2', idleId: '7e639539-59f5-4398-ba2f-710100601deb', walkId: 'acb42374-d78f-4f6f-a02f-593bdd76b447' },
    { name: 'npc3', idleId: '4da41be5-1c5a-4acf-a47a-25720f555ba7', walkId: '34497f69-d1c3-441d-b294-e29cdabdd61a' },
    { name: 'npc4', idleId: 'fa4ae5aa-b59a-4e90-b024-e1449a99463a', walkId: '9ec7a8f4-da95-4cce-bc50-419f62051045' },
    { name: 'npc5', idleId: 'e0fc2069-ac73-44f9-b060-3c0b4b029ff9', walkId: '13b3f690-6d10-48ce-85be-001777b89ba8' },
    { name: 'npc6', idleId: '5ca344b0-c9c4-4c8c-8b65-2b1baac46872', walkId: '358f5802-a42d-49dc-8cf0-7d0dc81ceea3' },
    { name: 'npc7', idleId: '0067ac0c-3caf-4529-864d-7cb381794901', walkId: 'd0d46b63-a04b-4bec-9cc1-3afec92636e6' },
    { name: 'npc8', idleId: 'a4db332f-c0c6-4d6e-96b2-3ff3c5d67e3f', walkId: '73c373b7-02ab-4ebe-8caf-5aefc6793411' },
    { name: 'npc9', idleId: '9b4e1526-6c87-443a-b5de-da8d81d967ba', walkId: '5a31840a-aa37-4bd7-8e63-8e0e9975476d' },
    { name: 'npc10', idleId: '655fb4dd-8fcd-4ce3-b919-b65ce83a5117', walkId: 'c61931f7-66f6-49ac-8597-7ec1e6441f3a' },
    { name: 'npc11', idleId: '47bfd6bb-c61f-4321-b33a-907c7e7c32cb', walkId: 'a0499103-90d4-44e5-b76c-9fbf4091a692' },
    { name: 'npc12', idleId: '5eb8bff8-7ca2-4ab3-ba12-9dd9b6f01cad', walkId: '7f39e4cc-835f-4823-97e6-7ef738481153' },
    { name: 'npc13', idleId: 'b45baf5c-fb60-41d4-ad72-088e8e3de28d', walkId: '34e77c6f-0897-4e10-a0f1-9c3bb425ebef' },
    { name: 'npc14', idleId: 'ab53bb77-f48c-4055-8e66-d8d56a26cdf4', walkId: 'c8db61a1-fda4-4f19-9db0-acdbcd2179de' },
];

// --- CRT Shader Definition ---
const CRTShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'resolution': { value: new THREE.Vector2(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio) },
        'scanlineIntensity': { value: 0.3 },
        'scanlineCount': { value: window.innerHeight * window.devicePixelRatio * 0.6 },
        'curvature': { value: 4.0 }, // Reduced from 2.0
        'vignette': { value: 0.8 },
        'time': { value: 0.0 },
        'colorOffset': { value: 0.0 } // Added for chromatic aberration
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float scanlineIntensity;
        uniform float scanlineCount;
        uniform float curvature;
        uniform float vignette;
        uniform float time;
        varying vec2 vUv;
        uniform float colorOffset; // Added

        vec2 curveUV(vec2 uv, float amount) {
            uv = uv * 2.0 - 1.0;
            vec2 offset = abs(uv.yx) / amount;
            uv = uv + uv * offset * offset;
            uv = uv * 0.5 + 0.5;
            return uv;
        }

        void main() {
            vec2 curvedUv = curveUV(vUv, curvature);
            vec3 finalColor = vec3(0.0);

            if (curvedUv.x >= 0.0 && curvedUv.x <= 1.0 && curvedUv.y >= 0.0 && curvedUv.y <= 1.0) {
                // Chromatic Aberration (Color Offset)
                float offsetAmount = colorOffset * (length(curvedUv - 0.5)); // Increase offset towards edges
                vec2 uvR = curvedUv + vec2(offsetAmount, 0.0);
                vec2 uvB = curvedUv - vec2(offsetAmount, 0.0);

                // Sample textures - clamp coordinates to avoid edge artifacts if offset pushes them outside [0,1]
                finalColor.r = texture2D(tDiffuse, clamp(uvR, 0.0, 1.0)).r;
                finalColor.g = texture2D(tDiffuse, curvedUv).g; // Green channel from original UV
                finalColor.b = texture2D(tDiffuse, clamp(uvB, 0.0, 1.0)).b;

                // Scanlines
                float scanlineEffect = sin(curvedUv.y * scanlineCount) * 0.5 + 0.5;
                finalColor.rgb *= mix(1.0 - scanlineIntensity, 1.0, scanlineEffect);

                // Vignette
                float vignetteEffect = length(curvedUv - 0.5);
                vignetteEffect = smoothstep(0.3, 0.7, vignetteEffect);
                finalColor.rgb *= mix(1.0, 1.0 - vignette, vignetteEffect);

                // Optional Noise/Flicker
                // float noise = (fract(sin(dot(curvedUv + time * 0.01, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.05;
                // finalColor.rgb += noise;

            } else {
                // Outside curved screen is black
            }

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};
// --- End CRT Shader Definition ---

// --- Create Skyscrapers function ---
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
    scene.fog = new THREE.FogExp2(0x333333, 0.020); // Density reduced further from 0.025

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

    // Add CRT Pass (after color correction, before output)
    crtPass = new ShaderPass(CRTShader);
    crtPass.enabled = isCrtEnabled; // Initially disabled
    composer.addPass(crtPass);

    // Add OutputPass LAST for correct color space and tone mapping handling
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Lighting - Increase both ambient and directional
    const ambientLight = new THREE.AmbientLight(0xaaaaaa, 0.8); // Increased intensity from 0.6
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Increased intensity from 0.6
    directionalLight.position.set(5, 10, 7.5); 
    scene.add(directionalLight);

    // Ground plane - ISLAND
    const groundTexture = textureLoader.load('/textures/ground.webp'); // Load the texture
    groundTexture.wrapS = THREE.RepeatWrapping; // Enable horizontal wrapping
    groundTexture.wrapT = THREE.RepeatWrapping; // Enable vertical wrapping
    // Adjust repeat based on texture scale relative to new island size
    const groundTextureTileSize = 4; // Assume texture roughly covers 4x4 world units
    groundTexture.repeat.set(ISLAND_WIDTH / groundTextureTileSize, ISLAND_LENGTH / groundTextureTileSize); 

    const groundGeometry = new THREE.PlaneGeometry(ISLAND_WIDTH, ISLAND_LENGTH); // Use island dimensions
    // const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, side: THREE.DoubleSide }); // Grey ground
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        map: groundTexture, // Apply the texture map
        side: THREE.DoubleSide, 
        roughness: 0.9, // Increase roughness to reduce shine
        metalness: 0.1,  // Reduce metalness
        emissive: 0x222222, // Increase emissive color slightly (lighter grey)
        emissiveIntensity: 6.0 // Increased intensity from 5.0
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

    // Road network
    const roadTexture = textureLoader.load('/textures/asphalt.webp');
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    
    // Load sidewalk texture
    const sidewalkTexture = textureLoader.load('/textures/sidewalk.webp');
    sidewalkTexture.wrapS = THREE.RepeatWrapping;
    sidewalkTexture.wrapT = THREE.RepeatWrapping;

    // Define street positions first
    const crossStreetPositions = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
    const parallelStreetPositions = [-30, -15, 15, 30];

    // Create main avenue
    const mainRoadLength = ISLAND_LENGTH - 20;
    const mainRoadGeometry = new THREE.PlaneGeometry(MAIN_ROAD_WIDTH, mainRoadLength);
    const mainRoadMaterial = new THREE.MeshStandardMaterial({
        map: roadTexture.clone(),
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.1
    });
    mainRoadMaterial.map.repeat.set(MAIN_ROAD_WIDTH / 2, mainRoadLength / 2);
    mainRoadMaterial.map.needsUpdate = true;
    
    const mainRoad = new THREE.Mesh(mainRoadGeometry, mainRoadMaterial);
    mainRoad.rotation.x = -Math.PI / 2;
    mainRoad.position.set(0, 0.01, 0);
    scene.add(mainRoad);

    // Add sidewalks for main avenue - split into segments between cross streets
    const mainSidewalkGeometry = new THREE.PlaneGeometry(SIDEWALK_WIDTH, ROAD_WIDTH * 2);
    const sidewalkMaterial = new THREE.MeshStandardMaterial({
        map: sidewalkTexture.clone(),
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.1
    });
    sidewalkMaterial.map.repeat.set(1, 2);
    sidewalkMaterial.map.needsUpdate = true;

    // Create sidewalk segments for main avenue
    for (let i = 0; i < crossStreetPositions.length - 1; i++) {
        const startZ = crossStreetPositions[i];
        const endZ = crossStreetPositions[i + 1];
        const segmentLength = endZ - startZ - ROAD_WIDTH * 1.5; // Increase gap at intersections
        
        if (segmentLength > 1) {
            const segmentGeometry = new THREE.PlaneGeometry(SIDEWALK_WIDTH, segmentLength);
            const segmentMaterial = sidewalkMaterial.clone();
            segmentMaterial.map = sidewalkTexture.clone();
            segmentMaterial.map.repeat.set(1, segmentLength / 2);
            segmentMaterial.map.needsUpdate = true;

            // Left sidewalk segment
            const leftSegment = new THREE.Mesh(segmentGeometry, segmentMaterial.clone());
            leftSegment.rotation.x = -Math.PI / 2;
            leftSegment.position.set(
                -MAIN_ROAD_WIDTH/2 - SIDEWALK_WIDTH/2,
                SIDEWALK_HEIGHT,
                (startZ + endZ) / 2 + ROAD_WIDTH/4 // Adjust center position to account for intersection gap
            );
            scene.add(leftSegment);

            // Right sidewalk segment
            const rightSegment = new THREE.Mesh(segmentGeometry, segmentMaterial.clone());
            rightSegment.rotation.x = -Math.PI / 2;
            rightSegment.position.set(
                MAIN_ROAD_WIDTH/2 + SIDEWALK_WIDTH/2,
                SIDEWALK_HEIGHT,
                (startZ + endZ) / 2 + ROAD_WIDTH/4 // Adjust center position to account for intersection gap
            );
            scene.add(rightSegment);
        }
    }

    // Create parallel streets with segmented sidewalks
    for (const xPos of parallelStreetPositions) {
        // Create the street
        const streetGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, mainRoadLength * 0.8);
        const streetMaterial = new THREE.MeshStandardMaterial({
            map: roadTexture.clone(),
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.1
        });
        streetMaterial.map.repeat.set(ROAD_WIDTH / 2, (mainRoadLength * 0.8) / 2);
        streetMaterial.map.needsUpdate = true;
        
        const street = new THREE.Mesh(streetGeometry, streetMaterial);
        street.rotation.x = -Math.PI / 2;
        street.position.set(xPos, 0.011, 0);
        scene.add(street);

        // Create sidewalk segments between cross streets
        for (let i = 0; i < crossStreetPositions.length - 1; i++) {
            const startZ = crossStreetPositions[i];
            const endZ = crossStreetPositions[i + 1];
            const segmentLength = endZ - startZ - ROAD_WIDTH * 1.5; // Increase gap at intersections
            
            if (segmentLength > 1) {
                const sidewalkGeometry = new THREE.PlaneGeometry(SIDEWALK_WIDTH, segmentLength);
                const sidewalkMat = sidewalkMaterial.clone();
                sidewalkMat.map = sidewalkTexture.clone();
                sidewalkMat.map.repeat.set(1, segmentLength / 2);
                sidewalkMat.map.needsUpdate = true;

                const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMat);
                sidewalk.rotation.x = -Math.PI / 2;
                sidewalk.position.set(
                    xPos + ROAD_WIDTH/2 + SIDEWALK_WIDTH/2,
                    SIDEWALK_HEIGHT + 0.001,
                    (startZ + endZ) / 2 + ROAD_WIDTH/4 // Adjust center position to account for intersection gap
                );
                scene.add(sidewalk);
            }
        }
    }

    // Create cross streets with segmented sidewalks
    for (const zPos of crossStreetPositions) {
        // Create the street
        const crossStreetGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ISLAND_WIDTH);
        const crossStreetMaterial = new THREE.MeshStandardMaterial({
            map: roadTexture.clone(),
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.1
        });
        crossStreetMaterial.map.repeat.set(ROAD_WIDTH / 2, ISLAND_WIDTH / 2);
        crossStreetMaterial.map.needsUpdate = true;
        
        const crossStreet = new THREE.Mesh(crossStreetGeometry, crossStreetMaterial);
        crossStreet.rotation.x = -Math.PI / 2;
        crossStreet.rotation.z = Math.PI / 2;
        crossStreet.position.set(0, 0.012, zPos);
        scene.add(crossStreet);

        // Create sidewalk segments between parallel streets
        for (let i = 0; i < parallelStreetPositions.length - 1; i++) {
            const startX = parallelStreetPositions[i];
            const endX = parallelStreetPositions[i + 1];
            const segmentLength = endX - startX - ROAD_WIDTH * 1.5; // Increase gap at intersections
            
            if (segmentLength > 1) {
                const sidewalkGeometry = new THREE.PlaneGeometry(SIDEWALK_WIDTH, segmentLength);
                const sidewalkMat = sidewalkMaterial.clone();
                sidewalkMat.map = sidewalkTexture.clone();
                sidewalkMat.map.repeat.set(1, segmentLength / 2);
                sidewalkMat.map.needsUpdate = true;

                const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMat);
                sidewalk.rotation.x = -Math.PI / 2;
                sidewalk.rotation.z = Math.PI / 2;
                sidewalk.position.set(
                    (startX + endX) / 2 + ROAD_WIDTH/4, // Adjust center position to account for intersection gap
                    SIDEWALK_HEIGHT + 0.002,
                    zPos + ROAD_WIDTH/2 + SIDEWALK_WIDTH/2
                );
                scene.add(sidewalk);
            }
        }
    }

    // Create diagonal roads with segmented sidewalks
    const diagonalRoadLength = Math.sqrt(2) * ISLAND_WIDTH * 0.6;
    const diagonalRoadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, diagonalRoadLength);
    const diagonalRoadMaterial = new THREE.MeshStandardMaterial({
        map: roadTexture.clone(),
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0.1
    });
    diagonalRoadMaterial.map.repeat.set(ROAD_WIDTH / 2, diagonalRoadLength / 2);
    diagonalRoadMaterial.map.needsUpdate = true;

    // Function to find intersection points with other roads
    function getDiagonalSegments(startX, startZ, angle) {
        const segments = [];
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);
        const maxLength = diagonalRoadLength;
        
        // Add start point
        segments.push({x: startX, z: startZ});
        
        // Check intersections with parallel streets and main avenue
        for (const x of [...parallelStreetPositions, 0]) {
            if (Math.abs(x - startX) > 1) {
                const t = (x - startX) / dx;
                if (t > 0 && t < maxLength) {
                    const z = startZ + t * dz;
                    if (Math.abs(z) <= ISLAND_LENGTH / 2) {
                        // Add points before and after intersection for proper gap
                        segments.push({
                            x: x - dx * ROAD_WIDTH * 0.75,
                            z: z - dz * ROAD_WIDTH * 0.75,
                            isRoadStart: true
                        });
                        segments.push({
                            x: x + dx * ROAD_WIDTH * 0.75,
                            z: z + dz * ROAD_WIDTH * 0.75,
                            isRoadEnd: true
                        });
                    }
                }
            }
        }
        
        // Check intersections with cross streets
        for (const z of crossStreetPositions) {
            if (Math.abs(z - startZ) > 1) {
                const t = (z - startZ) / dz;
                if (t > 0 && t < maxLength) {
                    const x = startX + t * dx;
                    if (Math.abs(x) <= ISLAND_WIDTH / 2) {
                        // Add points before and after intersection for proper gap
                        segments.push({
                            x: x - dx * ROAD_WIDTH * 0.75,
                            z: z - dz * ROAD_WIDTH * 0.75,
                            isRoadStart: true
                        });
                        segments.push({
                            x: x + dx * ROAD_WIDTH * 0.75,
                            z: z + dz * ROAD_WIDTH * 0.75,
                            isRoadEnd: true
                        });
                    }
                }
            }
        }

        // Add end point
        const endX = startX + dx * maxLength;
        const endZ = startZ + dz * maxLength;
        segments.push({x: endX, z: endZ});
        
        // Sort segments by distance from start
        segments.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.x - startX, 2) + Math.pow(a.z - startZ, 2));
            const distB = Math.sqrt(Math.pow(b.x - startX, 2) + Math.pow(b.z - startZ, 2));
            return distA - distB;
        });
        
        return segments;
    }

    // Northeast diagonal with segmented sidewalk
    const diagonalRoad1 = new THREE.Mesh(diagonalRoadGeometry, diagonalRoadMaterial);
    diagonalRoad1.rotation.x = -Math.PI / 2;
    diagonalRoad1.rotation.z = Math.PI / 4;
    diagonalRoad1.position.set(20, 0.013, -60);
    scene.add(diagonalRoad1);

    const segments1 = getDiagonalSegments(20, -60, Math.PI / 4);
    for (let i = 0; i < segments1.length - 1; i++) {
        const start = segments1[i];
        const end = segments1[i + 1];
        
        // Skip if this is a road intersection segment
        if (start.isRoadStart || start.isRoadEnd || end.isRoadStart || end.isRoadEnd) continue;
        
        const segmentLength = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2)
        ) - ROAD_WIDTH * 0.5; // Adjust gap size
        
        if (segmentLength > 1) {
            const sidewalkGeometry = new THREE.PlaneGeometry(SIDEWALK_WIDTH, segmentLength);
            const sidewalkMat = sidewalkMaterial.clone();
            sidewalkMat.map = sidewalkTexture.clone();
            sidewalkMat.map.repeat.set(1, segmentLength / 2);
            sidewalkMat.map.needsUpdate = true;

            const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMat);
            sidewalk.rotation.x = -Math.PI / 2;
            sidewalk.rotation.z = Math.PI / 4;
            const offset = (ROAD_WIDTH/2 + SIDEWALK_WIDTH/2);
            
            // Calculate center position between start and end, accounting for road width
            const centerX = (start.x + end.x) / 2;
            const centerZ = (start.z + end.z) / 2;
            
            // Apply offset perpendicular to road direction
            sidewalk.position.set(
                centerX + offset * Math.cos(Math.PI/4 + Math.PI/2),
                SIDEWALK_HEIGHT + 0.003,
                centerZ + offset * Math.sin(Math.PI/4 + Math.PI/2)
            );
            scene.add(sidewalk);
        }
    }

    // Northwest diagonal with segmented sidewalk
    const diagonalRoad2 = new THREE.Mesh(diagonalRoadGeometry, diagonalRoadMaterial.clone());
    diagonalRoad2.rotation.x = -Math.PI / 2;
    diagonalRoad2.rotation.z = -Math.PI / 4;
    diagonalRoad2.position.set(-20, 0.013, -60);
    scene.add(diagonalRoad2);

    const segments2 = getDiagonalSegments(-20, -60, -Math.PI / 4);
    for (let i = 0; i < segments2.length - 1; i++) {
        const start = segments2[i];
        const end = segments2[i + 1];
        
        // Skip if this is a road intersection segment
        if (start.isRoadStart || start.isRoadEnd || end.isRoadStart || end.isRoadEnd) continue;
        
        const segmentLength = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2)
        ) - ROAD_WIDTH * 0.5; // Adjust gap size
        
        if (segmentLength > 1) {
            const sidewalkGeometry = new THREE.PlaneGeometry(SIDEWALK_WIDTH, segmentLength);
            const sidewalkMat = sidewalkMaterial.clone();
            sidewalkMat.map = sidewalkTexture.clone();
            sidewalkMat.map.repeat.set(1, segmentLength / 2);
            sidewalkMat.map.needsUpdate = true;

            const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMat);
            sidewalk.rotation.x = -Math.PI / 2;
            sidewalk.rotation.z = -Math.PI / 4;
            const offset = (ROAD_WIDTH/2 + SIDEWALK_WIDTH/2);
            
            // Calculate center position between start and end, accounting for road width
            const centerX = (start.x + end.x) / 2;
            const centerZ = (start.z + end.z) / 2;
            
            // Apply offset perpendicular to road direction
            sidewalk.position.set(
                centerX + offset * Math.cos(-Math.PI/4 + Math.PI/2),
                SIDEWALK_HEIGHT + 0.003,
                centerZ + offset * Math.sin(-Math.PI/4 + Math.PI/2)
            );
            scene.add(sidewalk);
        }
    }

    // Create intersections
    for (const zPos of crossStreetPositions) {
        for (const xPos of [...parallelStreetPositions, 0]) {
            const intersectionGeometry = new THREE.CircleGeometry(INTERSECTION_SIZE / 2, 32);
            const intersectionMaterial = new THREE.MeshStandardMaterial({
                map: roadTexture.clone(),
                side: THREE.DoubleSide,
                roughness: 0.9,
                metalness: 0.1
            });
            // Adjust intersection texture tiling
            intersectionMaterial.map.repeat.set(INTERSECTION_SIZE / 2, INTERSECTION_SIZE / 2);
            intersectionMaterial.map.needsUpdate = true;
            
            const intersection = new THREE.Mesh(intersectionGeometry, intersectionMaterial);
            intersection.rotation.x = -Math.PI / 2;
            intersection.position.set(xPos, 0.014, zPos);
            scene.add(intersection);
        }
    }

    // --- Water Plane ---
    /* // Remove old basic water plane
    const waterGeometry = new THREE.PlaneGeometry(1000, 1000); // Large plane for water
    // Basic blue water material for now
    const waterMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x0044aa, 
        transparent: true, 
        opacity: 0.85, 
        roughness: 0.2, 
        metalness: 0.1 
    });
    const waterPlane = new THREE.Mesh(waterGeometry, waterMaterial);
    waterPlane.rotation.x = -Math.PI / 2; // Lay flat
    waterPlane.position.set(0, WATER_LEVEL_Y, 0); // Position below ground
    scene.add(waterPlane);
    */
    
    // Realistic Water
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000); // Make water extensive
    const water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('/textures/waternormals.jpg', function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: new THREE.Vector3().copy(directionalLight.position).normalize(), // Use scene light direction
            sunColor: 0xffffff,
            waterColor: 0x001e0f, // Darker, greenish water
            distortionScale: 3.7,
            fog: scene.fog !== undefined,
            size: 1.0 // Adjust wave size
        }
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_LEVEL_Y; // Set water level
    scene.add(water);
    window.water = water; // Make water accessible globally for animation update
    // --- End Water Plane ---

    // Create Skyscrapers (Call remains here)
    createSkyscrapers();

    // --- Fence Loading and Creation ---
    textureLoader.load('/sprites/objects/fence.webp', (texture) => {
        fenceTexture = texture;
        fenceTexture.magFilter = THREE.LinearFilter;
        fenceTexture.minFilter = THREE.LinearFilter;
        fenceTexture.wrapS = THREE.RepeatWrapping;
        fenceTexture.wrapT = THREE.ClampToEdgeWrapping; // Don't repeat vertically
        fenceTextureLoaded = true;
        console.log("Fence texture loaded!");
        createFences(); // Create fences once texture is ready
    }, undefined, (err) => {
        console.error("Failed to load fence texture:", err);
    });
    // --- End Fence Loading ---

    // Load POW Texture
    powTexture = textureLoader.load('/sprites/effects/pow.webp');
    // Load BANG Texture
    bangTexture = textureLoader.load('/sprites/effects/bang.webp');
    // Load PEW Texture
    pewTexture = textureLoader.load('/sprites/effects/pew.webp');
    // Load MUZZLE Texture
    muzzleTexture = textureLoader.load('/sprites/effects/muzzle.webp');
    // Load POOF Texture
    poofTexture = textureLoader.load('/sprites/effects/poof.webp');

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
        // Load car 3 textures next
        return loadCar3Textures(); 
    }).then(() => {
        console.log("Car 3 textures loaded!");
        car3TexturesLoaded = true;
        createCar3(); // Create car 3
        // Load car 4 textures next
        return loadCar4Textures();
    }).then(() => {
        console.log("Car 4 textures loaded!");
        car4TexturesLoaded = true;
        createCar4(); // Create car 4
        // Load car 5 textures next
        return loadCar5Textures();
    }).then(() => {
        console.log("Car 5 textures loaded!");
        car5TexturesLoaded = true;
        createCar5();
        // Load car 6 textures next
        return loadCar6Textures();
    }).then(() => {
        console.log("Car 6 textures loaded!");
        car6TexturesLoaded = true;
        createCar6();
        // Load car 7 textures next
        return loadCar7Textures();
    }).then(() => {
        console.log("Car 7 textures loaded!");
        car7TexturesLoaded = true;
        createCar7();
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

    // --- MOBILE CONTROLS ---
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    let mobileControls = null;
    if (isMobile()) {
        mobileControls = document.createElement('div');
        mobileControls.id = 'mobile-controls';
        mobileControls.style.position = 'fixed';
        mobileControls.style.left = '0';
        mobileControls.style.top = '0';
        mobileControls.style.width = '100vw';
        mobileControls.style.height = '100vh';
        mobileControls.style.zIndex = '2000';
        mobileControls.style.pointerEvents = 'none';
        document.body.appendChild(mobileControls);

        // --- Virtual Joystick ---
        const stickOuter = document.createElement('div');
        stickOuter.style.position = 'absolute';
        stickOuter.style.left = '6vw';
        stickOuter.style.bottom = '10vh';
        stickOuter.style.width = '22vw';
        stickOuter.style.height = '22vw';
        stickOuter.style.background = 'rgba(255,255,255,0.08)';
        stickOuter.style.borderRadius = '50%';
        stickOuter.style.pointerEvents = 'auto';
        stickOuter.style.touchAction = 'none';
        mobileControls.appendChild(stickOuter);

        const stickInner = document.createElement('div');
        stickInner.style.position = 'absolute';
        stickInner.style.left = '8vw';
        stickInner.style.top = '8vw';
        stickInner.style.width = '6vw';
        stickInner.style.height = '6vw';
        stickInner.style.background = 'rgba(255,255,255,0.25)';
        stickInner.style.borderRadius = '50%';
        stickInner.style.transform = 'translate(-50%, -50%)';
        stickOuter.appendChild(stickInner);

        let stickActive = false, stickStart = {x:0, y:0}, stickPos = {x:0, y:0};
        stickOuter.addEventListener('touchstart', e => {
            stickActive = true;
            const t = e.touches[0];
            stickStart = {x: t.clientX, y: t.clientY};
            stickInner.style.left = '8vw';
            stickInner.style.top = '8vw';
        });
        stickOuter.addEventListener('touchmove', e => {
            if (!stickActive) return;
            const t = e.touches[0];
            const dx = t.clientX - stickStart.x;
            const dy = t.clientY - stickStart.y;
            const maxDist = stickOuter.offsetWidth/2.2;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let angle = Math.atan2(dy, dx);
            if (dist > maxDist) dist = maxDist;
            stickPos = {x: Math.cos(angle)*dist, y: Math.sin(angle)*dist};
            stickInner.style.left = (8 + stickPos.x / (stickOuter.offsetWidth/2) * 8) + 'vw';
            stickInner.style.top = (8 + stickPos.y / (stickOuter.offsetHeight/2) * 8) + 'vw';
            // Map to WASD for movement
            keyboard['KeyW'] = stickPos.y < -maxDist*0.3;
            keyboard['KeyS'] = stickPos.y > maxDist*0.3;
            keyboard['KeyA'] = stickPos.x < -maxDist*0.3;
            keyboard['KeyD'] = stickPos.x > maxDist*0.3;
        });
        stickOuter.addEventListener('touchend', e => {
            stickActive = false;
            stickInner.style.left = '8vw';
            stickInner.style.top = '8vw';
            keyboard['KeyW'] = false;
            keyboard['KeyS'] = false;
            keyboard['KeyA'] = false;
            keyboard['KeyD'] = false;
        });

        // --- Run Button ---
        const runBtn = document.createElement('button');
        runBtn.innerText = 'Run';
        runBtn.style.position = 'absolute';
        runBtn.style.right = '24vw';
        runBtn.style.bottom = '18vh';
        runBtn.style.width = '12vw';
        runBtn.style.height = '12vw';
        runBtn.style.borderRadius = '50%';
        runBtn.style.background = 'rgba(255,255,255,0.18)';
        runBtn.style.fontSize = '5vw';
        runBtn.style.pointerEvents = 'auto';
        runBtn.ontouchstart = () => { keyboard['ShiftLeft'] = true; };
        runBtn.ontouchend = () => { keyboard['ShiftLeft'] = false; };
        mobileControls.appendChild(runBtn);

        // --- Hit Button (Punch/Shoot) ---
        const hitBtn = document.createElement('button');
        hitBtn.innerText = 'Hit';
        hitBtn.style.position = 'absolute';
        hitBtn.style.right = '10vw';
        hitBtn.style.bottom = '10vh';
        hitBtn.style.width = '14vw';
        hitBtn.style.height = '14vw';
        hitBtn.style.borderRadius = '50%';
        hitBtn.style.background = 'rgba(255,255,255,0.18)';
        hitBtn.style.fontSize = '5vw';
        hitBtn.style.pointerEvents = 'auto';
        hitBtn.ontouchstart = () => {
            if (hasGun) {
                // Simulate left mouse down for shooting
                isLeftMouseDown = true;
                isGunShootQueued = true;
                isShooting = true;
                character.state = 'gunshoot';
                character.currentFrame = 0;
                character.frameTime = 0;
            } else {
                // Simulate punch
                if (playerControlMode === 'character' && character.isOnGround && !character.isPunching && character.state !== 'jump') {
                    character.state = 'punch';
                    character.isPunching = true;
                    character.punchedThisAction = false;
                    character.currentFrame = 0;
                    character.frameTime = 0;
                    character.velocity.x = 0;
                    character.velocity.z = 0;
                }
            }
        };
        hitBtn.ontouchend = () => {
            isLeftMouseDown = false;
        };
        mobileControls.appendChild(hitBtn);

        // --- Get Into Car Button ---
        const carBtn = document.createElement('button');
        carBtn.innerText = 'Car';
        carBtn.style.position = 'absolute';
        carBtn.style.right = '10vw';
        carBtn.style.bottom = '28vh';
        carBtn.style.width = '10vw';
        carBtn.style.height = '10vw';
        carBtn.style.borderRadius = '50%';
        carBtn.style.background = 'rgba(255,255,255,0.18)';
        carBtn.style.fontSize = '4vw';
        carBtn.style.pointerEvents = 'auto';
        carBtn.ontouchstart = () => {
            // Simulate E key for enter/exit car
            const e = { code: 'KeyE' };
            onKeyDown(e);
            setTimeout(() => onKeyUp(e), 100);
        };
        mobileControls.appendChild(carBtn);

        // --- Weapon Switch Button ---
        const weaponBtn = document.createElement('button');
        weaponBtn.innerText = 'Switch';
        weaponBtn.style.position = 'absolute';
        weaponBtn.style.left = '10vw';
        weaponBtn.style.bottom = '28vh';
        weaponBtn.style.width = '10vw';
        weaponBtn.style.height = '10vw';
        weaponBtn.style.borderRadius = '50%';
        weaponBtn.style.background = 'rgba(255,255,255,0.18)';
        weaponBtn.style.fontSize = '4vw';
        weaponBtn.style.pointerEvents = 'auto';
        weaponBtn.ontouchstart = () => {
            // Toggle between gun and no gun
            if (hasGun) {
                onKeyDown({ code: 'Digit1' });
                setTimeout(() => onKeyUp({ code: 'Digit1' }), 100);
            } else {
                onKeyDown({ code: 'Digit2' });
                setTimeout(() => onKeyUp({ code: 'Digit2' }), 100);
            }
        };
        mobileControls.appendChild(weaponBtn);
    }
}

async function loadAllTextures() {
    // Load only the minimal set for startup
    const initialState = 'idle';
    const initialAngle = 180;
    const initialFrame = 0;
    const states = {
        idle: "1702ef2e-9e8b-4a54-b327-09cc1ba22ab3", 
        walk: "8f41066e-26b7-4dd1-9dde-14d95d92f55f",
        run: "399a15c9-b488-49ab-b4fd-3a447237a974",
        jump: "4468dfb8-c011-4b43-bbaa-765d32f52f4b",
        punch: "26ef782f-b3f7-4a71-83db-66d0fbeedd9d",
        idlegun: "1e6373b8-d3cc-4f87-a994-818a4141fdbd",
        walkgun: "2ec22191-f530-46cb-bc83-31dd2279efc4",
        rungun: "8da83014-332b-4cf8-a306-56bfe570920a",
        gunaim: "544e1241-8373-49c9-ab20-6884dcb2424f",
        gunshoot: "15f53665-6dfa-4639-b0da-72b752bd6cd2"
    };
    const basePath = '/sprites/';
    // Load only the initial idle texture
    return new Promise((resolve, reject) => {
        const state = initialState;
        const baseFileNamePart = states[state];
        const statePath = `${basePath}${state}/`;
        const angleString = String(initialAngle).replace('.', '_');
        const angleDirName = angleString.includes('_') ? angleString : `${angleString}_0`;
        const anglePath = `${statePath}angle_${angleDirName}/`;
        const framePadded = String(initialFrame).padStart(4, '0');
        const anglePartInFilename = angleString.includes('_') ? angleString : `${angleString}_0`;
        const fileName = `${baseFileNamePart}_angle_${anglePartInFilename}_${framePadded}.webp`;
        const filePath = anglePath + fileName;
        textures[state] = {};
        textures[state][initialAngle] = [];
        textureLoader.load(filePath,
            (texture) => {
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearFilter;
                textures[state][initialAngle][initialFrame] = texture;
                // Start background loading of all other textures
                setTimeout(() => loadAllTexturesBackground(states, basePath), 0);
                resolve();
            },
            undefined,
            (err) => {
                console.error(`Failed to load initial texture: ${filePath}`, err);
                resolve(); // Still resolve so game can start
            }
        );
    });
}

// Background loader for all textures
function loadAllTexturesBackground(states, basePath) {
    for (const [state, baseFileNamePart] of Object.entries(states)) {
        if (!textures[state]) textures[state] = {};
        for (const angle of ANGLES) {
            if (!textures[state][angle]) textures[state][angle] = [];
            const angleString = String(angle).replace('.', '_');
            const angleDirName = angleString.includes('_') ? angleString : `${angleString}_0`;
            const anglePath = `${basePath}${state}/angle_${angleDirName}/`;
            for (let frame = 0; frame < FRAME_COUNT; frame++) {
                // Skip if already loaded
                if (textures[state][angle][frame]) continue;
                const framePadded = String(frame).padStart(4, '0');
                const anglePartInFilename = angleString.includes('_') ? angleString : `${angleString}_0`;
                const fileName = `${baseFileNamePart}_angle_${anglePartInFilename}_${framePadded}.webp`;
                const filePath = anglePath + fileName;
                textureLoader.load(filePath,
                    (texture) => {
                        texture.magFilter = THREE.LinearFilter;
                        texture.minFilter = THREE.LinearFilter;
                        textures[state][angle][frame] = texture;
                    },
                    undefined,
                    (err) => {
                        // Ignore errors in background loading
                    }
                );
            }
        }
    }
}

async function loadTreeTextures() {
    const promises = [];
    const treePrefix = "61c18be5-31a1-4ee1-8eda-b367fac76a80"; // Updated tree prefix
    const basePath = '/sprites/objects/tree/'; // Path relative to /public
    const framePadded = '0000'; // Inanimate objects use only frame 0

    console.log(`Loading tree textures with prefix: ${treePrefix} for ${NUM_TREE_ANGLES} angles`);

    for (const angle of TREE_ANGLES) { // Iterate through the 64 TREE_ANGLES
        // Format angle for filename (e.g., 5.625 -> 5_6, 11.25 -> 11_2, 0.0 -> 0_0) - Same logic as car
        const angleFloor = Math.floor(angle);
        const decimalPartTimes10 = (angle - angleFloor) * 10;
        let angleDecimal;
        if (Math.abs(decimalPartTimes10 - 2.5) < 0.01) {
            angleDecimal = 2;
        } else if (Math.abs(decimalPartTimes10 - 7.5) < 0.01) { // Handle .75 case (e.g., 67.5 -> 67_8)
             angleDecimal = 8; 
        } else {
            angleDecimal = Math.round(decimalPartTimes10);
        }
        const angleString = `${angleFloor}_${angleDecimal}`;

        const fileName = `${treePrefix}_angle_${angleString}_${framePadded}.webp`;
        const filePath = basePath + fileName;

        const promise = new Promise((resolve, reject) => {
            textureLoader.load(filePath,
                (texture) => {
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;
                    treeTextures[angle] = texture; // Use the float angle as the key
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

async function loadCar3Textures() {
    const promises = [];
    const carPrefix = CAR3_SPRITE_PREFIX;
    const basePath = '/sprites/car3/'; 
    const framePadded = '0000';

    console.log(`Loading car 3 textures with prefix: ${carPrefix} for ${NUM_CAR_ANGLES} angles`);

    for (const angle of CAR_ANGLES) {
        const angleFloor = Math.floor(angle);
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
                    car3.textures[angle] = texture; // Store in car3's object
                    resolve(texture);
                },
                undefined,
                (err) => {
                    console.error(`Failed to load car 3 texture: ${filePath}`, err);
                    resolve(null); 
                }
            );
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}

async function loadCar4Textures() {
    const promises = [];
    const carPrefix = CAR4_SPRITE_PREFIX;
    const basePath = '/sprites/car4/';
    const framePadded = '0000';

    console.log(`Loading car 4 textures with prefix: ${carPrefix} for ${NUM_CAR_ANGLES} angles`);

    for (const angle of CAR_ANGLES) {
        const angleFloor = Math.floor(angle);
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
                    car4.textures[angle] = texture; // Store in car4's object
                    resolve(texture);
                },
                undefined,
                (err) => {
                    console.error(`Failed to load car 4 texture: ${filePath}`, err);
                    resolve(null);
                }
            );
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}

async function loadCar5Textures() {
    const promises = [];
    const carPrefix = CAR5_SPRITE_PREFIX;
    const basePath = '/sprites/car5/';
    const framePadded = '0000';
    console.log(`Loading car 5 textures with prefix: ${carPrefix} for ${NUM_CAR_ANGLES} angles`);
    for (const angle of CAR_ANGLES) {
        const angleFloor = Math.floor(angle);
        const decimalPartTimes10 = (angle - angleFloor) * 10;
        let angleDecimal;
        if (Math.abs(decimalPartTimes10 - 2.5) < 0.01) { angleDecimal = 2; } else { angleDecimal = Math.round(decimalPartTimes10); }
        const angleString = `${angleFloor}_${angleDecimal}`;
        const fileName = `${carPrefix}_angle_${angleString}_${framePadded}.webp`;
        const filePath = basePath + fileName;
        const promise = new Promise((resolve) => {
            textureLoader.load(filePath, (texture) => {
                texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
                car5.textures[angle] = texture;
                resolve(texture);
            }, undefined, (err) => { console.error(`Failed to load car 5 texture: ${filePath}`, err); resolve(null); });
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}

async function loadCar6Textures() {
    const promises = [];
    const carPrefix = CAR6_SPRITE_PREFIX;
    const basePath = '/sprites/car6/';
    const framePadded = '0000';
    console.log(`Loading car 6 textures with prefix: ${carPrefix} for ${NUM_CAR_ANGLES} angles`);
    for (const angle of CAR_ANGLES) {
        const angleFloor = Math.floor(angle);
        const decimalPartTimes10 = (angle - angleFloor) * 10;
        let angleDecimal;
        if (Math.abs(decimalPartTimes10 - 2.5) < 0.01) { angleDecimal = 2; } else { angleDecimal = Math.round(decimalPartTimes10); }
        const angleString = `${angleFloor}_${angleDecimal}`;
        const fileName = `${carPrefix}_angle_${angleString}_${framePadded}.webp`;
        const filePath = basePath + fileName;
        const promise = new Promise((resolve) => {
            textureLoader.load(filePath, (texture) => {
                texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
                car6.textures[angle] = texture;
                resolve(texture);
            }, undefined, (err) => { console.error(`Failed to load car 6 texture: ${filePath}`, err); resolve(null); });
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}

async function loadCar7Textures() {
    const promises = [];
    const carPrefix = CAR7_SPRITE_PREFIX;
    const basePath = '/sprites/car7/';
    const framePadded = '0000';
    console.log(`Loading car 7 textures with prefix: ${carPrefix} for ${NUM_CAR_ANGLES} angles`);
    for (const angle of CAR_ANGLES) {
        const angleFloor = Math.floor(angle);
        const decimalPartTimes10 = (angle - angleFloor) * 10;
        let angleDecimal;
        if (Math.abs(decimalPartTimes10 - 2.5) < 0.01) { angleDecimal = 2; } else { angleDecimal = Math.round(decimalPartTimes10); }
        const angleString = `${angleFloor}_${angleDecimal}`;
        const fileName = `${carPrefix}_angle_${angleString}_${framePadded}.webp`;
        const filePath = basePath + fileName;
        const promise = new Promise((resolve) => {
            textureLoader.load(filePath, (texture) => {
                texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
                car7.textures[angle] = texture;
                resolve(texture);
            }, undefined, (err) => { console.error(`Failed to load car 7 texture: ${filePath}`, err); resolve(null); });
        });
        promises.push(promise);
    }
    await Promise.all(promises);
}

async function loadNpcTextures() {
    const promises = [];
    const frameCount = NPC_FRAME_COUNT;
    const angles = NPC_ANGLES;

    console.log("Loading NPC textures for all types...");

    for (const npcType of npcTypes) {
        const npcTypeIndex = npcTextures.length; // Index where this type's textures will be stored
        npcTextures.push({ idle: {}, walk: {} }); // Initialize texture object for this type

        const npcStates = {
            idle: npcType.idleId,
            walk: npcType.walkId
        };
        const basePath = `/sprites/${npcType.name}/`;

        console.log(`Loading textures for ${npcType.name}...`);

        for (const [state, prefix] of Object.entries(npcStates)) {
            npcTextures[npcTypeIndex][state] = {};
            const statePath = `${basePath}${state}/`; // e.g., /sprites/npc2/walk/

            for (const angle of angles) {
                npcTextures[npcTypeIndex][state][angle] = [];
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
                                texture.magFilter = THREE.LinearFilter; // Use Linear for smoother look when scaled
                                texture.minFilter = THREE.LinearFilter; // Use Linear for smoother look when scaled
                                npcTextures[npcTypeIndex][state][angle][frame] = texture;
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
    }
    try {
        await Promise.all(promises);
        console.log("Finished loading all NPC textures.");
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

    // Create geometry with size 1x1 (scaling is handled dynamically)
    const geometry = new THREE.PlaneGeometry(1, 1);
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
            // color: 0xaaaaaa // Remove color tint to darken
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
        // color: 0xaaaaaa // Remove color tint to darken
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

// --- Create Car 3 ---
function createCar3() {
    const initialCarTexture = car3.textures[0]; 
    if (!initialCarTexture) {
        console.warn("Initial car 3 texture (angle 0) not loaded, cannot create car 3.");
        return;
    }
    const material = new THREE.MeshBasicMaterial({
        map: initialCarTexture.clone(),
        transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
        // color: 0xccaa88 // Example tint
    });
    const geometry = new THREE.PlaneGeometry(CAR_SCALE, CAR_SCALE * 0.6); 
    car3.sprite = new THREE.Mesh(geometry, material);
    car3.sprite.position.copy(car3.position);
    scene.add(car3.sprite);
    console.log(`Created car 3 at: ${car3.position.x}, ${car3.position.z}`);
}

// --- Create Car 4 ---
function createCar4() {
    const initialCarTexture = car4.textures[0]; 
    if (!initialCarTexture) {
        console.warn("Initial car 4 texture (angle 0) not loaded, cannot create car 4.");
        return;
    }
    const material = new THREE.MeshBasicMaterial({
        map: initialCarTexture.clone(),
        transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
        // color: 0x88ccaa // Example tint
    });
    const geometry = new THREE.PlaneGeometry(CAR_SCALE, CAR_SCALE * 0.6); 
    car4.sprite = new THREE.Mesh(geometry, material);
    car4.sprite.position.copy(car4.position);
    scene.add(car4.sprite);
    console.log(`Created car 4 at: ${car4.position.x}, ${car4.position.z}`);
}

// --- Create Car 5 ---
function createCar5() {
    const initialCarTexture = car5.textures[0]; 
    if (!initialCarTexture) { console.warn("Initial car 5 texture not loaded."); return; }
    const material = new THREE.MeshBasicMaterial({ map: initialCarTexture.clone(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(CAR_SCALE, CAR_SCALE * 0.6); 
    car5.sprite = new THREE.Mesh(geometry, material);
    car5.sprite.position.copy(car5.position);
    scene.add(car5.sprite);
    console.log(`Created car 5 at: ${car5.position.x}, ${car5.position.z}`);
}

// --- Create Car 6 ---
function createCar6() {
    const initialCarTexture = car6.textures[0]; 
    if (!initialCarTexture) { console.warn("Initial car 6 texture not loaded."); return; }
    const material = new THREE.MeshBasicMaterial({ map: initialCarTexture.clone(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(CAR_SCALE, CAR_SCALE * 0.6); 
    car6.sprite = new THREE.Mesh(geometry, material);
    car6.sprite.position.copy(car6.position);
    scene.add(car6.sprite);
    console.log(`Created car 6 at: ${car6.position.x}, ${car6.position.z}`);
}

// --- Create Car 7 ---
function createCar7() {
    const initialCarTexture = car7.textures[0]; 
    if (!initialCarTexture) { console.warn("Initial car 7 texture not loaded."); return; }
    const material = new THREE.MeshBasicMaterial({ map: initialCarTexture.clone(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(CAR_SCALE, CAR_SCALE * 0.6); 
    car7.sprite = new THREE.Mesh(geometry, material);
    car7.sprite.position.copy(car7.position);
    scene.add(car7.sprite);
    console.log(`Created car 7 at: ${car7.position.x}, ${car7.position.z}`);
}

// --- Create Car 8 ---
/*
let car8 = {
    position: new THREE.Vector3(-20, CAR_Y_POS, -40), 
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(-1, 0, 0), 
    angle: -Math.PI / 2,
    currentAngleSprite: 0,
    sprite: null,
    textures: {},
    baseY: CAR_Y_POS, 
    id: 'car8'
};
*/

// Add state for car 9
/*
let car9 = {
    position: new THREE.Vector3(0, CAR_Y_POS, -45), // Center start
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, 1), 
    angle: 0,
    currentAngleSprite: 0,
    sprite: null,
    textures: {},
    baseY: CAR_Y_POS, 
    id: 'car9'
};
*/

function createNpcs() {
    if (!npcTexturesLoaded || npcTextures.length === 0) {
        console.warn("NPC textures not loaded or empty, cannot create NPCs.");
        return;
    }

    const npcScale = SPRITE_SCALE * 1.0; // Make NPCs same size as player
    const npcYPos = npcScale / 2 - 0.075; // Same ground logic as player

    for (let i = 0; i < NUM_NPCS; i++) {
        const startX = (Math.random() - 0.5) * 40; // Spread them out initially
        const startZ = -5 - Math.random() * 40;
        const startPos = new THREE.Vector3(startX, npcYPos, startZ);

        // Ensure they don't start on road
        if (Math.abs(startPos.x) < ROAD_WIDTH / 2 + 1) startPos.x += Math.sign(startPos.x || 1) * (ROAD_WIDTH / 2 + 2);

        // Randomly assign an NPC type
        const npcTypeIndex = Math.floor(Math.random() * npcTextures.length);
        const assignedNpcTextures = npcTextures[npcTypeIndex];

        const initialState = Math.random() < 0.5 ? 'idle' : 'walk';
        const initialAngle = NPC_ANGLES[Math.floor(Math.random() * NPC_ANGLES.length)];
        const initialTexture = assignedNpcTextures[initialState]?.[initialAngle]?.[0];

        if (!initialTexture) {
            console.warn(`Could not get initial texture for NPC ${i} (type ${npcTypeIndex}), state: ${initialState}, angle: ${initialAngle}. Skipping.`);
            continue;
        }

        const material = new THREE.MeshBasicMaterial({
            map: initialTexture,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            // Give different NPC types slightly different base tints
            color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.0, 0.0, 0.7 + Math.random() * 0.2) // subtle grey variation
            // color: 0xbbbbbb // Slightly different tint for NPCs
        });
        const geometry = new THREE.PlaneGeometry(npcScale, npcScale);
        const sprite = new THREE.Mesh(geometry, material);
        sprite.position.copy(startPos);
        scene.add(sprite);

        npcs.push({
            id: i,
            npcTypeIndex: npcTypeIndex, // Store which texture set this NPC uses
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
function createPowEffect(position, effectType = 'punch') {
    // Select texture based on type
    const effectTexture = (effectType === 'car') ? bangTexture : powTexture;

    if (!effectTexture) {
        console.warn("Effect texture not loaded, cannot create effect.");
        return;
    }

    const material = new THREE.MeshBasicMaterial({
        map: effectTexture.clone(),
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
    composer.setSize(window.innerWidth, window.innerHeight); // Also resize composer

    // Update CRT shader resolution
    if (crtPass) {
        crtPass.uniforms.resolution.value.set(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio
        );
        // Update scanline count based on new height
        crtPass.uniforms.scanlineCount.value = window.innerHeight * window.devicePixelRatio * 0.6;
    }
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
            let closestCar = null;
            let minDistSq = INTERACTION_DISTANCE * INTERACTION_DISTANCE;

            // Iterate through all cars to find the closest one within range
            for (const targetCar of allCars) {
                if (!targetCar.sprite) continue; // Skip if sprite doesn't exist
                const distSq = character.position.distanceToSquared(targetCar.position);
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closestCar = targetCar;
                }
            }

            // If close to a car, enter it
            if (closestCar) {
                playerControlMode = 'car';
                currentDrivingCar = closestCar; // Set the currently driven car
                characterSprite.visible = false;
                // Optional: Reset car state
                currentDrivingCar.velocity.set(0, 0, 0);
                
                // Snap camera behind the entered car
                cameraHorizontalAngle = currentDrivingCar.angle + Math.PI; 
                targetCameraVerticalAngle = CAMERA_VERTICAL_ANGLE_CAR_RAD;
                forceCameraUpdate(); // Force immediate camera update

                console.log(`Entered ${currentDrivingCar.id}`); // Log which car was entered
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

    // --- CRT Toggle --- (Key P)
    if (event.code === 'KeyP') {
        isCrtEnabled = !isCrtEnabled;
        if (crtPass) {
            crtPass.enabled = isCrtEnabled;
            console.log("CRT Effect:", isCrtEnabled ? "ON" : "OFF");
            // Apply current preset when turning ON
            if (isCrtEnabled) {
                applyCrtFilterPreset(); 
            }
        }
    }
    // --- End CRT Toggle ---

    // --- CRT Filter Cycle --- (Key L)
    if (event.code === 'KeyL' && isCrtEnabled) {
        currentCrtFilterIndex = (currentCrtFilterIndex + 1) % crtFilterPresets.length;
        applyCrtFilterPreset();
    }
    // --- End CRT Filter Cycle ---

    // --- Fullscreen Toggle --- (Key O)
    if (event.code === 'KeyO') {
        toggleFullscreen();
    }
    // --- End Fullscreen Toggle ---

    // --- Gun Equip/Unequip ---
    if (event.code === 'Digit2') {
        hasGun = true;
        character.state = 'idle';
        character.currentFrame = 0;
        character.frameTime = 0;
        isAiming = false;
        isShooting = false;
        isGunShootQueued = false;
        CAMERA_OFFSET.z = 1.8;
        crosshair.style.display = 'none';
    }
    if (event.code === 'Digit1') {
        hasGun = false;
        character.state = 'idle';
        character.currentFrame = 0;
        character.frameTime = 0;
        isAiming = false;
        isShooting = false;
        isGunShootQueued = false;
        CAMERA_OFFSET.z = 1.8;
        crosshair.style.display = 'none';
    }
    // ... existing code ...
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

    if (hasGun && isAiming) {
        crosshairVerticalOffset += event.movementY * MOUSE_SENSITIVITY; // Use same sensitivity as horizontal
        crosshairVerticalOffset = Math.max(-0.4, Math.min(0.4, crosshairVerticalOffset)); // Keep increased range
    } else {
        crosshairVerticalOffset = 0;
    }
}

// Add MouseDown handler
function onMouseDown(event) {
    if (hasGun && playerControlMode === 'character') {
        if (event.button === 2) { // Right click: aim
            isAiming = true;
            crosshair.style.display = 'block';
            CAMERA_OFFSET.z = 1.0;
            // Freeze vertical angle
            if (aimVerticalAngle === null) aimVerticalAngle = cameraVerticalAngle;
            event.preventDefault();
            return;
        }
        if (event.button === 0) { // Left click: shoot
            isLeftMouseDown = true;
            isGunShootQueued = true;
            isShooting = true;
            character.state = 'gunshoot';
            character.currentFrame = 0;
            character.frameTime = 0;
            event.preventDefault();
            return;
        }
    }
    // Punch logic (if not in gun mode)
    if (event.button === 0 && playerControlMode === 'character' && character.isOnGround && !character.isPunching && character.state !== 'jump' && !hasGun) {
        character.state = 'punch';
        character.isPunching = true;
        character.punchedThisAction = false;
        character.currentFrame = 0;
        character.frameTime = 0;
        character.velocity.x = 0;
        character.velocity.z = 0;
    }
}

window.addEventListener('mouseup', function(event) {
    if (event.button === 2 && hasGun && playerControlMode === 'character') {
        isAiming = false;
        crosshair.style.display = 'none';
        CAMERA_OFFSET.z = 1.8;
        crosshairVerticalOffset = 0; // Reset on aim end
        // Restore vertical angle
        if (aimVerticalAngle !== null) {
            cameraVerticalAngle = aimVerticalAngle;
            targetCameraVerticalAngle = aimVerticalAngle;
            aimVerticalAngle = null;
        }
        if (character.isOnGround && !character.isPunching && character.state !== 'jump') {
            if (keyboard['KeyW'] || keyboard['KeyS'] || keyboard['KeyA'] || keyboard['KeyD']) {
                character.state = keyboard['ShiftLeft'] ? 'rungun' : 'walkgun';
            } else {
                character.state = 'idlegun';
            }
        }
    }
    if (event.button === 0 && hasGun && playerControlMode === 'character') {
        isLeftMouseDown = false;
    }
});

// --- Update Logic ---
function updateCharacter(deltaTime) {
    if (!characterSprite || !texturesLoaded) return;

    // --- Always update facing while aiming ---
    if (hasGun && isAiming) {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        if (camDir.lengthSq() > 0.001) {
            camDir.normalize();
            character.forward.copy(camDir);
            character.lastMovementForward.copy(camDir);
        }
    }

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
    if (character.isOnGround && !character.isPunching && character.state !== 'jump' && !hasGun) {
        if (wantsToMoveHorizontally) {
            character.state = wantsToRun ? 'run' : 'walk';
        } else {
            character.state = 'idle';
        }
    }

    // Gun movement state logic
    if (hasGun && character.isOnGround && !character.isPunching && character.state !== 'jump') {
        if (isGunShootQueued) {
            character.state = 'gunshoot';
        } else if (isAiming) {
            character.state = 'gunaim';
        } else if (wantsToMoveHorizontally) {
            character.state = wantsToRun ? 'rungun' : 'walkgun';
        } else {
            character.state = 'idlegun';
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
    
    // --- Fence Collision (Island Boundary Check) ---
    const fenceBounds = {
        minX: -ISLAND_WIDTH / 2 + FENCE_COLLISION_MARGIN,
        maxX: ISLAND_WIDTH / 2 - FENCE_COLLISION_MARGIN,
        minZ: -ISLAND_LENGTH / 2 + FENCE_COLLISION_MARGIN,
        maxZ: ISLAND_LENGTH / 2 - FENCE_COLLISION_MARGIN
    };
    if (potentialPosition.x < fenceBounds.minX || potentialPosition.x > fenceBounds.maxX ||
        potentialPosition.z < fenceBounds.minZ || potentialPosition.z > fenceBounds.maxZ) {
        collisionDetected = true;
    }
    // --- End Fence Collision ---

    // Tree collision check
    if (!collisionDetected) { // Only check if not already collided with fence
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
    // Add collision check for car 3
    if (!collisionDetected && car3.sprite) { 
        const dxCar3 = potentialPosition.x - car3.position.x;
        const dzCar3 = potentialPosition.z - car3.position.z;
        const distSqCar3 = dxCar3 * dxCar3 + dzCar3 * dzCar3;
        const radiiSumCar3 = CHARACTER_COLLISION_RADIUS + CAR_COLLISION_RADIUS;
        if (distSqCar3 < radiiSumCar3 * radiiSumCar3) {
            collisionDetected = true;
        }
    }
    // Add collision check for car 4
    if (!collisionDetected && car4.sprite) { 
        const dxCar4 = potentialPosition.x - car4.position.x;
        const dzCar4 = potentialPosition.z - car4.position.z;
        const distSqCar4 = dxCar4 * dxCar4 + dzCar4 * dzCar4;
        const radiiSumCar4 = CHARACTER_COLLISION_RADIUS + CAR_COLLISION_RADIUS;
        if (distSqCar4 < radiiSumCar4 * radiiSumCar4) {
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
        case 'rungun': currentFrameDuration = RUN_FRAME_DURATION; break;
        case 'walk': currentFrameDuration = WALK_FRAME_DURATION; break;
        case 'walkgun': currentFrameDuration = WALK_FRAME_DURATION; break;
        case 'jump': currentFrameDuration = JUMP_FRAME_DURATION; break;
        case 'punch': currentFrameDuration = PUNCH_FRAME_DURATION; break;
        case 'gunshoot': currentFrameDuration = PUNCH_FRAME_DURATION * 0.7; break; // Make gunshoot a bit faster
        default: currentFrameDuration = IDLE_FRAME_DURATION; break;
    }
    if (character.frameTime >= currentFrameDuration) {
        character.frameTime -= currentFrameDuration;
        const previousFrame = character.currentFrame;
        const nextFrame = (character.currentFrame + 1) % FRAME_COUNT;
        // --- Gunshoot: trigger PEW effect at the START of the animation (frame 0) ---
        if (character.state === 'gunshoot' && nextFrame === 1) {
            createPewEffect(character.position, character.forward);
            createMuzzleFlashEffect(character.position, character.forward);
            // --- Spawn projectile ---
            let from = character.position.clone();
            let dir;
            if (hasGun && isAiming) {
                from.y += SPRITE_SCALE * 0.45; // Chest height (aimed)
                // Ray from camera through crosshair
                // Calculate world direction from camera with crosshairVerticalOffset
                const camDir = new THREE.Vector3();
                camera.getWorldDirection(camDir);
                // Apply vertical offset (crosshairVerticalOffset is -0.4 to 0.4)
                // We'll rotate camDir up/down by a small angle
                const up = new THREE.Vector3(0, 1, 0);
                const right = new THREE.Vector3().crossVectors(camDir, up).normalize();
                const verticalAngle = -crosshairVerticalOffset * 0.4; // Increased factor for higher/lower shots
                dir = camDir.clone().applyAxisAngle(right, verticalAngle).normalize();
            } else {
                from.y += SPRITE_SCALE * 0.32; // Lower height for non-aimed shots
                // Add spread: random horizontal and vertical angle (±5 degrees)
                const spreadH = (Math.random() - 0.5) * (Math.PI / 18); // ±10°/2 = ±5°
                const spreadV = (Math.random() - 0.5) * (Math.PI / 36); // ±5°/2 = ±2.5°
                dir = character.forward.clone();
                // Apply horizontal spread (rotate around Y axis)
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadH);
                // Apply vertical spread (rotate around right axis)
                const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
                dir.applyAxisAngle(right, spreadV);
                dir.normalize();
            }
            spawnProjectile(from, dir);
        }
        character.currentFrame = nextFrame;
        // --- Gunshoot animation end: allow rapid fire ---
        if (character.state === 'gunshoot' && nextFrame === 0) {
            if (isLeftMouseDown) {
                // Rapid fire: immediately start another shot
                isGunShootQueued = true;
                isShooting = true;
                character.state = 'gunshoot';
                character.currentFrame = 0;
                character.frameTime = 0;
            } else {
                isGunShootQueued = false;
                isShooting = false;
                if (hasGun && isAiming) {
                    character.state = 'gunaim';
                } else if (hasGun) {
                    if (wantsToMoveHorizontally) {
                        character.state = wantsToRun ? 'rungun' : 'walkgun';
                    } else {
                        character.state = 'idlegun';
                    }
                }
            }
        }
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
    // Choose correct animation set based on hasGun, isAiming, isShooting
    let animState = character.state;
    if (hasGun) {
        if (character.state === 'gunshoot') animState = 'gunshoot';
        else if (character.state === 'gunaim') animState = 'gunaim';
        else if (character.state === 'idle') animState = 'idlegun';
        else if (character.state === 'walk') animState = 'walkgun';
        else if (character.state === 'run') animState = 'rungun';
    }
    const currentAnimationTextures = textures[animState]?.[character.currentAngle];
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

    // --- GUN SPRITE SCALE LOGIC ---
    // Make gun states even larger (18% bigger)
    const gunStates = ['idlegun', 'walkgun', 'rungun', 'gunaim', 'gunshoot'];
    let yOffset = 0;
    if (gunStates.includes(animState)) {
        characterSprite.scale.set(SPRITE_SCALE * 1.18, SPRITE_SCALE * 1.18, 1);
        yOffset = SPRITE_SCALE * 0.02;
    } else {
        characterSprite.scale.set(SPRITE_SCALE, SPRITE_SCALE, 1);
        yOffset = 0;
    }
    // Adjust Y position so feet stay on ground
    characterSprite.position.copy(character.position);
    characterSprite.position.y += yOffset;

    // 9. Billboard the sprite
    const lookAtTarget = new THREE.Vector3(camera.position.x, characterSprite.position.y, camera.position.z);
    characterSprite.lookAt(lookAtTarget);

    // In updateCharacter, before angle calculation (after movement/collision logic):
    if (hasGun && isAiming) {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        if (camDir.lengthSq() > 0.001) {
            camDir.normalize();
            character.forward.copy(camDir);
            character.lastMovementForward.copy(camDir);
        }
    }
}

function updateTrees(deltaTime) {
    if (!treeTexturesLoaded) return;

    // Use TREE constants now
    const angleIncrement = TREE_ANGLE_INCREMENT; 
    const numAngles = NUM_TREE_ANGLES; 

    for (const treeSprite of treeSprites) {
        // 1. Calculate Angle to Camera
        const vecToCam = new THREE.Vector3().subVectors(camera.position, treeSprite.position);
        vecToCam.y = 0; // Ignore vertical difference

        if (vecToCam.lengthSq() > 0.001) {
            vecToCam.normalize();
            const camAngleRad = Math.atan2(vecToCam.x, vecToCam.z);
            let angleDeg = THREE.MathUtils.radToDeg(camAngleRad);
            angleDeg = (angleDeg + 360) % 360; // Normalize to [0, 360)

            // Quantize to nearest angle (using TREE constants)
            const quantizedIndex = Math.round(angleDeg / angleIncrement) % numAngles;
            const quantizedAngle = TREE_ANGLES[quantizedIndex]; // Get the float angle key

            // 2. Update Texture if needed
            const targetTexture = treeTextures[quantizedAngle]; // Use float angle key for lookup
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
    // --- Refactored Car-vs-Car Collision Check ---
    for (const otherCar of allCars) {
        // Skip checking against self or cars without sprites
        if (otherCar === drivingCar || !otherCar.sprite) continue; 

        if (!collisionDetected) { // Check only if no collision detected yet in this frame
            const dx = potentialPosition.x - otherCar.position.x;
            const dz = potentialPosition.z - otherCar.position.z;
            const distSqXZ = dx * dx + dz * dz;
            const radiiSum = CAR_COLLISION_RADIUS + CAR_COLLISION_RADIUS; // Car vs Car
            if (distSqXZ < radiiSum * radiiSum) {
                 // Calculate rebound vector
                 const reboundDir = drivingCar.position.clone().sub(otherCar.position).normalize();
                 reboundDir.y = 0; // Keep rebound horizontal
                 drivingCar.velocity.copy(reboundDir).multiplyScalar(CAR_REBOUND_SPEED); 
                 // Optionally push the other car slightly
                 const impulseDir = drivingCar.position.clone().sub(otherCar.position).normalize();
                 otherCar.velocity.add(impulseDir.multiplyScalar(-CAR_REBOUND_SPEED * 0.5)); // Push other car slightly less
                 collisionDetected = true;
                 console.log(`Driving car ${drivingCar.id} collided with ${otherCar.id}`);
                 break; // Stop checking after the first car collision this frame
            }
        }
    }
    // --- End Refactored Check ---

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

    // --- Potential Position and Fence Collision Check ---
    const potentialPosition = carObj.position.clone().add(carObj.velocity.clone().multiplyScalar(deltaTime));
    let collisionDetected = false;
    const fenceBounds = {
        minX: -ISLAND_WIDTH / 2 + FENCE_COLLISION_MARGIN,
        maxX: ISLAND_WIDTH / 2 - FENCE_COLLISION_MARGIN,
        minZ: -ISLAND_LENGTH / 2 + FENCE_COLLISION_MARGIN,
        maxZ: ISLAND_LENGTH / 2 - FENCE_COLLISION_MARGIN
    };
    if (potentialPosition.x < fenceBounds.minX || potentialPosition.x > fenceBounds.maxX ||
        potentialPosition.z < fenceBounds.minZ || potentialPosition.z > fenceBounds.maxZ) {
        collisionDetected = true;
        // Implement proper rebound off fence
        if (potentialPosition.x < fenceBounds.minX) {
            carObj.velocity.x = CAR_REBOUND_SPEED; // Bounce right
            carObj.velocity.z *= 0.5; // Dampen other axis slightly
        } else if (potentialPosition.x > fenceBounds.maxX) {
            carObj.velocity.x = -CAR_REBOUND_SPEED; // Bounce left
            carObj.velocity.z *= 0.5;
        }
        // Separate check for Z to handle corners better (apply both if needed)
        if (potentialPosition.z < fenceBounds.minZ) {
            carObj.velocity.z = CAR_REBOUND_SPEED; // Bounce forward (+Z)
            // Only dampen X if it wasn't just set by X collision
            if (potentialPosition.x >= fenceBounds.minX && potentialPosition.x <= fenceBounds.maxX) {
                carObj.velocity.x *= 0.5;
            }
        } else if (potentialPosition.z > fenceBounds.maxZ) {
            carObj.velocity.z = -CAR_REBOUND_SPEED; // Bounce backward (-Z)
            // Only dampen X if it wasn't just set by X collision
            if (potentialPosition.x >= fenceBounds.minX && potentialPosition.x <= fenceBounds.maxX) {
                carObj.velocity.x *= 0.5;
            }
        }
    }
    // --- End Fence Collision Check ---

    // --- Update Position based on Velocity --- (Only if no collision)
    // Collision detection for non-driven cars isn't fully implemented here (e.g., vs trees/buildings)
    // but fence collision IS handled above.
    if (!collisionDetected) {
        carObj.position.add(carObj.velocity.clone().multiplyScalar(deltaTime));
    }
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
    if (playerControlMode === 'car' && currentDrivingCar) {
        currentTargetPos = currentDrivingCar.position.clone().add(CAMERA_TARGET_OFFSET);
        isDriving = true;
        offsetToUse = CAMERA_OFFSET_CAR;
    } else if (playerControlMode === 'character' && character) {
        currentTargetPos = character.position.clone().add(CAMERA_TARGET_OFFSET);
    } else {
        return;
    }

    const targetPos = currentTargetPos;

    // --- Update Camera Angles ---
    let finalHorizontalAngle = cameraHorizontalAngle;
    if (isDriving && currentDrivingCar) {
        const targetHorizontalAngle = currentDrivingCar.angle + Math.PI;
        const shortestAngle = Math.atan2(Math.sin(targetHorizontalAngle - cameraHorizontalAngle), 
                                       Math.cos(targetHorizontalAngle - cameraHorizontalAngle));
        
        // Use exponential smoothing for angle
        const angleLerpFactor = 1.0 - Math.exp(-CAMERA_ANGLE_FOLLOW_SPEED * deltaTime);
        cameraHorizontalAngle += shortestAngle * angleLerpFactor;
        finalHorizontalAngle = cameraHorizontalAngle;
    }
    
    // Smoothly interpolate vertical angle with exponential smoothing
    const verticalLerpFactor = 1.0 - Math.exp(-CAMERA_VERTICAL_SMOOTH_SPEED * deltaTime);
    cameraVerticalAngle = THREE.MathUtils.lerp(cameraVerticalAngle, targetCameraVerticalAngle, verticalLerpFactor);
    const finalVerticalAngle = cameraVerticalAngle;

    // Calculate rotation quaternions
    const rotationY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), finalHorizontalAngle);
    const rotationX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), finalVerticalAngle);
    const cameraRotation = new THREE.Quaternion().multiplyQuaternions(rotationY, rotationX);

    // Calculate desired camera position with exponential smoothing
    const desiredOffset = offsetToUse.clone().applyQuaternion(cameraRotation);
    const desiredPosition = targetPos.clone().add(desiredOffset);

    // Prevent camera floor clipping
    if (desiredPosition.y < CAMERA_MIN_Y) {
        desiredPosition.y = CAMERA_MIN_Y;
    }

    // Use exponential smoothing for position
    const positionLerpFactor = 1.0 - Math.exp(-CAMERA_SMOOTH_SPEED * deltaTime);
    if (deltaTime > 0) {
        camera.position.lerp(desiredPosition, positionLerpFactor);
    }
   
    // Look at target with slight smoothing
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    const targetLookAt = targetPos.clone().sub(camera.position).normalize();
    const lookAtLerpFactor = 1.0 - Math.exp(-CAMERA_SMOOTH_SPEED * 1.5 * deltaTime);
    currentLookAt.lerp(targetLookAt, lookAtLerpFactor);
    camera.lookAt(camera.position.clone().add(currentLookAt));
}

function updateNpcs(deltaTime) {
    if (!npcTexturesLoaded || npcTextures.length === 0) return;

    const angleIncrement = NPC_ANGLE_INCREMENT;
    const numAngles = NPC_ANGLES.length;
    const npcYPos = (SPRITE_SCALE * 1.0) / 2 - 0.075; // Recalculate based on scale used in createNpcs

    for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        const currentNpcTextures = npcTextures[npc.npcTypeIndex]; // Get textures for this NPC's type

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
            // Ensure billboarding even in hit state
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
         // Vs Car 3
         if (!collisionDetected && car3.sprite && currentDrivingCar !== car3) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(car3.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- Static Car 3 Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("Static Car 3 hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = car3.forward.clone();
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
         // Vs Car 4
         if (!collisionDetected && car4.sprite && currentDrivingCar !== car4) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(car4.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- Static Car 4 Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("Static Car 4 hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = car4.forward.clone();
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
         // Vs Car 5
         if (!collisionDetected && car5.sprite && currentDrivingCar !== car5) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(car5.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- Static Car 5 Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("Static Car 5 hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = car5.forward.clone();
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
         // Vs Car 6
         if (!collisionDetected && car6.sprite && currentDrivingCar !== car6) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(car6.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- Static Car 6 Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("Static Car 6 hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = car6.forward.clone();
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
         // Vs Car 7
         if (!collisionDetected && car7.sprite && currentDrivingCar !== car7) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(car7.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- Static Car 7 Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("Static Car 7 hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = car7.forward.clone();
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
         // Vs Car 8
         /*
         if (!collisionDetected && car8.sprite && currentDrivingCar !== car8) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(car8.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- Static Car 8 Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("Static Car 8 hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = car8.forward.clone();
                      if(impulseDirection.lengthSq() < 0.01) impulseDirection.set(0,0,1);
                      impulseDirection.normalize();
                      npc.velocity.copy(impulseDirection).multiplyScalar(CAR_HIT_IMPULSE_HORIZONTAL * 0.5);
                      npc.velocity.y = CAR_HIT_IMPULSE_VERTICAL * 0.5;
                      npc.timeUntilNextDecision = 10; 
                      createPowEffect(npc.position, 'car'); // Use 'car' type for BANG
                      npc.position.add(npc.velocity.clone().multiplyScalar(deltaTime)); 
                      npc.sprite.position.copy(npc.position);
                  }
               }
          }
         */
         // Vs Car 9
         /*
         if (!collisionDetected && car9.sprite && currentDrivingCar !== car9) {
              const radiiSum = NPC_COLLISION_RADIUS + CAR_COLLISION_RADIUS; 
              const distSq = potentialPosition.distanceToSquared(car9.position);
              if (distSq < radiiSum * radiiSum) {
                  collisionDetected = true;
                  // --- Static Car 9 Hit NPC Logic --- 
                  if (npc.state !== 'hit') { 
                      console.log("Static Car 9 hit NPC!", npc.id);
                      npc.state = 'hit';
                      let impulseDirection = car9.forward.clone();
                      if(impulseDirection.lengthSq() < 0.01) impulseDirection.set(0,0,1);
                      impulseDirection.normalize();
                      npc.velocity.copy(impulseDirection).multiplyScalar(CAR_HIT_IMPULSE_HORIZONTAL * 0.5);
                      npc.velocity.y = CAR_HIT_IMPULSE_VERTICAL * 0.5;
                      npc.timeUntilNextDecision = 10; 
                      createPowEffect(npc.position, 'car'); // Use 'car' type for BANG
                      npc.position.add(npc.velocity.clone().multiplyScalar(deltaTime)); 
                      npc.sprite.position.copy(npc.position);
                  }
               }
          }
         */
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
                      createPowEffect(npc.position, 'car'); // Use 'car' type for BANG
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
                angleDeg = (360 - angleDeg) % 360; // <<< Apply mirroring fix (like player character)
                
                // Quantize to nearest NPC angle (45 degree increments)
                const quantizedIndex = Math.round(angleDeg / angleIncrement) % numAngles;
                npc.currentAngle = NPC_ANGLES[quantizedIndex];
            } // else keep previous angle
        } // End of check for npc.state !== 'hit' for angle calculation

        // --- Texture Update ---
        // Determine which state's textures to use
        const textureStateToUse = (npc.state === 'hit') ? 'idle' : npc.state; // Use idle textures if hit
        // Use the specific texture set for this NPC type
        const stateTextures = currentNpcTextures[textureStateToUse];

        if (stateTextures && stateTextures[npc.currentAngle] && stateTextures[npc.currentAngle][npc.currentFrame]) {
            npc.sprite.material.map = stateTextures[npc.currentAngle][npc.currentFrame];
            npc.sprite.material.needsUpdate = true;
        } else {
             // Fallback if texture missing (e.g., angle/frame combo invalid for the chosen state)
             // Use the fallback from the specific NPC type's textures
             const fallbackTexture = currentNpcTextures.idle?.[0]?.[0];
             if (fallbackTexture && npc.sprite.material.map !== fallbackTexture) {
                  npc.sprite.material.map = fallbackTexture;
                  npc.sprite.material.needsUpdate = true;
             }
        }

        // --- Billboarding (only if not hit) ---
        if (npc.state !== 'hit') { // Add check here
            const lookAtTarget = new THREE.Vector3(camera.position.x, npc.sprite.position.y, camera.position.z);
            npc.sprite.lookAt(lookAtTarget);
        }
    }
}

// --- Animation Loop ---
let animationFrameId = null;
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    let deltaTime = clock.getDelta();

    // Clamp deltaTime to prevent huge jumps after tab out
    deltaTime = Math.min(deltaTime, 0.1); // Max step of 0.1 seconds

    // Update CRT time uniform
    if (crtPass && isCrtEnabled) {
        crtPass.uniforms.time.value += deltaTime;
    }

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
    if (car3TexturesLoaded && currentDrivingCar !== car3) {
        updateCarVisuals(car3, deltaTime);
    }
    if (car4TexturesLoaded && currentDrivingCar !== car4) {
        updateCarVisuals(car4, deltaTime);
    }
    if (car5TexturesLoaded && currentDrivingCar !== car5) {
        updateCarVisuals(car5, deltaTime);
    }
    if (car6TexturesLoaded && currentDrivingCar !== car6) {
        updateCarVisuals(car6, deltaTime);
    }
    if (car7TexturesLoaded && currentDrivingCar !== car7) {
        updateCarVisuals(car7, deltaTime);
    }
    /*
    // Update visuals for car8 if not driven
    if (car8TexturesLoaded && currentDrivingCar !== car8) {
        updateCarVisuals(car8, deltaTime);
    }
    // Update visuals for car9 if not driven
    if (car9TexturesLoaded && currentDrivingCar !== car9) {
        updateCarVisuals(car9, deltaTime);
    }
    */

    if (npcTexturesLoaded) { // Update NPCs
        updateNpcs(deltaTime);
    }
    
    // Update Pow Effects
    updatePowEffects(deltaTime); // Add call to update POW effects
    updatePoofEffects(deltaTime); // <-- Add this line to update poof effects every frame

    // Update water time uniform for wave animation
    if (window.water) {
        window.water.material.uniforms['time'].value += deltaTime / 2.0; // Adjust speed as needed
    }

    composer.render(); 

    // In the animate() function, update crosshair position for aiming:
    if (crosshair) {
        if (hasGun && isAiming) {
            // Move to 53% for better alignment, plus vertical offset
            const baseTop = 53;
            const offset = crosshairVerticalOffset * 10; // -2 to +2 percent
            crosshair.style.top = `${baseTop + offset}%`;
        } else {
            crosshair.style.top = '50%';
        }
    }

    // --- In animate(), update projectiles ---
    updateProjectiles(deltaTime);
    updateBullethitEffects(deltaTime); // <-- Ensure this is here, after deltaTime is defined
}

// --- Start ---
init(); 

// --- Collision Helper Functions ---
function isCollidingWithSkyscraper(position, radius) {
    const halfBase = SKYSCRAPER_BASE_SIZE / 2;
    for (const buildingPos of skyscraperPositions) {
        // Calculate building bounds based on its centered position
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

// --- Fullscreen Toggle Function ---
function toggleFullscreen() {
    if (!document.fullscreenElement &&    // Standard syntax
        !document.mozFullScreenElement && // Firefox
        !document.webkitFullscreenElement && // Chrome, Safari and Opera
        !document.msFullscreenElement ) { // IE/Edge
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) { /* Firefox */
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        } else if (document.documentElement.msRequestFullscreen) { /* IE/Edge */
            document.documentElement.msRequestFullscreen();
        }
        console.log("Entering Fullscreen");
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { /* Firefox */
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE/Edge */
            document.msExitFullscreen();
        }
        console.log("Exiting Fullscreen");
    }
}

// --- Create Fences Function ---
function createFences() {
    if (!fenceTextureLoaded) {
        console.warn("Fence texture not loaded, cannot create fences.");
        return;
    }

    const fenceMaterial = new THREE.MeshBasicMaterial({
        map: fenceTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide // Show texture on both sides
    });

    // const fenceYPos = FENCE_HEIGHT / 2; // Previous calculation - Should place bottom at y=0
    const fenceYPos = FENCE_HEIGHT / 3 - 1; // Nudge down slightly to compensate for potential visual offset
    const fenceMeshes = [];

    // North Fence
    const northGeom = new THREE.PlaneGeometry(ISLAND_WIDTH, FENCE_HEIGHT);
    const northMat = fenceMaterial.clone();
    northMat.map = fenceTexture.clone();
    northMat.map.repeat.set(ISLAND_WIDTH / FENCE_TEXTURE_SECTION_WIDTH, 1);
    northMat.map.needsUpdate = true;
    const northFence = new THREE.Mesh(northGeom, northMat);
    northFence.position.set(0, fenceYPos, -ISLAND_LENGTH / 2 + FENCE_COLLISION_MARGIN);
    scene.add(northFence);
    fenceMeshes.push(northFence);

    // South Fence
    const southGeom = new THREE.PlaneGeometry(ISLAND_WIDTH, FENCE_HEIGHT);
    const southMat = fenceMaterial.clone();
    southMat.map = fenceTexture.clone();
    southMat.map.repeat.set(ISLAND_WIDTH / FENCE_TEXTURE_SECTION_WIDTH, 1);
    southMat.map.needsUpdate = true;
    const southFence = new THREE.Mesh(southGeom, southMat);
    southFence.position.set(0, fenceYPos, ISLAND_LENGTH / 2 - FENCE_COLLISION_MARGIN);
    southFence.rotation.y = Math.PI; // Rotate to face inwards (optional)
    scene.add(southFence);
    fenceMeshes.push(southFence);

    // West Fence
    const westGeom = new THREE.PlaneGeometry(ISLAND_LENGTH, FENCE_HEIGHT);
    const westMat = fenceMaterial.clone();
    westMat.map = fenceTexture.clone();
    westMat.map.repeat.set(ISLAND_LENGTH / FENCE_TEXTURE_SECTION_WIDTH, 1);
    westMat.map.needsUpdate = true;
    const westFence = new THREE.Mesh(westGeom, westMat);
    westFence.position.set(-ISLAND_WIDTH / 2 + FENCE_COLLISION_MARGIN, fenceYPos, 0);
    westFence.rotation.y = Math.PI / 2;
    scene.add(westFence);
    fenceMeshes.push(westFence);

    // East Fence
    const eastGeom = new THREE.PlaneGeometry(ISLAND_LENGTH, FENCE_HEIGHT);
    const eastMat = fenceMaterial.clone();
    eastMat.map = fenceTexture.clone();
    eastMat.map.repeat.set(ISLAND_LENGTH / FENCE_TEXTURE_SECTION_WIDTH, 1);
    eastMat.map.needsUpdate = true;
    const eastFence = new THREE.Mesh(eastGeom, eastMat);
    eastFence.position.set(ISLAND_WIDTH / 2 - FENCE_COLLISION_MARGIN, fenceYPos, 0);
    eastFence.rotation.y = -Math.PI / 2;
    scene.add(eastFence);
    fenceMeshes.push(eastFence);

    console.log(`Created ${fenceMeshes.length} fence segments.`);
}
// --- End Create Fences Function ---

// --- CRT Filter Presets ---
const crtFilterPresets = [
    { name: "Default", scanlineIntensity: 0.3, curvature: 4.0, vignette: 0.8, colorOffset: 0.0 },
    { name: "Intense Scanlines", scanlineIntensity: 0.6, curvature: 4.0, vignette: 0.8, colorOffset: 0.0 },
    { name: "Heavy Curvature", scanlineIntensity: 0.2, curvature: 2.0, vignette: 0.7, colorOffset: 0.002 },
    { name: "Strong Vignette", scanlineIntensity: 0.3, curvature: 5.0, vignette: 0.4, colorOffset: 0.0 },
    { name: "Color Aberration", scanlineIntensity: 0.1, curvature: 6.0, vignette: 0.9, colorOffset: 0.008 },
    { name: "Subtle", scanlineIntensity: 0.15, curvature: 6.0, vignette: 0.9, colorOffset: 0.0 },
    { name: "No Effects", scanlineIntensity: 0.0, curvature: 100.0, vignette: 1.0, colorOffset: 0.0 }, // Effectively off
];
let currentCrtFilterIndex = 0;
// --- End CRT Filter Presets ---

// --- Apply CRT Filter Preset Function ---
function applyCrtFilterPreset() {
    if (!crtPass || !crtFilterPresets || crtFilterPresets.length === 0) {
        console.warn("Cannot apply CRT preset: Pass or presets not ready.");
        return;
    }
    const preset = crtFilterPresets[currentCrtFilterIndex];
    crtPass.uniforms.scanlineIntensity.value = preset.scanlineIntensity;
    crtPass.uniforms.curvature.value = preset.curvature;
    crtPass.uniforms.vignette.value = preset.vignette;
    crtPass.uniforms.colorOffset.value = preset.colorOffset;
    // Note: scanlineCount and resolution are generally based on window size, not presets.
    console.log(`Applied CRT Preset: ${preset.name}`);
}
// --- End Apply CRT Filter Preset Function ---

let hasGun = false; // Track if the player has the gun equipped
let isAiming = false; // Track if the player is aiming
let isShooting = false; // Track if the player is shooting

// Add crosshair element to DOM if not present
let crosshair = document.getElementById('crosshair');
if (!crosshair) {
    crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    crosshair.style.position = 'fixed';
    crosshair.style.left = '50%';
    crosshair.style.top = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.width = '32px';
    crosshair.style.height = '32px';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.zIndex = '1000';
    crosshair.style.display = 'none';
    crosshair.innerHTML = `<svg width="32" height="32"><circle cx="16" cy="16" r="2" fill="white"/><line x1="16" y1="0" x2="16" y2="32" stroke="white" stroke-width="2"/><line x1="0" y1="16" x2="32" y2="16" stroke="white" stroke-width="2"/></svg>`;
    document.body.appendChild(crosshair);
}

// Add a new flag to track if a gunshot animation is playing
let isGunShootQueued = false;

// Move the crosshair slightly higher while aiming:
if (crosshair) {
    if (hasGun && isAiming) {
        crosshair.style.top = '45%'; // Move up from 50% to 45%
    } else {
        crosshair.style.top = '50%'; // Default position
    }
}

// Add createPewEffect function:
function createPewEffect(position, facingDirection) {
    if (!pewTexture) {
        console.warn("Pew texture not loaded, cannot create effect.");
        return;
    }
    // Calculate right vector from facingDirection
    const right = new THREE.Vector3().crossVectors(facingDirection, new THREE.Vector3(0, 1, 0)).normalize();
    // Offset to the right of the player
    const baseOffset = 1.0; // Slightly less than before
    // Add random jitter for rapid fire
    const jitter = (Math.random() - 0.5) * 0.5; // Keep some randomness
    const offset = right.clone().multiplyScalar(baseOffset + jitter);
    // Place effect at character's position + offset, above ground
    const pewPos = position.clone().add(offset);
    pewPos.y += 0.8 + (Math.random() - 0.5) * 0.2; // Lower than before, still with jitter
    const material = new THREE.MeshBasicMaterial({
        map: pewTexture.clone(),
        transparent: true,
        alphaTest: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 1.0
    });
    const geometry = new THREE.PlaneGeometry(POW_EFFECT_SCALE * 1.1, POW_EFFECT_SCALE * 1.1); // Smaller scale
    const sprite = new THREE.Mesh(geometry, material);
    sprite.position.copy(pewPos);
    // Random initial tilt
    sprite.rotation.z = (Math.random() - 0.5) * 0.5;
    scene.add(sprite);
    activePowEffects.push({
        sprite: sprite,
        lifetime: POW_EFFECT_DURATION,
        timer: 0
    });
}

function createMuzzleFlashEffect(position, facingDirection) {
    if (!muzzleTexture) {
        console.warn("Muzzle texture not loaded, cannot create effect.");
        return;
    }
    // Calculate muzzle position: in front of and slightly above the character
    const forward = facingDirection.clone().normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const muzzleOffset = forward.clone().multiplyScalar(0.7).add(right.clone().multiplyScalar(0.18));
    const muzzlePos = position.clone().add(muzzleOffset);
    muzzlePos.y += 0.40; // Lower in all cases
    const material = new THREE.MeshBasicMaterial({
        map: muzzleTexture.clone(),
        transparent: true,
        alphaTest: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 1.0 // Less transparent (fully opaque)
    });
    const geometry = new THREE.PlaneGeometry(0.45, 0.32); // Small, wide flash
    const sprite = new THREE.Mesh(geometry, material);
    sprite.position.copy(muzzlePos);
    // Random initial tilt
    sprite.rotation.z = (Math.random() - 0.5) * 0.2;
    scene.add(sprite);
    activePowEffects.push({
        sprite: sprite,
        lifetime: 0.08, // Very short flash
        timer: 0
    });
}

// --- Projectile System ---
let projectiles = [];
const PROJECTILE_SPEED = 18.0;
const PROJECTILE_LIFETIME = 2.0;
const PROJECTILE_SCALE = 0.25;



// --- Bullet Sprite System ---
const BULLET_UUID = '1c30f9d5-f412-4001-8aa5-2ca3ea0f040f';
const BULLET_ANGLES = Array.from({ length: 64 }, (_, i) => i * 5.625);
let bulletTextures = {};

function loadBulletTextures() {
    for (const angle of BULLET_ANGLES) {
        const angleFloor = Math.floor(angle);
        const decimalPartTimes10 = (angle - angleFloor) * 10;
        let angleDecimal;
        if (Math.abs(decimalPartTimes10 - 2.5) < 0.01) {
            angleDecimal = 2;
        } else if (Math.abs(decimalPartTimes10 - 7.5) < 0.01) {
            angleDecimal = 8;
        } else {
            angleDecimal = Math.round(decimalPartTimes10);
        }
        const angleString = `${angleFloor}_${angleDecimal}`;
        const fileName = `${BULLET_UUID}_angle_${angleString}_0000.webp`;
        const filePath = `/sprites/bullet/${fileName}`;
        bulletTextures[angle] = textureLoader.load(filePath);
    }
}
loadBulletTextures();

// --- Update spawnProjectile to use bullet sprite based on character/camera angle ---
function spawnProjectile(from, direction) {
    // Calculate angle between character's forward and camera's forward (XZ plane)
    const charForward = character.forward.clone();
    charForward.y = 0; charForward.normalize();
    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward); camForward.y = 0; camForward.normalize();
    // Angle from character forward to camera forward (0 = away from camera, 180 = toward camera)
    let angleRad = Math.atan2(
        charForward.z * camForward.x - charForward.x * camForward.z,
        charForward.x * camForward.x + charForward.z * camForward.z
    );
    let angleDeg = (THREE.MathUtils.radToDeg(angleRad) + 360) % 360;
    // 0° = back, 180° = front, 90/270 = side
    const quantizedIndex = Math.round(angleDeg / 5.625) % 64;
    const spriteAngle = BULLET_ANGLES[quantizedIndex];
    const bulletTexture = bulletTextures[spriteAngle] || null;
    const geometry = new THREE.PlaneGeometry(PROJECTILE_SCALE * 2, PROJECTILE_SCALE);
    const material = new THREE.MeshBasicMaterial({
        map: bulletTexture,
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(from);
    scene.add(mesh);
    projectiles.push({
        mesh,
        velocity: direction.clone().normalize().multiplyScalar(PROJECTILE_SPEED),
        lifetime: PROJECTILE_LIFETIME
    });
}



// --- Load bullethit effect texture ---
let bullethitTexture = null;
bullethitTexture = textureLoader.load('/sprites/effects/bullethit.webp');

// --- Bullethit Effect System ---
let activeBullethitEffects = [];
const BULLETHIT_LIFETIME = 0.7;
const BULLETHIT_GRAVITY = 4.0; // Faster fall

function spawnBullethitEffect(position) {
    if (!bullethitTexture) return;
    const geometry = new THREE.PlaneGeometry(0.32, 0.32);
    const material = new THREE.MeshBasicMaterial({
        map: bullethitTexture,
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0); // Centered in group
    // Random initial rotation
    mesh.rotation.z = Math.random() * Math.PI * 2;
    // Random rotation speed (faster)
    const rotSpeed = (Math.random() - 0.5) * 10.0; // -5 to +5 radians/sec
    // Initial downward velocity (faster)
    const velocity = new THREE.Vector3(0, -1.7, 0); // Falls down
    // Billboard group
    const group = new THREE.Group();
    group.position.copy(position);
    group.add(mesh);
    scene.add(group);
    activeBullethitEffects.push({
        group,
        mesh,
        velocity,
        rotSpeed,
        lifetime: BULLETHIT_LIFETIME
    });
}

function updateBullethitEffects(deltaTime) {
    for (let i = activeBullethitEffects.length - 1; i >= 0; i--) {
        const e = activeBullethitEffects[i];
        e.group.position.add(e.velocity.clone().multiplyScalar(deltaTime));
        e.velocity.y -= BULLETHIT_GRAVITY * deltaTime;
        e.mesh.rotation.z += e.rotSpeed * deltaTime;
        e.lifetime -= deltaTime;
        // Billboard the group to camera (Y axis only for comic effect)
        const camPos = camera.position.clone();
        camPos.y = e.group.position.y; // Only rotate around Y
        e.group.lookAt(camPos);
        if (e.lifetime <= 0) {
            scene.remove(e.group);
            activeBullethitEffects.splice(i, 1);
        }
    }
}

// --- Update updateProjectiles: add collision and bullethit effect ---
function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const prevPos = p.mesh.position.clone();
        p.mesh.position.add(p.velocity.clone().multiplyScalar(deltaTime));
        p.lifetime -= deltaTime;
        // --- Collision detection ---
        let hit = false;
        // 1. Ground (Y <= ground level)
        if (p.mesh.position.y <= SPRITE_SCALE / 2 - 0.075) {
            hit = true;
        }
        // 2. Trees
        for (const treePos of treePositions) {
            if (p.mesh.position.distanceToSquared(treePos) < 0.7 * 0.7) {
                hit = true;
                break;
            }
        }
        // 3. Cars
        for (const carObj of allCars) {
            if (carObj.sprite && p.mesh.position.distanceToSquared(carObj.position) < 1.2 * 1.2) {
                hit = true;
                break;
            }
        }
        // 4. NPCs
        for (const npc of npcs) {
            if (npc.sprite && p.mesh.position.distanceToSquared(npc.position) < 0.7 * 0.7) {
                // --- Launch NPC in a comical arc ---
                const away = npc.position.clone().sub(p.mesh.position).normalize();
                away.y = 0;
                if (away.lengthSq() < 0.01) away.set(1, 0, 0); // fallback
                npc.velocity.copy(away.multiplyScalar(12.0)); // strong horizontal impulse
                npc.velocity.y = 10.0 + Math.random() * 3.0; // strong upward
                npc.state = 'hit';
                npc.timeUntilNextDecision = 10;
                // --- Spawn 3 poof effects at hit position ---
                for (let k = 0; k < 3; k++) {
                    spawnPoofEffect(p.mesh.position, away);
                }
                hit = true;
                break;
            }
        }
        // 5. Buildings (skyscrapers) - use isCollidingWithSkyscraper
        if (isCollidingWithSkyscraper(p.mesh.position, 0.16)) {
            hit = true;
        }
        // 6. Island boundary (walls/fence)
        if (
            p.mesh.position.x < -ISLAND_WIDTH / 2 + 0.2 ||
            p.mesh.position.x > ISLAND_WIDTH / 2 - 0.2 ||
            p.mesh.position.z < -ISLAND_LENGTH / 2 + 0.2 ||
            p.mesh.position.z > ISLAND_LENGTH / 2 - 0.2
        ) {
            hit = true;
        }
        // Billboard to camera only
        p.mesh.lookAt(camera.position);
        if (hit || p.lifetime <= 0) {
            spawnBullethitEffect(p.mesh.position);
            scene.remove(p.mesh);
            projectiles.splice(i, 1);
        }
    }
}



// --- Load poof effect texture ---
poofTexture = textureLoader.load('/sprites/effects/poof.webp');

// --- Poof Effect System ---

function spawnPoofEffect(position, baseDir) {
    if (!poofTexture) return;
    // Make poof bigger
    const geometry = new THREE.PlaneGeometry(1.2, 1.2); // Increased from 0.6, 0.6
    const material = new THREE.MeshBasicMaterial({
        map: poofTexture,
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide,
        opacity: 1.0
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    // Random initial rotation
    mesh.rotation.z = Math.random() * Math.PI * 2;
    // Billboard group
    const group = new THREE.Group();
    group.position.copy(position);
    group.add(mesh);
    scene.add(group);
    // Randomize direction and speed in any XZ direction
    const randomAngle = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(randomAngle), 0, Math.sin(randomAngle)).normalize();
    const velocity = dir.multiplyScalar(1.5 + Math.random() * 1.2);
    velocity.y = 1.2 + Math.random() * 0.7;
    activePoofEffects.push({
        group,
        mesh,
        velocity,
        lifetime: POOF_LIFETIME
    });
}

function updatePoofEffects(deltaTime) {
    for (let i = activePoofEffects.length - 1; i >= 0; i--) {
        const e = activePoofEffects[i];
        e.group.position.add(e.velocity.clone().multiplyScalar(deltaTime));
        e.velocity.y -= 3.5 * deltaTime; // gravity
        e.lifetime -= deltaTime;
        // Fade out
        e.mesh.material.opacity = Math.max(0, e.lifetime / POOF_LIFETIME);
        // Billboard the group to camera (Y axis only)
        const camPos = camera.position.clone();
        camPos.y = e.group.position.y;
        e.group.lookAt(camPos);
        if (e.lifetime <= 0) {
            scene.remove(e.group);
            activePoofEffects.splice(i, 1);
        }
    }
}

// --- NPC bullet hit logic ---
// In updateProjectiles, when a bullet hits an NPC:
// ... existing code ...
        // 4. NPCs
        for (const npc of npcs) {
            if (npc.sprite && p.mesh.position.distanceToSquared(npc.position) < 0.7 * 0.7) {
                // --- Launch NPC in a comical arc ---
                const away = npc.position.clone().sub(p.mesh.position).normalize();
                away.y = 0;
                if (away.lengthSq() < 0.01) away.set(1, 0, 0); // fallback
                npc.velocity.copy(away.multiplyScalar(12.0)); // strong horizontal impulse
                npc.velocity.y = 10.0 + Math.random() * 3.0; // strong upward
                npc.state = 'hit';
                npc.timeUntilNextDecision = 10;
                // --- Spawn 3 poof effects at hit position ---
                for (let k = 0; k < 3; k++) {
                    spawnPoofEffect(p.mesh.position, away);
                }
                hit = true;
                break;
            }
        }
