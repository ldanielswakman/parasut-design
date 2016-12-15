'use strict';

const version = 'v0.018::';
const staticCacheName = version + 'static';

function updateStaticCache() {
    return caches.open(staticCacheName)
        .then( cache => {
            // These items won't block the installation of the Service Worker
            cache.addAll([
                '/calculator/manifest.json'
            ]);
            // These items must be cached for the Service Worker to complete installation
            return cache.addAll([
                '/',
                '/calculator/',
            ]);
        });
}

// Remove caches whose name is no longer valid
function clearOldCaches() {
    return caches.keys()
        .then( keys => {
            return Promise.all(keys
                .filter(key => key.indexOf(version) !== 0)
                .map(key => caches.delete(key))
            );
        });
}

self.addEventListener('install', event => {
    event.waitUntil(updateStaticCache()
        .then( () => self.skipWaiting() )
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(clearOldCaches()
        .then( () => self.clients.claim() )
    );
});

self.addEventListener('fetch', event => {
    let request = event.request;
    // Look in the cache first, fall back to the network
    event.respondWith(
        caches.match(request)
            .then(responseFromCache => {
                // CACHE//
                // Meanwhile fetch a fresh copy from the network.
                fetch(request)
                    .then( responseFromFetch => {
                        // Stash the fresh version of this page in the cache.
                        caches.open(staticCacheName)
                            .then( cache => {
                                cache.put(request, responseFromFetch);
                            });
                    });
                // Display the (possibly stale) version from the cache.
                return responseFromCache || fetch(request)
                    .then( responseFromFetch => {
                        // NETWORK
                        return responseFromFetch;
                    })
                    .catch( () => {
                        // OFFLINE
                        // If the request is for an image, show an offline placeholder
                        if (request.headers.get('Accept').indexOf('image') !== -1) {
                            return new Response('<svg role="img" aria-labelledby="offline-title" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><title id="offline-title">Offline</title><g fill="none" fill-rule="evenodd"><path fill="#D8D8D8" d="M0 0h400v300H0z"/><text fill="#9B9B9B" font-family="Helvetica Neue,Arial,Helvetica,sans-serif" font-size="72" font-weight="bold"><tspan x="93" y="172">offline</tspan></text></g></svg>', {headers: {'Content-Type': 'image/svg+xml'}});
                        }
                        // If the request is for a page, show an offline message
                        if (request.headers.get('Accept').indexOf('text/html') !== -1) {
                            return caches.match('/offline/');
                        }
                    });
            })
    );
});
