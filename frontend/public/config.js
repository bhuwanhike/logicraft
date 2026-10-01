/**
 * Per-deployment runtime configuration.
 *
 * This file is loaded by index.html before the app bundle and is copied
 * verbatim into dist/ by Vite, so it can be edited on the server after a build
 * without recompiling. Use it to point one build at a different API or Maps key
 * per environment.
 *
 * Values here are public: they are downloaded by every browser. Never put a
 * secret in this file.
 *
 * Precedence: a value set here wins over the VITE_* variable baked in at build
 * time, which in turn wins over the app's built-in default. Leave a key out (or
 * set it to an empty string) to fall back to the build-time value.
 */
window.__LOGICRAFT_CONFIG__ = {
  // Base path or URL of the API. Leave as the relative path when the dashboard
  // and API share an origin (the usual reverse-proxy setup, which needs no
  // CORS). Set an absolute URL to call the API on another origin, and add that
  // dashboard origin to CORS_ALLOWED_ORIGINS on the backend.
  //   apiBase: "https://api.logicraft.example/api/v1",
  apiBase: "https://logicraft-backend-a8v1.onrender.com/api/v1",

  // Google Maps JavaScript API browser key. Restrict it by HTTP referrer in the
  // Cloud console; a key in a shipped bundle is public by definition.
  //   googleMapsApiKey: "AIza...",
  googleMapsApiKey: "",

  // Optional cloud map ID for AdvancedMarkerElement / styled markers.
  //   googleMapsMapId: "abcdef1234567890",
  googleMapsMapId: ""
};
