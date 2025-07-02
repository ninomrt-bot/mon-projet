self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.protocol === 'http:' && url.hostname === location.hostname) {
    url.protocol = 'https:';
    event.respondWith(fetch(url.toString(), { mode: 'same-origin' }));
  }
});
