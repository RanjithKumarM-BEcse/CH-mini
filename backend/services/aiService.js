const { OpenAI } = require('openai');

// Groq provides an OpenAI-compatible API endpoint
const getGroqClient = () => {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key',
    baseURL: "https://api.groq.com/openai/v1"
  });
};

/**
 * Sends a certificate image buffer or Base64 string to Groq's Vision model
 * for forensic authenticity check (specialized in detecting fake student certificates,
 * e.g., Infosys Springboard, Coursera, NPTEL, etc.)
 */
async function verifyCertificateWithAI(imageBufferOrBase64, filename = 'certificate.png') {
  try {
    const groq = getGroqClient();
    
    let dataUrl;
    if (typeof imageBufferOrBase64 === 'string' && imageBufferOrBase64.startsWith('data:')) {
      dataUrl = imageBufferOrBase64;
    } else if (typeof imageBufferOrBase64 === 'string') {
      dataUrl = `data:image/jpeg;base64,${imageBufferOrBase64}`;
    } else {
      const base64Image = imageBufferOrBase64.toString('base64');
      dataUrl = `data:image/jpeg;base64,${base64Image}`;
    }

    const systemPrompt = `You are an elite forensic document and certificate fraud detection expert for academic institutions.
Your primary role is assisting faculty and college staff in verifying whether student assignment certificates (especially Infosys Springboard, Coursera, NPTEL, HackerRank, etc.) are GENUINE or FAKED/FORGED.

Carefully inspect the certificate image for:
1. Student Name Tampering:
   - Font inconsistencies (mismatched font family, weight, kerning, or text alignment vs the rest of the certificate).
   - Artifacts around the name (compression halos, blurred rectangular backgrounds, color mismatches from erasing the original recipient's name).
   - Overlayed text placed on top of an existing template.
2. Platform Authenticity (especially Infosys Springboard):
   - Correct official logo, layout, signatures, issuing date format, and course hour indicators.
   - Forged or fabricated template layouts that do not match the official provider.
3. Verification Identifiers:
   - Certificate ID, verification URL, or QR code authenticity.

You must respond ONLY with valid JSON in this exact structure:
{
  "studentName": "Extracted student name",
  "courseName": "Extracted course title",
  "platform": "Infosys Springboard | Coursera | NPTEL | Other",
  "certificateId": "Alphanumeric ID or 'Not Found'",
  "status": "Verified" | "Suspicious",
  "confidence": "e.g. 96%",
  "fraudIndicators": [
    "Specific observation 1",
    "Specific observation 2"
  ],
  "reason": "Detailed summary explanation for the teacher on why this certificate is considered Genuine or Fake/Edited."
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Analyze this student certificate (${filename}). Determine if it is authentic or faked/altered.` 
            },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed;
  } catch (error) {
    console.error('Groq AI Verification Error:', error);
    // Return a sensible fallback if Groq API fails or is offline
    return {
      studentName: 'Student (Inspection Needed)',
      courseName: 'Course Assignment',
      platform: 'Infosys Springboard',
      certificateId: 'UNKNOWN',
      status: 'Suspicious',
      confidence: '70%',
      fraudIndicators: ['Automated AI inspection encountered an error; manual staff verification recommended.'],
      reason: error.message || 'Verification service error'
    };
  }
}

module.exports = { verifyCertificateWithAI };
