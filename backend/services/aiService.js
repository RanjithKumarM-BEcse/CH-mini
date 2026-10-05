const { OpenAI } = require('openai');

// Groq provides an OpenAI-compatible API endpoint!
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

/**
 * Sends the certificate image buffer to Groq's Vision model
 * for extraction and verification.
 */
async function verifyCertificateWithAI(imageBuffer) {
  try {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const response = await groq.chat.completions.create({
      // Using Groq's Llama 3.2 Vision model
      model: "llama-3.2-90b-vision-preview",
      messages: [
        {
          role: "system",
          content: "You are an automated certificate verification assistant. Extract the student name, course name, and assess authenticity. Return ONLY valid JSON in this structure: { \"student_name\": \"...\", \"course_name\": \"...\", \"status\": \"Verified\" | \"Suspicious\", \"match_confidence\": \"...%\", \"reason\": \"...\" }"
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Please analyze this certificate image." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Groq AI Verification Error:', error);
    throw error;
  }
}

module.exports = { verifyCertificateWithAI };
