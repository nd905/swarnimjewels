/**
 * Swarnim Video Player - For Cloudflare R2 Videos
 * Simple, beautiful, responsive video player
 * Version: 1.0.0
 */

class SwarnimVideoPlayer {
    constructor(containerId, videoUrl, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        this.videoUrl = videoUrl;
        this.options = {
            autoplay: options.autoplay || false,
            controls: options.controls !== false,
            muted: options.muted || false,
            loop: options.loop || false,
            width: options.width || '100%',
            height: options.height || 'auto',
            poster: options.poster || null,
            playbackRates: options.playbackRates || [0.5, 0.75, 1, 1.25, 1.5, 2],
            theme: options.theme || 'dark' // 'dark' or 'light'
        };

        this.init();
    }

    init() {
        // Create video element
        this.createPlayer();
        this.attachStyles();
        this.attachEvents();
    }

    createPlayer() {
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = `swarnim-player swarnim-player-${this.options.theme}`;
        wrapper.style.width = this.options.width;
        wrapper.style.maxWidth = '100%';
        wrapper.style.position = 'relative';

        // Create video element
        const video = document.createElement('video');
        video.className = 'swarnim-video';
        video.style.width = '100%';
        video.style.height = this.options.height;
        video.style.borderRadius = '10px';
        video.style.background = '#000';
        
        if (this.options.controls) video.controls = true;
        if (this.options.autoplay) video.autoplay = true;
        if (this.options.muted) video.muted = true;
        if (this.options.loop) video.loop = true;
        if (this.options.poster) video.poster = this.options.poster;

        // Add source
        const source = document.createElement('source');
        source.src = this.videoUrl;
        source.type = this.getVideoType(this.videoUrl);
        video.appendChild(source);

        // Fallback message
        const fallback = document.createElement('p');
        fallback.textContent = 'Your browser doesn\'t support HTML5 video.';
        fallback.style.color = 'white';
        fallback.style.padding = '20px';
        video.appendChild(fallback);

        wrapper.appendChild(video);
        this.container.appendChild(wrapper);

        this.video = video;
        this.wrapper = wrapper;
    }

    attachStyles() {
        // Add global styles if not already added
        if (!document.getElementById('swarnim-player-styles')) {
            const style = document.createElement('style');
            style.id = 'swarnim-player-styles';
            style.textContent = `
                .swarnim-player {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                }
                .swarnim-player-dark video {
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                }
                .swarnim-player-light video {
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                    border: 1px solid #ddd;
                }
                .swarnim-player video::-webkit-media-controls-panel {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .swarnim-loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: white;
                    font-size: 1.2rem;
                }
                .swarnim-error {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #ff5252;
                    text-align: center;
                    padding: 20px;
                }
            `;
            document.head.appendChild(style);
        }
    }

    attachEvents() {
        // Loading indicator
        this.video.addEventListener('loadstart', () => {
            this.showLoading();
        });

        this.video.addEventListener('canplay', () => {
            this.hideLoading();
        });

        // Error handling
        this.video.addEventListener('error', (e) => {
            this.showError('Failed to load video. Please check the URL.');
            console.error('Video error:', e);
        });

        // Analytics (optional)
        this.video.addEventListener('play', () => {
            console.log('Video started playing');
        });

        this.video.addEventListener('ended', () => {
            console.log('Video ended');
        });
    }

    showLoading() {
        if (!this.loadingDiv) {
            this.loadingDiv = document.createElement('div');
            this.loadingDiv.className = 'swarnim-loading';
            this.loadingDiv.textContent = 'Loading video...';
            this.wrapper.appendChild(this.loadingDiv);
        }
    }

    hideLoading() {
        if (this.loadingDiv) {
            this.loadingDiv.remove();
            this.loadingDiv = null;
        }
    }

    showError(message) {
        this.hideLoading();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'swarnim-error';
        errorDiv.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 10px;">⚠️</div>
            <strong>Error Loading Video</strong><br>
            ${message}
        `;
        this.wrapper.appendChild(errorDiv);
    }

    getVideoType(url) {
        const ext = url.split('.').pop().toLowerCase().split('?')[0];
        const types = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'm4v': 'video/x-m4v'
        };
        return types[ext] || 'video/mp4';
    }

    // Public methods
    play() {
        return this.video.play();
    }

    pause() {
        this.video.pause();
    }

    stop() {
        this.video.pause();
        this.video.currentTime = 0;
    }

    setVolume(volume) {
        this.video.volume = Math.max(0, Math.min(1, volume));
    }

    getCurrentTime() {
        return this.video.currentTime;
    }

    getDuration() {
        return this.video.duration;
    }

    destroy() {
        this.wrapper.remove();
    }
}

// Alternative: Simple function to create player
function createSwarnimPlayer(containerId, videoUrl, options = {}) {
    return new SwarnimVideoPlayer(containerId, videoUrl, options);
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SwarnimVideoPlayer, createSwarnimPlayer };
}

/**
 * USAGE EXAMPLES:
 * 
 * 1. Basic player:
 * ----------------
 * <div id="my-video"></div>
 * <script src="swarnim-video-player.js"></script>
 * <script>
 *   new SwarnimVideoPlayer('my-video', 'https://your-r2-domain.com/video.mp4');
 * </script>
 * 
 * 2. With options:
 * ---------------
 * new SwarnimVideoPlayer('my-video', 'video-url.mp4', {
 *   autoplay: true,
 *   muted: true,
 *   loop: true,
 *   width: '800px',
 *   height: '450px',
 *   poster: 'thumbnail.jpg',
 *   theme: 'light'
 * });
 * 
 * 3. Using helper function:
 * -------------------------
 * const player = createSwarnimPlayer('my-video', 'video.mp4');
 * 
 * // Control programmatically
 * player.play();
 * player.pause();
 * player.setVolume(0.5);
 * 
 * 4. Multiple videos:
 * ------------------
 * const player1 = new SwarnimVideoPlayer('video1', 'video1.mp4');
 * const player2 = new SwarnimVideoPlayer('video2', 'video2.mp4');
 */
