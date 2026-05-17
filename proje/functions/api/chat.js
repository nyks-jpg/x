export async function onRequestPost(context) {
    try {
        const apiKey = context.env.GEMINI_API_KEY; 

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Cloudflare üzerinde GEMINI_API_KEY tanımlanmamış!" }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Ön yüzden gelen FormData yapısını çözüyoruz
        const formData = await context.request.formData();
        const message = formData.get('message') || "";
        const file = formData.get('file');

        if (!message && !file) {
            return new Response(JSON.stringify({ error: "Lütfen bir mesaj veya dosya gönderin." }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        let parts = [{ text: message }];

        // Eğer bir dosya/resim gönderildiyse bunu Gemini'nin anlayacağı formata çeviriyoruz
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

        // Gemini API'sine istek atıyoruz
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
            // Ön yüzün beklediği 'reply' formatında temizce dönüyoruz
            return new Response(JSON.stringify({ reply: aiText }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            const errMsg = data.error ? data.error.message : "Yapay zeka yanıt veremedi.";
            return new Response(JSON.stringify({ error: "Gemini Hatası: " + errMsg }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        return new Response(JSON.stringify({ error: "Sistem hatası: " + error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
