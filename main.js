import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let characterSprite;
let clock = new THREE.Clock();

// --- Configuration ---
const SPRITE_PATH = 'public/sprites/';
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]; // Assumes folders angle_0_0, angle_45_0 etc exist
const FRAME_COUNT = 10; // Assuming 10 frames per animation (e.g., _0000.png to _0009.png)
const WALK_FRAME_DURATION = 0.1; // Duration each walk frame is shown (in seconds)
const IDLE_FRAME_DURATION = 0.2; // Duration each idle frame is shown (in seconds)
const MOVEMENT_SPEED = 2.0; // Units per second
const SPRITE_SCALE = 2; // Adjust as needed for sprite size

// --- State ---
let character = {
    position: new THREE.Vector3(0, SPRITE_SCALE / 2, 0), // Start slightly above ground
    velocity: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, -1), // Initial facing direction
    state: 'idle', // 'idle' or 'walk'
    currentAngle: 0,
    currentFrame: 0,
    frameTime: 0
};

let keyboard = {}; // Keep track of pressed keys

// --- Textures ---
let textures = {
    idle: {}, // { 0: [tex0, tex1, ...], 45: [...], ... }
    walk: {}  // { 0: [tex0, tex1, ...], 45: [...], ... }
};
let texturesLoaded = false;
let textureLoader = new THREE.TextureLoader();

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080); // Grey background
    scene.fog = new THREE.Fog(0x808080, 10, 50); // Add some fog for depth

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 2;
    controls.maxDistance = 20;
    // controls.maxPolarAngle = Math.PI / 2; // Prevent camera going below ground

    // Lighting (basic)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x606060, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Load Textures
    loadAllTextures().then(() => {
        console.log("Textures loaded!");
        texturesLoaded = true;
        createCharacterSprite();
        animate(); // Start animation loop only after textures are loaded
    }).catch(err => {
        console.error("Error loading textures:", err);
        // Handle error, maybe show a message to the user
    });

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
}

function getFrameFileName(baseName, angle, frame) {
    // Adjust this function based on the exact file naming convention
    // Example: 8e1f0a27-f775-462f-a943-18dcb69a3142_angle_0_0_0000.png
    // We need to figure out the base name part. Let's assume it's consistent for now.
    // For now, we'll use a placeholder - THIS NEEDS TO BE FIXED based on actual filenames
    // Let's assume the first file found gives the base name pattern
    const baseFileNamePart = "8e1f0a27-f775-462f-a943-18dcb69a3142"; // !!! HARDCODED - NEEDS FIX !!!
    const framePadded = String(frame).padStart(4, '0');
    return `${baseFileNamePart}_angle_${angle}_0_${framePadded}.png`;
}


