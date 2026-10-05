const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Sends the certificate image buffer to OpenAI Vision model
 * for extraction and verification.
 */
async function verifyCertificateWithAI(imageBuffer) {
  try {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
    console.error('AI Verification Error:', error);
    throw error;
  }
}

module.exports = { verifyCertificateWithAI };
