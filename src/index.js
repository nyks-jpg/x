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

        let model, aiInput;

        const systemMsg = { role: "system", content: "Sen samimi, arkadaş canlısı bir asistansın. Kullanıcıya her zaman TÜRKÇE yanıt ver. Resmi değil, günlük konuşma dilinde cevap ver. Kısa ve net ol." };

        if (file && file.size > 0 && file.type.startsWith("image/")) {
            const arrayBuffer = await file.arrayBuffer();
            const base64Data = btoa(
                new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            const dataUrl = `data:${file.type};base64,${base64Data}`;

            model = "@cf/meta/llama-3.2-11b-vision-instruct";
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
                max_tokens: 1024
            };

            await env.AI.run(model, { prompt: "agree" }).catch(() => {});
        } else {
            const context = file
                ? `Kullanıcı "${file.name}" adında bir dosya yükledi (${file.type}). Soru: ${message || "Bu dosyayı özetle."}`
                : message;

            model = "@cf/mistral/mistral-7b-instruct-v0.1";
            aiInput = {
                messages: [
                    systemMsg,
                    { role: "user", content: context }
                ],
                max_tokens: 1024
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
