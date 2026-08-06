// Where the app talks to. The deployed domain is the default because there is exactly one server and
// one user; `EXPO_PUBLIC_API_URL` overrides it for a laptop-hosted dev server (an EXPO_PUBLIC_ variable
// is inlined at build time by Expo, so it must never hold anything secret — a base URL is not).
//
// NOTE for local development: point this at your machine's LAN address, not `localhost` — on a device
// or emulator `localhost` is the phone, not the laptop. The server must also trust that origin
// (BETTER_AUTH_TRUSTED_ORIGINS).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://sakubun.thientnse.site';

/** Must equal `expo.scheme` in app.json AND an entry in `trustedOrigins` (lib/auth.ts). The Expo auth
 *  client derives its `expo-origin` header from this, and better-auth checks it on every request. */
export const APP_SCHEME = 'sakubun';
