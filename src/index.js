var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Credentials": "true"
        }
      });
    }
    const routes = [
      ["POST", "/api/register", handleRegister],
      ["POST", "/api/login", handleLogin],
      ["POST", "/api/logout", handleLogout],
      ["GET", "/api/data", handleDataGet],
      ["POST", "/api/data", handleDataPost],
      ["GET", "/api/leaderboard", handleLeaderboardGet],
      ["POST", "/api/leaderboard", handleLeaderboardPost],
      ["POST", "/api/chat", handleChat]
    ];
    for (const [m, p, h] of routes) {
      if (url.pathname === p && request.method === m) {
        return h(request, env);
      }
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
};
var SALT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomSalt() {
  let s = "";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  for (const b of arr) s += SALT_CHARS[b % SALT_CHARS.length];
  return s;
}
__name(randomSalt, "randomSalt");
function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/=/g, "").replace(/\+/g, "x").replace(/\//g, "z");
}
__name(generateToken, "generateToken");
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
    key,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
__name(hashPassword, "hashPassword");
async function getSessionUser(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const session = await env.LEADERBOARD.get("sess:" + match[1]);
  if (!session) return null;
  return session;
}
__name(getSessionUser, "getSessionUser");
function corsHeaders() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", "Cache-Control": "no-store" };
}
__name(corsHeaders, "corsHeaders");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}
__name(json, "json");
async function handleRegister(request, env) {
  try {
    const { username, password } = await request.json();
    if (!username || !password || username.length < 2 || password.length < 4) {
      return json({ error: "Kullanıcı adı en az 2, şifre en az 4 karakter olmalı" }, 400);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return json({ error: "Kullanıcı adında yalnızca harf, rakam, -, _ kullanılabilir" }, 400);
    const existing = await env.LEADERBOARD.get("user:" + username);
    if (existing) return json({ error: "Bu kullanıcı adı zaten alınmış" }, 409);
    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    await env.LEADERBOARD.put("user:" + username, JSON.stringify({ hash, salt, createdAt: Date.now() }));
    const token = generateToken();
    await env.LEADERBOARD.put("sess:" + token, username, { expirationTtl: 604800 });
    await addLeaderboardEntry(env, username);
    return json({ ok: true, token, username }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleRegister, "handleRegister");
async function handleLogin(request, env) {
  try {
    const { username, password } = await request.json();
    const raw = await env.LEADERBOARD.get("user:" + username);
    if (!raw) return json({ error: "Kullanıcı bulunamadı" }, 401);
    const user = JSON.parse(raw);
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.hash) return json({ error: "Şifre yanlış" }, 401);
    const token = generateToken();
    await env.LEADERBOARD.put("sess:" + token, username, { expirationTtl: 604800 });
    return json({ ok: true, token, username }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleLogin, "handleLogin");
async function handleLogout(request, env) {
  try {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/session=([^;]+)/);
    if (match) await env.LEADERBOARD.delete("sess:" + match[1]);
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleLogout, "handleLogout");
async function handleDataGet(request, env) {
  const username = await getSessionUser(request, env);
  if (!username) return json({ error: "Giriş yapmalısın" }, 401);
  try {
    const raw = await env.LEADERBOARD.get("data:" + username);
    return json(raw ? JSON.parse(raw) : {}, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleDataGet, "handleDataGet");
async function handleDataPost(request, env) {
  const username = await getSessionUser(request, env);
  if (!username) return json({ error: "Giriş yapmalısın" }, 401);
  try {
    const incoming = await request.json();
    await env.LEADERBOARD.put("data:" + username, JSON.stringify(incoming));
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleDataPost, "handleDataPost");
function getMondayTs() {
  const now = /* @__PURE__ */ new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const m = new Date(now);
  m.setDate(now.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m.getTime();
}
__name(getMondayTs, "getMondayTs");
async function addLeaderboardEntry(env, username) {
  let entries = await env.LEADERBOARD.get("entries", "json") || [];
  if (!Array.isArray(entries)) entries = [];
  if (!entries.find((e) => e.name === username)) {
    entries.push({ name: username, level: 1, xp: 0, totalStudy: 0, weeklyStudy: 0, updated: Date.now() });
    await env.LEADERBOARD.put("entries", JSON.stringify(entries));
  }
}
__name(addLeaderboardEntry, "addLeaderboardEntry");
async function handleLeaderboardGet(request, env) {
  try {
    const currentMonday = getMondayTs();
    const lastReset = parseInt(await env.LEADERBOARD.get("lastResetWeek")) || 0;
    let entries = await env.LEADERBOARD.get("entries", "json");
    if (!Array.isArray(entries)) entries = [];
    if (currentMonday > lastReset) {
      entries.forEach((e) => {
        e.weeklyStudy = 0;
      });
      await env.LEADERBOARD.put("entries", JSON.stringify(entries));
      await env.LEADERBOARD.put("lastResetWeek", String(currentMonday));
    }
    const userList = await env.LEADERBOARD.list({ prefix: "user:" });
    let changed = false;
    for (const key of userList.keys) {
      const name = key.name.slice(5);
      if (!entries.find((e) => e.name === name)) {
        entries.push({ name, level: 1, xp: 0, totalStudy: 0, weeklyStudy: 0, updated: Date.now() });
        changed = true;
      }
    }
    if (changed) await env.LEADERBOARD.put("entries", JSON.stringify(entries));
    entries.sort((a, b) => (b.weeklyStudy || 0) - (a.weeklyStudy || 0));
    return new Response(JSON.stringify(entries), {
      headers: corsHeaders()
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleLeaderboardGet, "handleLeaderboardGet");
async function handleLeaderboardPost(request, env) {
  try {
    const body = await request.json();
    const { name, level, xp, totalStudy, weeklyStudy } = body;
    if (!name || typeof level !== "number" || typeof xp !== "number") {
      return json({ error: "Geçersiz veri" }, 400);
    }
    let entries = await env.LEADERBOARD.get("entries", "json") || [];
    if (!Array.isArray(entries)) entries = [];
    const existing = entries.findIndex((e) => e.name === name);
    const entry = { name, level, xp, totalStudy: totalStudy || 0, weeklyStudy: weeklyStudy || 0, updated: Date.now() };
    if (existing >= 0) {
      entries[existing] = entry;
    } else {
      entries.push(entry);
    }
    await env.LEADERBOARD.put("entries", JSON.stringify(entries));
    entries.sort((a, b) => (b.weeklyStudy || 0) - (a.weeklyStudy || 0));
    return new Response(JSON.stringify({ ok: true, top: entries.slice(0, 10) }), {
      headers: corsHeaders()
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleLeaderboardPost, "handleLeaderboardPost");
async function handleChat(request, env) {
  try {
    const formData = await request.formData();
    const message = formData.get("message") || "";
    const file = formData.get("file");
    if (!message && !file) return json({ error: "Mesaj boş olamaz." }, 400);
    const systemMsg = { role: "system", content: "Sen zeki, samimi ve arkadaş canlısı bir asistansın. Kullanıcıya her zaman TÜRKÇE yanıt ver. Günlük konuşma dilinde, kısa ve net cevap ver. Gereksiz detaydan kaçın." };
    const model = "@cf/meta/llama-3.2-11b-vision-instruct";
    await env.AI.run(model, { prompt: "agree" }).catch(() => {
    });
    let aiInput;
    if (file && file.size > 0 && file.type.startsWith("image/")) {
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:${file.type};base64,${base64Data}`;
      aiInput = {
        messages: [systemMsg, { role: "user", content: [{ type: "text", text: message || "Bu görseli detaylıca açıkla." }, { type: "image_url", image_url: { url: dataUrl } }] }],
        max_tokens: 512,
        temperature: 0.7
      };
    } else {
      aiInput = {
        messages: [systemMsg, { role: "user", content: file ? `Kullanıcı "${file.name}" adında bir dosya yükledi (${file.type}). Soru: ${message || "Bu dosyayı özetle."}` : message }],
        max_tokens: 512,
        temperature: 0.7
      };
    }
    const result = await env.AI.run(model, aiInput);
    const reply = result?.response || result?.choices?.[0]?.message?.content || JSON.stringify(result);
    return json({ reply }, 200);
  } catch (error) {
    return json({ error: "AI Hatası: " + error.message }, 500);
  }
}
__name(handleChat, "handleChat");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
