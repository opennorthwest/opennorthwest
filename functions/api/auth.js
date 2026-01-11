const AUTH_URL = "https://github.com/login/oauth/authorize";

const getEnv = (context, name) => {
  return context.env?.[name];
};

const buildCookie = (name, value) => {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
};

export async function onRequest(context) {
  const clientId = getEnv(context, "GITHUB_CLIENT_ID");
  if (!clientId) {
    return new Response("Missing GITHUB_CLIENT_ID", { status: 500 });
  }

  const url = new URL(context.request.url);
  const redirectUri = new URL("/api/callback", url.origin).toString();

  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, "0")).join("");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo",
    state,
  });

  const authUrl = `${AUTH_URL}?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      "Set-Cookie": buildCookie("decap_oauth_state", state),
    },
  });
}