async function loadAllTextures() {
    const promises = [];
    const states = {
        idle: "ab53bb77-f48c-4055-8e66-d8d56a26cdf4", // Prefix for Idle WEBP files
        walk: "c8db61a1-fda4-4f19-9db0-acdbcd2179de"  // Updated prefix for Walk WEBP files
    };

    console.log("Loading textures with prefixes:", states);

    for (const [state, baseFileNamePart] of Object.entries(states)) {
        textures[state] = {};
        // Determine state directory name (Idle or Walk)
        const stateDirName = state.charAt(0).toUpperCase() + state.slice(1);
        const statePath = `${SPRITE_PATH}${stateDirName}/`;

        if (!baseFileNamePart) {
            console.error(`Missing filename prefix configuration for state: ${state}`);
            continue; // Skip this state if prefix is not defined
        }

        for (const angle of ANGLES) {
            textures[state][angle] = [];
            const anglePath = `${statePath}angle_${angle}_0/`;

            for (let frame = 0; frame < FRAME_COUNT; frame++) {
                const framePadded = String(frame).padStart(4, '0');
                // Construct the specific filename using the correct prefix and .webp extension
                const fileName = `${baseFileNamePart}_angle_${angle}_0_${framePadded}.webp`;
                const filePath = anglePath + fileName;

                const promise = new Promise((resolve, reject) => {
                    textureLoader.load(filePath,
                        (texture) => {
                            texture.magFilter = THREE.NearestFilter; // Pixelated look
                            texture.minFilter = THREE.NearestFilter;
                            textures[state][angle][frame] = texture;
                            resolve(texture);
                        },
                        undefined, // onProgress callback not needed here
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


function createCharacterSprite() {
    // Use the first texture as a placeholder initially
    const initialTexture = textures.idle[0][0];
    if (!initialTexture) {
        console.error("Initial texture not available!");
        return;
    }

    const material = new THREE.MeshBasicMaterial({
        map: initialTexture,
        transparent: true, // Assume PNGs have transparency
        alphaTest: 0.5,    // Adjust if needed
        side: THREE.DoubleSide // Render both sides
    });

    const geometry = new THREE.PlaneGeometry(SPRITE_SCALE, SPRITE_SCALE); // Adjust size as needed
    characterSprite = new THREE.Mesh(geometry, material);
    characterSprite.position.copy(character.position);
    scene.add(characterSprite);
}

// --- Event Handlers ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    keyboard[event.code] = true;
}

function onKeyUp(event) {
    keyboard[event.code] = false;
}

// --- Update Logic ---
function updateCharacter(deltaTime) {
    if (!characterSprite || !texturesLoaded) return;

    // 1. Determine Movement Direction and Update State
    character.velocity.set(0, 0, 0);
    let isMoving = false;
    const moveDirection = new THREE.Vector3();

    if (keyboard['KeyW']) {
        moveDirection.z += 1;
        isMoving = true;
    }
    if (keyboard['KeyS']) {
        moveDirection.z -= 1;
        isMoving = true;
    }
    if (keyboard['KeyA']) {
        moveDirection.x += 1;
        isMoving = true;
    }
    if (keyboard['KeyD']) {
        moveDirection.x -= 1;
        isMoving = true;
    }

    if (isMoving) {
        character.state = 'walk';

        // Get camera direction projected onto XZ plane
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        // Calculate movement relative to camera
        const forward = cameraDirection.clone();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

        // Apply the calculated moveDirection (W/S is z, A/D is x)
        character.velocity.add(forward.multiplyScalar(moveDirection.z)); 
        character.velocity.add(right.multiplyScalar(moveDirection.x)); 
        character.velocity.normalize().multiplyScalar(MOVEMENT_SPEED);

        // Update character forward direction (for sprite angle calculation)
        character.forward.copy(character.velocity).normalize();

    } else {
        character.state = 'idle';
    }

     // Update position based on velocity
    character.position.add(character.velocity.clone().multiplyScalar(deltaTime));
    characterSprite.position.copy(character.position);


    // 2. Determine Correct Angle for Sprites
    const vecToCam = new THREE.Vector3().subVectors(camera.position, character.position);
    vecToCam.y = 0; // Project onto XZ plane
    vecToCam.normalize();

    const forwardXZ = character.forward.clone();
    forwardXZ.y = 0;
    forwardXZ.normalize();

    if (forwardXZ.lengthSq() > 0.001 && vecToCam.lengthSq() > 0.001) { // Avoid issues with zero vectors
        // Calculate the angle of the character's forward direction relative to the world +Z axis
        const charAngleRad = Math.atan2(forwardXZ.x, forwardXZ.z);
        
        // Calculate the angle of the vector from character to camera relative to the world +Z axis
        const camAngleRad = Math.atan2(vecToCam.x, vecToCam.z);

        // Calculate the relative angle: angle from camera direction to character forward direction
        let relativeAngleRad = charAngleRad - camAngleRad;

        // Normalize the angle to be within [-PI, PI]
        relativeAngleRad = (relativeAngleRad + Math.PI * 3) % (Math.PI * 2) - Math.PI;

        // Convert to degrees [0, 360). Sprite angle 0 is character front facing camera.
        let angleDeg = THREE.MathUtils.radToDeg(relativeAngleRad);
        angleDeg = (angleDeg + 360) % 360;

        // Quantize to nearest 45 degrees
        character.currentAngle = Math.round(angleDeg / 45) % 8 * 45; // Ensure it wraps around 360 -> 0

    } else if (character.state === 'idle') {
        // When idle and not moving, determine angle based on camera position only
        const camAngleRad = Math.atan2(vecToCam.x, vecToCam.z);
        // Convert to degrees [0, 360). Sprite angle 0 is character front facing camera (relative to -Z).
        // We need to adjust based on how sprites are oriented. Assuming angle 0 sprite is front view.
        let angleDeg = THREE.MathUtils.radToDeg(camAngleRad);
        angleDeg = (angleDeg + 180 + 360) % 360; // Add 180 because atan2(x,z) has 0 pointing +Z
        
        character.currentAngle = Math.round(angleDeg / 45) % 8 * 45;

    } // else keep previous angle if moving but vectors became zero momentarily


    // 3. Update Animation Frame
    character.frameTime += deltaTime;
    const currentFrameDuration = character.state === 'idle' ? IDLE_FRAME_DURATION : WALK_FRAME_DURATION;

    if (character.frameTime >= currentFrameDuration) {
        character.frameTime -= currentFrameDuration;
        character.currentFrame = (character.currentFrame + 1) % FRAME_COUNT;
    }

    // 4. Update Sprite Material
    const currentAnimationTextures = textures[character.state][character.currentAngle];
    if (currentAnimationTextures && currentAnimationTextures[character.currentFrame]) {
        characterSprite.material.map = currentAnimationTextures[character.currentFrame];
        characterSprite.material.needsUpdate = true;
    } else {
        // Fallback or error handling if textures are missing
        // console.warn(`Texture missing for state: ${character.state}, angle: ${character.currentAngle}, frame: ${character.currentFrame}`);
        // Use a default texture?
        if (textures.idle[0] && textures.idle[0][0]) {
             characterSprite.material.map = textures.idle[0][0]; // Default to idle frame 0 angle 0
             characterSprite.material.needsUpdate = true;
        }
    }

     // 5. Billboard the sprite (always face the camera)
    // We only want rotation around Y axis to face camera, not tilt up/down
    const lookAtTarget = new THREE.Vector3(camera.position.x, characterSprite.position.y, camera.position.z);
    characterSprite.lookAt(lookAtTarget);

}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    controls.update(); // Update orbit controls

    if (texturesLoaded) {
        updateCharacter(deltaTime);
    }

    renderer.render(scene, camera);
}

// --- Start ---
init(); 