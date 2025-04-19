class AudioManager {
    constructor() {
        this.sounds = {
            background: new Audio('/sounds/background.mp3'),
            walkGrass: [
                new Audio('/sounds/walkgrass1.mp3'),
                new Audio('/sounds/walkgrass2.mp3'),
                new Audio('/sounds/walkgrass3.mp3')
            ],
            walkStone: [
                new Audio('/sounds/walkstone1.mp3'),
                new Audio('/sounds/walkstone2.mp3'),
                new Audio('/sounds/walkstone3.mp3'),
                new Audio('/sounds/walkstone4.mp3'),
                new Audio('/sounds/walkstone5.mp3')
            ],
            car: new Audio('/sounds/car1.mp3'),
            carMusic: new Audio('/sounds/carmusic.mp3'),
            punch: new Audio('/sounds/punch.mp3'),
            shot: new Audio('/sounds/shot.mp3'),
            carHit: new Audio('/sounds/carhit.mp3')
        };

        // Configure background sound
        this.sounds.background.loop = true;
        this.sounds.background.volume = 0.3;

        // Configure car music
        this.sounds.carMusic.loop = true;
        this.sounds.carMusic.volume = 0.5;

        // Configure car engine sound
        this.sounds.car.loop = true;
        this.sounds.car.volume = 0.4;

        // Initialize last step time for walking sounds
        this.lastStepTime = 0;
        this.normalStepDelay = 500; // Increased from 400ms to 500ms
        this.runningStepDelay = 300; // Increased from 250ms to 300ms
    }

    startBackgroundSound() {
        this.sounds.background.currentTime = 0;
        this.sounds.background.play().catch(error => {
            console.warn("Background sound autoplay failed:", error);
        });
    }

    playRandomWalkSound(isOnGrass, isRunning) {
        const now = Date.now();
        const stepDelay = isRunning ? this.runningStepDelay : this.normalStepDelay;
        if (now - this.lastStepTime < stepDelay) return;
        this.lastStepTime = now;

        let soundFiles;
        let volume;  // Add volume control
        if (isOnGrass) {
            soundFiles = this.sounds.walkGrass;
            volume = 1.0;  // Keep grass sounds at full volume
        } else {
            soundFiles = this.sounds.walkStone;
            volume = 0.2;  // Reduce stone step volume to 40%
        }

        const randomIndex = Math.floor(Math.random() * soundFiles.length);
        const sound = new Audio(soundFiles[randomIndex].src);
        sound.volume = volume;  // Apply the volume
        sound.play().catch(err => {
            console.warn('Failed to play step sound:', err);
        });
    }

    startCarEngine(isPlayerCar = true, speed = 1) {
        const engineSound = new Audio(this.sounds.car.src);
        engineSound.loop = true;
        engineSound.volume = isPlayerCar ? 0.4 : 0.2;
        engineSound.playbackRate = 0.5 + (speed * 0.5); // Adjust pitch based on speed
        engineSound.play();
        return engineSound; // Return the instance so it can be stopped later
    }

    updateCarPitch(engineSound, speed) {
        if (engineSound) {
            engineSound.playbackRate = 0.5 + (speed * 0.5);
        }
    }

    startCarMusic() {
        this.sounds.carMusic.currentTime = Math.random() * this.sounds.carMusic.duration;
        this.sounds.carMusic.play();
    }

    stopCarMusic() {
        this.sounds.carMusic.pause();
        this.sounds.carMusic.currentTime = 0;
    }

    playPunchSound() {
        const punchSound = new Audio(this.sounds.punch.src);
        punchSound.volume = 0.5;
        punchSound.play();
    }

    playShootSound() {
        const shootSound = new Audio(this.sounds.shot.src);
        shootSound.volume = 0.4;
        shootSound.play();
    }

    playCarHitSound() {
        const hitSound = new Audio(this.sounds.carHit.src);
        hitSound.volume = 0.5;
        hitSound.play();
    }
}

export const audioManager = new AudioManager(); 