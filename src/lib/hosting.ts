// Where the app is running. Vercel and Render set these variables on their own servers only, so
// anything else (a laptop, CI, a script) counts as local. Kept free of "server-only" because the
// database pool config, which scripts also load, depends on it.

export const onVercel = () => Boolean(process.env.VERCEL);
export const onRender = () => process.env.RENDER === "true";

/** Running on a hosting provider rather than a developer's machine. */
export const onHostedServer = () => onVercel() || onRender();

/** The live site: Vercel's production deployment, or the Render service (it has no previews). */
export const isLiveHost = () => process.env.VERCEL_ENV === "production" || onRender();
