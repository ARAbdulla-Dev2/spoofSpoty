// First load the fetch polyfill if needed
if (typeof GM_xmlhttpRequest === 'undefined') {
    GM_xmlhttpRequest = function(options) {
        return fetch(options.url, {
            method: options.method || 'GET',
            headers: options.headers,
            body: options.data
        }).then(response => {
            if (response.ok) {
                return response.text().then(text => {
                    options.onload && options.onload({
                        status: response.status,
                        responseText: text
                    });
                });
            } else {
                options.onerror && options.onerror(new Error(response.statusText));
            }
        }).catch(error => {
            options.onerror && options.onerror(error);
        });
    };
}

// Then paste the rest of the script above

(function() {
    'use strict';

    // Main ad blocker class
    class SpotifyPremiumEmulator {
        constructor() {
            this.blockedHosts = new Set();
            this.isPremium = false;
            this.init();
        }

        async init() {
            console.log('[Spotify Premium] Initializing...');
            await this.loadAdBlockList();
            this.setupNetworkInterception();
            this.overridePlayerBehavior();
            this.activatePremiumFeatures();
            this.startMonitoring();
            console.log('[Spotify Premium] Ready!');
        }

        async loadAdBlockList() {
            try {
                const response = await this.fetchAdBlockList();
                const hosts = response.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#') && !line.startsWith('!'));

                hosts.forEach(host => this.blockedHosts.add(host));
                console.log(`[Spotify Premium] Loaded ${hosts.length} ad servers to block`);
            } catch (error) {
                console.error('[Spotify Premium] Failed to load ad block list:', error);
                // Fallback to hardcoded list
                this.loadDefaultBlockList();
            }
        }

        fetchAdBlockList() {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://raw.githubusercontent.com/Jigsaw88/Spotify-Ad-List/main/Spotify%20Adblock.txt',
                    onload: (response) => {
                        if (response.status === 200) {
                            resolve(response.responseText);
                        } else {
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: reject
                });
            });
        }

        loadDefaultBlockList() {
            const defaultHosts = [
                'adclick.g.doubleclick.net',
                'ads-fa.spotify.com',
                'analytics.spotify.com',
                'log.spotify.com',
                'spclient.wg.spotify.com',
                'audio-fa.scdn.co',
                'audio-sp-ads.spotify.com',
                'pagead2.googlesyndication.com',
                'partner.googleadservices.com',
                'pubads.g.doubleclick.net',
                'securepubads.g.doubleclick.net',
                'www.googletagservices.com',
                'a50.g2.akamai.net',
                'a297.c.akamai.net',
                'a301.w62d.akamai.net',
                'a1294.w20.akamai.net',
                'a1843.g.akamai.net',
                'a.adk2x.com',
                'a.admob.com',
                'ab.tune.com'
            ];
            defaultHosts.forEach(host => this.blockedHosts.add(host));
        }

        setupNetworkInterception() {
            // Intercept fetch requests
            const originalFetch = window.fetch;
            window.fetch = async (input, init) => {
                const url = typeof input === 'string' ? input : input.url;
                if (url && this.shouldBlock(url)) {
                    console.log('[Spotify Premium] Blocked fetch:', url);
                    return Promise.reject(new Error('Blocked by Spotify Premium Emulator'));
                }
                return originalFetch(input, init);
            };

            // Intercept XHR requests
            const originalXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
                if (url && this._emulator.shouldBlock(url)) {
                    console.log('[Spotify Premium] Blocked XHR:', url);
                    this._blocked = true;
                    return;
                }
                originalXHROpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function(data) {
                if (this._blocked) return;
                this.addEventListener('load', () => {
                    if (this.responseURL && this._emulator.shouldBlock(this.responseURL)) {
                        console.log('[Spotify Premium] Blocked XHR response:', this.responseURL);
                        this._blocked = true;
                    }
                });
                return XMLHttpRequest.prototype.send.apply(this, arguments);
            };
            XMLHttpRequest.prototype._emulator = this;

            // Intercept WebSocket connections
            const originalWebSocket = window.WebSocket;
            window.WebSocket = function(url, protocols) {
                if (url && this._emulator.shouldBlock(url)) {
                    console.log('[Spotify Premium] Blocked WebSocket:', url);
                    return {
                        send: () => {},
                        close: () => {},
                        addEventListener: () => {}
                    };
                }
                const ws = new originalWebSocket(url, protocols);
                ws._emulator = this._emulator;
                return ws;
            };
            window.WebSocket.prototype._emulator = this;
        }

        shouldBlock(url) {
            try {
                const hostname = new URL(url).hostname;
                return this.blockedHosts.has(hostname) || 
                       [...this.blockedHosts].some(blocked => hostname.endsWith(blocked));
            } catch {
                return false;
            }
        }

        overridePlayerBehavior() {
            // Skip ads automatically
            this.skipAds = () => {
                const adIndicator = document.querySelector('[data-testid="track-info-advertiser"], .ad-indicator');
                if (adIndicator) {
                    console.log('[Spotify Premium] Detected ad, skipping...');
                    const skipButton = document.querySelector('[data-testid="skip-button"], .skip-button');
                    if (skipButton) {
                        skipButton.click();
                    } else {
                        const nextButton = document.querySelector('[data-testid="control-button-skip-forward"], .next-button');
                        if (nextButton) nextButton.click();
                    }
                }
            };

            // Force high quality audio
            this.forceHighQuality = () => {
                if (window._spotify && window._spotify.audio) {
                    window._spotify.audio.quality = 'veryhigh';
                }
                const qualitySelectors = document.querySelectorAll('[data-testid="audio-quality-selector"], .quality-selector');
                qualitySelectors.forEach(selector => {
                    if (selector.value !== 'veryhigh') {
                        selector.value = 'veryhigh';
                        selector.dispatchEvent(new Event('change'));
                    }
                });
            };
        }

        activatePremiumFeatures() {
            // Remove upgrade prompts
            const removeUpgradePrompts = () => {
                document.querySelectorAll('[data-testid="upgrade-link"], .upgrade-button, .premium-upsell').forEach(el => {
                    el.style.display = 'none';
                });
            };

            // Enable premium UI elements
            const enablePremiumUI = () => {
                // Enable seek bar
                const progressBars = document.querySelectorAll('[data-testid="progress-bar"], .progress-bar');
                progressBars.forEach(bar => {
                    bar.style.pointerEvents = 'auto';
                    const inner = bar.querySelector('div');
                    if (inner) inner.style.pointerEvents = 'auto';
                });

                // Enable skip buttons
                const skipButtons = document.querySelectorAll('[data-testid="control-button-skip-forward"], .skip-button');
                skipButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                });

                // Enable shuffle
                const shuffleButtons = document.querySelectorAll('[data-testid="control-button-shuffle"], .shuffle-button');
                shuffleButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                });
            };

            // Set premium flags
            const setPremiumFlags = () => {
                const authData = {
                    product: 'premium',
                    userType: 'premium',
                    accessToken: 'emulated-premium-token',
                    expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year from now
                };

                // localStorage
                localStorage.setItem('@auth', JSON.stringify({
                    ...JSON.parse(localStorage.getItem('@auth') || '{}'),
                    ...authData
                }));

                // sessionStorage
                sessionStorage.setItem('@auth', JSON.stringify({
                    ...JSON.parse(sessionStorage.getItem('@auth') || '{}'),
                    ...authData
                }));

                // Modify React state if available
                if (window._spotify && window._spotify.react) {
                    const reactInternals = window._spotify.react;
                    for (const key in reactInternals) {
                        if (reactInternals[key] && reactInternals[key].memoizedProps) {
                            const props = reactInternals[key].memoizedProps;
                            if (props.currentProductState) {
                                props.currentProductState.productState = 'premium';
                            }
                            if (props.user) {
                                props.user.product = 'premium';
                            }
                        }
                    }
                }
            };

            removeUpgradePrompts();
            enablePremiumUI();
            setPremiumFlags();
            this.forceHighQuality();
        }

        startMonitoring() {
            // Run initial checks
            this.skipAds();
            this.forceHighQuality();

            // Set up intervals
            setInterval(() => this.skipAds(), 1000);
            setInterval(() => this.forceHighQuality(), 5000);

            // Watch for DOM changes
            const observer = new MutationObserver(() => {
                this.skipAds();
                this.activatePremiumFeatures();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // Initialize when page is ready
    if (document.readyState === 'complete') {
        new SpotifyPremiumEmulator();
    } else {
        window.addEventListener('load', () => new SpotifyPremiumEmulator());
    }
})();