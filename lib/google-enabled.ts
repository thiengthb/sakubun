// Whether Google sign-in is configured, resolved on the SERVER at request time. Mirrors auth.ts's
// googleConfigured. Deliberately NOT a NEXT_PUBLIC build-time flag: in the Docker build, `next build`
// runs before .env.docker is applied (env_file is runtime-only), so a NEXT_PUBLIC_* value would bake in
// as false and the client would hide the button even once Google is configured. Read it server-side and
// pass the boolean into the (client) auth forms instead. Server-only — never import into a client bundle.
export function isGoogleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
