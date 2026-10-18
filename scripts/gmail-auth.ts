// One-time Gmail sign-in for the demo inbox (read order emails + send demo receipts).
// Prints a refresh token for .env.local.
//   npm run gmail:auth
// Needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET from a Google Cloud OAuth client (type "Web
// application") whose authorized redirect URI is exactly http://localhost:3000/api/gmail/callback,
// with the Gmail API enabled and your account added as a test user. Stop `npm run dev` first:
// this script borrows port 3000 for the one redirect.
import { createServer } from "node:http";

const PORT = 3000;
const REDIRECT = `http://localhost:${PORT}/api/gmail/callback`;
// readonly: order emails for the wardrobe; send: the demo receipt after a purchase.
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("✗ set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline", // ask for a refresh token
  prompt: "consent", // ...even if this account approved the app before
}).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/api/gmail/callback") {
    res.statusCode = 404;
    res.end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.end(url.searchParams.get("error") ?? "waiting for Google...");
    return;
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
  });
  const body = (await tokenRes.json()) as { refresh_token?: string; error?: string; error_description?: string };
  if (!body.refresh_token) {
    res.end("Sign-in failed, see the terminal.");
    console.error(`✗ ${body.error ?? tokenRes.status}: ${body.error_description ?? "no refresh_token returned"}`);
  } else {
    res.end("Dripy can read your Gmail now. You can close this tab.");
    console.log(`\n✓ Add this line to .env.local, then restart npm run dev:\n\nGMAIL_REFRESH_TOKEN=${body.refresh_token}\n`);
  }
  server.close();
});

server.on("error", (err) => {
  console.error(`✗ ${err.message} (is npm run dev still running? stop it first)`);
  process.exit(1);
});

server.listen(PORT, "localhost", () => {
  console.log(`Open this URL, sign in with the Gmail account that has the order emails:\n\n${authUrl}\n`);
});
