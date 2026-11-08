import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-webhook-secret",
};

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claim;
  const pem = serviceAccount.private_key.replace(/\\n/g, "\n");
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned),
  ));
  const assertion = unsigned + "." + b64url(signature);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Google OAuth token failed");
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!expectedSecret || req.headers.get("x-push-webhook-secret") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const message = payload?.record;
    if (!message?.id || !message?.match_id || !message?.sender_id) {
      return new Response(JSON.stringify({ skipped: "Not a valid message insert event" }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID")!;
    const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
    if (serviceAccount.project_id !== projectId) throw new Error("Firebase project ID does not match service account");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: match, error: matchError } = await admin
      .from("matches").select("user_a,user_b").eq("id", message.match_id).maybeSingle();
    if (matchError) throw matchError;
    if (!match) return new Response(JSON.stringify({ skipped: "Match not found" }), { headers: corsHeaders });

    const recipientId = match.user_a === message.sender_id
      ? match.user_b
      : match.user_b === message.sender_id ? match.user_a : null;
    if (!recipientId || recipientId === message.sender_id) {
      return new Response(JSON.stringify({ skipped: "No valid recipient" }), { headers: corsHeaders });
    }

    const { data: tokens, error: tokenError } = await admin
      .from("push_tokens").select("token,platform").eq("user_id", recipientId);
    if (tokenError) throw tokenError;
    if (!tokens?.length) return new Response(JSON.stringify({ sent: 0, reason: "Recipient has no registered push token" }), { headers: corsHeaders });

    const accessToken = await getGoogleAccessToken(serviceAccount);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    let sent = 0;
    const stale: string[] = [];
    for (const row of tokens) {
      const fcmMessage: Record<string, unknown> = {
        token: row.token,
        notification: { title: "Saath", body: "Someone messaged you." },
        data: { type: "chat_message", message_id: String(message.id) },
        android: { priority: "high", notification: { channel_id: "saath_messages", sound: "default" } },
      };
      if (row.platform === "web") {
        fcmMessage.webpush = {
          notification: { title: "Saath", body: "Someone messaged you.", icon: "/Sath/favicon.svg", tag: "saath-message-" + message.id },
          fcm_options: { link: "https://pranab14220.github.io/Sath/" },
        };
      }
      const result = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ message: fcmMessage }),
      });
      if (result.ok) sent++;
      else {
        const detail = await result.text();
        if (detail.includes("UNREGISTERED") || detail.includes("registration-token-not-registered")) stale.push(row.token);
        console.error("FCM send failed", row.platform, result.status, detail);
      }
    }
    if (stale.length) await admin.from("push_tokens").delete().in("token", stale);
    return new Response(JSON.stringify({ sent, staleRemoved: stale.length }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    console.error("push-message error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
