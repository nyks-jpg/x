export async function onRequestPost(context) {
    try {
        const { prompt, file } = await context.request.json();
        const apiKey = context.env.GEMINI_API_KEY; 

        if (!apiKey) {
            return new Response(JSON.stringify({ text: "Hata: Cloudflare üzerinde GEMINI_API_KEY tanımlanmamış!" }), { status: 500 });
        }

        // Gemini 1.5 Flash her türlü dökümanı, sesi ve videoyu destekler
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        let parts = [{ text: prompt }];

        // Dosya yüklenmişse türü ne olursa olsun (PDF, MP3, MP4, PNG vb.) içeriğe dahil et
        if (file && file.base64) {
            parts.push({
                inlineData: {
                    mimeType: file.mimeType,
                    data: file.base64
                }
            });
        }

        const response = await fetch(googleUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }]
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const aiText = data.candidates[0].content.parts[0].text;
            return new Response(JSON.stringify({ text: aiText }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            // Google'dan dönen detaylı hatayı yakalamak için
            const errMsg = data.error ? data.error.message : "Dosya formatı desteklenmiyor veya çok büyük.";
            return new Response(JSON.stringify({ text: "Gemini Hatası: " + errMsg }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        return new Response(JSON.stringify({ text: "Sistem hatası meydana geldi: " + error.message }), { status: 500 });
    }
}
