/* OpenHeart clinic lookup — Cloudflare Worker.
   GET /?zip=22903 → { zip, clinics: [{name, address, city, state, zip, phone, miles, url}] }

   Proxies HRSA's GetHealthCentersAroundALocation so the registration token
   stays server-side. ZIP is geocoded from a bundled Census ZCTA table, the
   search starts at 15 miles and auto-expands to 100 until it finds 3 centers
   (HRSA does the expansion). Responses are cached at the edge for 7 days.
   No request data is logged or stored. */

import ZIPS from './zips.js';

var HRSA_URL = 'https://data.hrsa.gov/HDWAPI3_External/api/v1/GetHealthCentersAroundALocation';

var HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=600, s-maxage=604800'
};

function reply(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({}, HEADERS, extra || {})
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: HEADERS });

    var zip = (new URL(request.url).searchParams.get('zip') || '').trim();
    if (!/^\d{5}$/.test(zip)) return reply({ error: 'Enter a 5-digit ZIP code.' }, 400);

    var cache = typeof caches !== 'undefined' ? caches.default : null;
    var cacheKey = new Request('https://openheart-clinics.cache/v4-' + zip);
    if (cache) {
      var hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    var ll = ZIPS[zip];
    if (!ll) return reply({ zip: zip, clinics: [] });

    var upstream = await fetch(HRSA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Latitude: ll[0],
        Longitude: ll[1],
        Radius: 15,
        MinRecs: 3,
        MaxRadius: 100,
        RadiusIncrement: 15,
        Token: env.HRSA_TOKEN
      })
    });
    if (!upstream.ok) return reply({ zip: zip, clinics: [], error: 'lookup_failed' }, 502, { 'Cache-Control': 'no-store' });

    var data = await upstream.json();
    var seenPhones = {};
    var clinics = (data.HCC || [])
      .filter(function (s) { return (s.HCC_TYP_DESC || '').indexOf('Service Delivery') !== -1; })
      .sort(function (a, b) { return (a.Distance || 0) - (b.Distance || 0); })
      .map(function (s) {
        return {
          name: s.SITE_NM || '',
          address: s.SITE_ADDRESS || '',
          city: s.SITE_CITY || '',
          state: s.SITE_STATE_ABBR || '',
          zip: String(s.SITE_ZIP_CD || '').slice(0, 5),
          phone: s.SITE_PHONE_NUM || '',
          miles: Math.round((s.Distance || 0) * 10) / 10,
          url: s.SITE_URL || ''
        };
      })
      .filter(function (c) {
        var raw = String(c.phone || '').replace(/[xX,;].*$/, '').replace(/\D/g, '');
        var key = raw.length === 11 && raw[0] === '1' ? raw.slice(1) : raw;
        if (key.length !== 10) return true;
        if (seenPhones[key]) return false;
        seenPhones[key] = true;
        return true;
      })
      .slice(0, 5);

    var res = reply({ zip: zip, clinics: clinics });
    if (cache && ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  }
};
