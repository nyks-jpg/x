export default {
    async fetch(request, env, ctx) {
        // 1. Tarayıcıların güvenlik amaçlı attığı OPTIONS isteklerine anında onay veriyoruz (CORS)
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        // 2. Eğer gelen istek POST değilse hata döndür (Ama artık POST isteklerini kabul edecek!)
        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Sadece POST istekleri desteklenir." }), {
                status: 405,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        try {
            const apiKey = env.GEMINI_API_KEY; 

            if (!apiKey) {
                return new Response(JSON.stringify({ error: "GEMINI_API_KEY bulunamadı! Lütfen Cloudflare Settings -> Variables altından kontrol edin." }), { 
                    status: 500,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            // index.html'den gelen verileri alıyoruz
            const formData = await request.formData();
            const message = formData.get('message') || "";
            const file = formData.get('file');

            if (!message && !file) {
                return new Response(JSON.stringify({ error: "Mesaj alanı boş olamaz." }), { 
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            let parts = [{ text: message }];

            // Eğer resim/dosya yüklendiyse base64'e çevirip Gemini'ye ekliyoruz
            if (file && file.size > 0) {
                const arrayBuffer = await file.arrayBuffer();
                const base64Data = btoa(
                    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );

                parts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: base64Data
                    }
                });
            }

            // Gemini API'sine post atıyoruz
            const response = await fetch(googleUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: parts }]
                })
            });

            const data = await response.json();
            
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                const aiText = data.candidates[0].content.parts[0].text;
                // Ön yüzün beklediği 'reply' formatı ve CORS izniyle dönüyoruz
                return new Response(JSON.stringify({ reply: aiText }), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            } else {
                const errMsg = data.error ? data.error.message : "Yapay zeka yanıt oluşturamadı.";
                return new Response(JSON.stringify({ error: "Gemini Hatası: " + errMsg }), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

        } catch (error) {
            return new Response(JSON.stringify({ error: "Sistem hatası: " + error.message }), { 
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }
    }
};
