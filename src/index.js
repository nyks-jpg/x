export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (url.pathname === "/api/chat" && request.method === "POST") {
            return handleChat(request, env);
        }

        return env.ASSETS.fetch(request);
    }
};

async function handleChat(request, env) {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "GEMINI_API_KEY bulunamadı!" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }

    const formData = await request.formData();
    const message = formData.get('message') || "";
    const file = formData.get('file');

    if (!message && !file) {
        return new Response(JSON.stringify({ error: "Mesaj boş olamaz." }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }

    const model = env.GEMINI_MODEL || "gemini-2.0-flash-lite";
const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let parts = [{ text: message }];

    if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        parts.push({
            inlineData: { mimeType: file.type, data: base64Data }
        });
    }

    const response = await fetch(googleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: parts }] })
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return new Response(JSON.stringify({ reply: data.candidates[0].content.parts[0].text }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    } else {
        const errMsg = data.error ? data.error.message : "Yapay zeka yanıt oluşturamadı.";
        return new Response(JSON.stringify({ error: "Gemini Hatası: " + errMsg }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}
