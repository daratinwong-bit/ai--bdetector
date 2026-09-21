// ไฟล์นี้จะทำหน้าที่เป็น Backend Server ให้คุณแบบฟรีๆ บน Vercel
// มันจะรับภาพจากหน้าเว็บคุณ แล้วส่งไปให้ Google Gemini อย่างปลอดภัย (ผู้ใช้จะไม่เห็น Key)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
        return res.status(400).json({ message: 'ไม่พบข้อมูลภาพ' });
    }

    // ตัวแปรนี้ต้องไปตั้งค่าในหน้าเว็บ Vercel (Environment Variables) 
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ message: 'เจ้าของเว็บยังไม่ได้ตั้งค่า API Key' });
    }

    const prompt = "คุณคือผู้เชี่ยวชาญด้านการตรวจสอบภาพถ่าย นิติวิทยาศาสตร์ดิจิทัล หน้าที่ของคุณคือการสแกนภาพนี้อย่างละเอียดเพื่อหาจุดบกพร่องที่เกิดจากการสร้างด้วย AI (เช่น จำนวนนิ้วมือผิดปกติ, ความเบี้ยวของตัวหนังสือ, แสงเงาที่สมบูรณ์แบบเกินจริง, รายละเอียดพื้นหลังที่รวมกันมั่วๆ ไร้เหตุผล) ให้ประเมินและคืนค่าเป็นรูปแบบ JSON ที่ประกอบด้วย 1. ai_score (จำนวนเต็ม 0-100 บ่งบอกเปอร์เซ็นต์ความน่าจะเป็นที่สร้างจาก AI) 2. visual_clues (รายการอาร์เรย์ของข้อความภาษาไทย อธิบายจุดสังเกตเด่นๆ ที่พบ 2-3 ข้อ)";

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
                ]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "ai_score": { "type": "INTEGER" },
                    "visual_clues": {
                        "type": "ARRAY",
                        "items": { "type": "STRING" }
                    }
                }
            }
        }
    };

    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        // ส่งผลลัพธ์กลับไปที่หน้าเว็บ
        if (data.candidates && data.candidates.length > 0) {
            const jsonText = data.candidates[0].content.parts[0].text;
            const result = JSON.parse(jsonText);
            return res.status(200).json(result);
        } else {
            return res.status(500).json({ message: 'AI ตอบกลับผิดพลาด' });
        }
    } catch (error) {
        console.error("Backend Error:", error);
        return res.status(500).json({ message: 'เซิร์ฟเวอร์ขัดข้องชั่วคราว' });
    }
}