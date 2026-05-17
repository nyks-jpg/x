export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (url.pathname === "/api/chat" && request.method === "POST") {
            return handleChat(request, env);
        }

        if (url.pathname === "/api/leaderboard" && request.method === "GET") {
            return handleLeaderboardGet(request, env);
        }

        if (url.pathname === "/api/leaderboard/sync" && request.method === "POST") {
            return handleLeaderboardSync(request, env);
        }

        return env.ASSETS.fetch(request);
    }
};

async function handleLeaderboardGet(request, env) {
    try {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
        const key = `lb:${date}`;
        const data = await env.LEADERBOARD.get(key, "json");
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => b.hours - a.hours);
        return new Response(JSON.stringify(list), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}

async function handleLeaderboardSync(request, env) {
    try {
        const body = await request.json();
        const { nickname, date, hours } = body;
        if (!nickname || !date || hours === undefined) {
            return new Response(JSON.stringify({ error: "nickname, date, hours gerekli" }), {
                status: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        const key = `lb:${date}`;
        let list = await env.LEADERBOARD.get(key, "json");
        list = Array.isArray(list) ? list : [];

        const existing = list.find(e => e.nickname === nickname);
        if (existing) {
            existing.hours = hours;
            existing.updated = Date.now();
        } else {
            list.push({ nickname, hours, updated: Date.now() });
        }

        await env.LEADERBOARD.put(key, JSON.stringify(list));
        return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}

async function handleChat(request, env) {
    try {
        const formData = await request.formData();
        const message = formData.get('message') || "";
        const file = formData.get('file');

        if (!message && !file) {
            return new Response(JSON.stringify({ error: "Mesaj boş olamaz." }), {
                status: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        const systemMsg = { role: "system", content: "Sen zeki, samimi ve arkadaş canlısı bir asistansın. Kullanıcıya her zaman TÜRKÇE yanıt ver. Günlük konuşma dilinde, kısa ve net cevap ver. Gereksiz detaydan kaçın." };
        const model = "@cf/meta/llama-3.2-11b-vision-instruct";
        await env.AI.run(model, { prompt: "agree" }).catch(() => {});

        let aiInput;

        if (file && file.size > 0 && file.type.startsWith("image/")) {
            const arrayBuffer = await file.arrayBuffer();
            const base64Data = btoa(
                new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            const dataUrl = `data:${file.type};base64,${base64Data}`;

            aiInput = {
                messages: [
                    systemMsg,
                    {
                        role: "user",
                        content: [
                            { type: "text", text: message || "Bu görseli detaylıca açıkla." },
                            { type: "image_url", image_url: { url: dataUrl } }
                        ]
                    }
                ],
                max_tokens: 512,
                temperature: 0.7
            };
        } else {
            const context = file
                ? `Kullanıcı "${file.name}" adında bir dosya yükledi (${file.type}). Soru: ${message || "Bu dosyayı özetle."}`
                : message;

            aiInput = {
                messages: [
                    systemMsg,
                    { role: "user", content: context }
                ],
                max_tokens: 512,
                temperature: 0.7
            };
        }

        const result = await env.AI.run(model, aiInput);
        const reply = result?.response || result?.choices?.[0]?.message?.content || JSON.stringify(result);

        return new Response(JSON.stringify({ reply }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "AI Hatası: " + error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}
