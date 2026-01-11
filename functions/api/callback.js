const TOKEN_URL = "https://github.com/login/oauth/access_token";

const getEnv = (context, name) => {
  return context.env?.[name];
};

const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    cookies[name] = rest.join("=");
  }
  return cookies;
};

const successHtml = (token) => `<!doctype html>
<html lang="en">
  <body>
    <script>
      (function() {
        const payload = { token: ${JSON.stringify(token)}, provider: "github" };
        window.opener.postMessage(
          "authorization:github:success:" + JSON.stringify(payload),
          window.location.origin
        );
        window.close();
      })();
    </script>
  </body>
</html>`;

const errorHtml = (message) => `<!doctype html>
<html lang="en">
  <body>
    <script>
      (function() {
        window.opener.postMessage(
          "authorization:github:error:" + ${JSON.stringify(message)},
          window.location.origin
        );
        window.close();
      })();
    </script>
  </body>
</html>`;

export async function onRequest(context) {
  const clientId = getEnv(context, "GITHUB_CLIENT_ID");
  const clientSecret = getEnv(context, "GITHUB_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return new Response("Missing GitHub OAuth configuration", { status: 500 });
  }

  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookies = parseCookies(context.request.headers.get("Cookie"));
  if (!state || state !== cookies.decap_oauth_state) {
    return new Response(errorHtml("Invalid OAuth state"), {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  if (!code) {
    return new Response(errorHtml("Missing code"), {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    const message = tokenData.error_description || "Failed to fetch access token";
    return new Response(errorHtml(message), {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  return new Response(successHtml(tokenData.access_token), {
    headers: { "Content-Type": "text/html" },
  });
}
