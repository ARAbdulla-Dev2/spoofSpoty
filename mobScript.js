// ==UserScript==
// @name         Spotify Premium Mobile
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Mobile-optimized Spotify Premium emulator with desktop spoofing
// @author       You
// @match        https://open.spotify.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // First spoof desktop user agent while keeping mobile viewport
    const originalUserAgent = navigator.userAgent;
    const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    
    Object.defineProperty(navigator, 'userAgent', {
        value: desktopUserAgent,
        configurable: true,
        writable: false
    });

    // Set mobile-friendly viewport
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(meta);

    // Main emulator class
    class MobileSpotifyPremium {
        constructor() {
            this.blockedHosts = new Set();
            this.init();
        }

        async init() {
            console.log('[Mobile Premium] Initializing...');
            await this.loadAdBlockList();
            this.setupNetworkInterception();
            this.overridePlayerBehavior();
            this.activatePremiumFeatures();
            this.startMonitoring();
            console.log('[Mobile Premium] Ready!');
        }

        async loadAdBlockList() {
            try {
                const response = await fetch('https://raw.githubusercontent.com/Jigsaw88/Spotify-Ad-List/main/Spotify%20Adblock.txt');
                const text = await response.text();
                const hosts = text.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#') && !line.startsWith('!'));

                hosts.forEach(host => this.blockedHosts.add(host));
                console.log(`[Mobile Premium] Loaded ${hosts.length} ad servers`);
            } catch (error) {
                console.error('[Mobile Premium] Failed to load ad block list:', error);
                this.loadDefaultBlockList();
            }
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
                'www.googletagservices.com'
            ];
            defaultHosts.forEach(host => this.blockedHosts.add(host));
        }

        setupNetworkInterception() {
            // Mobile-optimized fetch interception
            const originalFetch = window.fetch;
            window.fetch = async (input, init) => {
                const url = typeof input === 'string' ? input : input.url;
                if (url && this.shouldBlock(url)) {
                    console.log('[Mobile Premium] Blocked fetch:', url);
                    return Promise.reject(new Error('Blocked by Spotify Premium'));
                }
                
                // Spoof desktop headers for API requests
                if (url && url.includes('spotify.com')) {
                    const options = init || {};
                    options.headers = options.headers || new Headers();
                    if (!options.headers.has('User-Agent')) {
                        options.headers.set('User-Agent', desktopUserAgent);
                    }
                    if (!options.headers.has('X-Client-Device')) {
                        options.headers.set('X-Client-Device', 'desktop');
                    }
                    return originalFetch(input, options);
                }
                
                return originalFetch(input, init);
            };

            // Mobile-optimized XHR interception
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
                if (url && this._emulator.shouldBlock(url)) {
                    console.log('[Mobile Premium] Blocked XHR:', url);
                    this._blocked = true;
                    return;
                }
                originalOpen.apply(this, arguments);
            };

            const originalSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function(data) {
                if (this._blocked) return;
                
                // Add desktop headers for Spotify API calls
                if (this.responseURL && this.responseURL.includes('spotify.com')) {
                    this.setRequestHeader('User-Agent', desktopUserAgent);
                    this.setRequestHeader('X-Client-Device', 'desktop');
                }
                
                this.addEventListener('load', () => {
                    if (this.responseURL && this._emulator.shouldBlock(this.responseURL)) {
                        console.log('[Mobile Premium] Blocked XHR response:', this.responseURL);
                        this._blocked = true;
                    }
                });
                
                originalSend.call(this, data);
            };
            XMLHttpRequest.prototype._emulator = this;
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
            // Mobile-optimized ad skipping
            this.skipAds = () => {
                const adIndicator = document.querySelector('[data-testid="track-info-advertiser"], .ad-indicator, [aria-label="Advertisement"]');
                if (adIndicator) {
                    console.log('[Mobile Premium] Detected ad, skipping...');
                    const skipButton = document.querySelector('[data-testid="skip-button"], .skip-button, [aria-label="Skip"]');
                    if (skipButton) {
                        skipButton.click();
                    } else {
                        // Mobile fallback - simulate swipe gesture
                        const progressBar = document.querySelector('[data-testid="progress-bar"]');
                        if (progressBar) {
                            const rect = progressBar.getBoundingClientRect();
                            const startX = rect.left + 10;
                            const startY = rect.top + rect.height / 2;
                            const endX = rect.right - 10;
                            
                            progressBar.dispatchEvent(new TouchEvent('touchstart', {
                                touches: [new Touch({identifier: 1, target: progressBar, clientX: startX, clientY: startY})]
                            }));
                            
                            setTimeout(() => {
                                progressBar.dispatchEvent(new TouchEvent('touchmove', {
                                    touches: [new Touch({identifier: 1, target: progressBar, clientX: endX, clientY: startY})]
                                }));
                                
                                setTimeout(() => {
                                    progressBar.dispatchEvent(new TouchEvent('touchend', {
                                        changedTouches: [new Touch({identifier: 1, target: progressBar, clientX: endX, clientY: startY})]
                                    }));
                                }, 50);
                            }, 50);
                        }
                    }
                }
            };

            // Force high quality on mobile
            this.forceHighQuality = () => {
                if (window._spotify && window._spotify.audio) {
                    window._spotify.audio.quality = 'veryhigh';
                }
                
                // Mobile-specific quality selector
                const mobileQualityButton = document.querySelector('[aria-label="Audio quality"], .quality-selector');
                if (mobileQualityButton) {
                    mobileQualityButton.click();
                    setTimeout(() => {
                        const veryHighOption = document.querySelector('[aria-label="Very High"], [value="veryhigh"]');
                        if (veryHighOption) veryHighOption.click();
                    }, 300);
                }
            };
        }

        activatePremiumFeatures() {
            // Mobile-specific UI modifications
            const removeMobileUpgradePrompts = () => {
                // Remove mobile app banners
                document.querySelectorAll('.mobile-app-banner, .upsell-banner, [data-testid="upgrade-link"]').forEach(el => {
                    el.style.display = 'none';
                });
                
                // Remove "Get Premium" buttons
                const premiumButtons = document.querySelectorAll('button:has(> div:contains("Premium")), [aria-label*="Premium"]');
                premiumButtons.forEach(btn => btn.style.display = 'none');
            };

            const enableMobilePremiumUI = () => {
                // Enable seek on mobile player
                const mobileProgress = document.querySelector('.progress-bar, [data-testid="progress-bar"]');
                if (mobileProgress) {
                    mobileProgress.style.touchAction = 'manipulation';
                    mobileProgress.style.pointerEvents = 'auto';
                }
                
                // Enable unlimited skips
                const skipButtons = document.querySelectorAll('.skip-button, [data-testid="control-button-skip-forward"]');
                skipButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                });
            };

            const setMobilePremiumFlags = () => {
                // Set mobile-specific premium flags
                localStorage.setItem('mobile-premium', 'true');
                sessionStorage.setItem('mobile-premium', 'true');
                
                // Force desktop premium flags
                localStorage.setItem('@auth', JSON.stringify({
                    ...JSON.parse(localStorage.getItem('@auth') || '{}'),
                    product: 'premium',
                    userType: 'premium',
                    device: 'desktop'
                }));
            };

            removeMobileUpgradePrompts();
            enableMobilePremiumUI();
            setMobilePremiumFlags();
            this.forceHighQuality();
        }

        startMonitoring() {
            // Mobile-optimized monitoring intervals
            this.skipAds();
            this.forceHighQuality();
            
            setInterval(() => this.skipAds(), 1000);
            setInterval(() => this.forceHighQuality(), 5000);
            
            // Mutation observer for mobile DOM changes
            const observer = new MutationObserver(() => {
                this.skipAds();
                this.activatePremiumFeatures();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // Initialize with mobile detection
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
        if (document.readyState === 'complete') {
            new MobileSpotifyPremium();
        } else {
            window.addEventListener('load', () => new MobileSpotifyPremium());
        }
    }
})();