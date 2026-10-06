const { OpenAI } = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');

const getGroqClient = () => {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key',
    baseURL: "https://api.groq.com/openai/v1"
  });
};

/**
 * Safely parse JSON from LLM responses even if markdown codeblocks are present
 */
function safeParseJSON(str, fallback = {}) {
  if (!str) return fallback;
  try {
    const cleaned = str.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    const match = str.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {}
    }
    return fallback;
  }
}

/**
 * Regex-based helper to extract candidate recipient name from certificate text
 */
function extractNameFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // Patterns like "This is to certify that RANJITH KUMAR M has successfully completed"
  const m1 = text.match(/(?:certify\s+that|awarded\s+to|presented\s+to|certifies\s+that)\s+([A-Z][A-Za-z\s.]{2,40}?)\s+(?:has|for|in|on|of|successfully|is)/i);
  if (m1 && m1[1] && m1[1].trim().length > 2) {
    return m1[1].trim();
  }

  // Pattern "RANJITH KUMAR M has successfully completed"
  const m2 = text.match(/([A-Z][A-Za-z\s.]{2,40}?)\s+has\s+successfully\s+completed/i);
  if (m2 && m2[1] && m2[1].trim().length > 2) {
    return m2[1].trim();
  }

  return null;
}

/**
 * Normalizes names for robust comparison (ignoring case, spaces, and punctuation)
 */
function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks if two student names refer to the same individual
 */
function checkNameMatch(nameA, nameB) {
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);
  if (!normA || !normB) return false;
  if (normA === 'student' || normB === 'student') return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Compare tokens (e.g. "Ranjith Kumar M" vs "M Ranjith Kumar")
  const tokensA = normA.split(' ').filter(Boolean).sort().join(' ');
  const tokensB = normB.split(' ').filter(Boolean).sort().join(' ');
  return tokensA === tokensB;
}

/**
 * Attempts to decode a QR code from an image buffer using jsQR and Jimp
 */
async function decodeQRCodeFromBuffer(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    const { data, width, height } = image.bitmap;
    const clampedArray = new Uint8ClampedArray(data);
    const qrResult = jsQR(clampedArray, width, height);
    if (qrResult && qrResult.data) {
      console.log('[QR Scanner] Successfully decoded QR URL:', qrResult.data);
      return qrResult.data;
    }
  } catch (err) {
    console.warn('[QR Scanner] Direct image matrix decode notice:', err.message);
  }
  return null;
}

/**
 * Scrapes visible text content from a verification URL
 */
async function scrapeVerificationPage(url) {
  if (!url || !url.startsWith('http')) return null;

  try {
    console.log('[Web Scraper] Fetching verification page:', url);
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Remove scripts, styles, and SVG artifacts
    $('script, style, noscript, svg').remove();

    // Extract text content
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    return bodyText.slice(0, 4000);
  } catch (err) {
    console.warn(`[Web Scraper] Failed to fetch verification page (${url}):`, err.message);
    return null;
  }
}

/**
 * THE CORE VERIFICATION PIPELINE:
 * 1. Extract QR Code / Verification Link from the certificate (via text, QR scanner, or PDF buffer).
 * 2. Scrape the official verification webpage.
 * 3. Extract the student name directly from the certificate document.
 * 4. Extract the recipient name from the official webpage.
 * 5. Compare the two names:
 *    - Match -> GENUINE (Verified)
 *    - Mismatch / Missing -> FAKE / SUSPICIOUS
 */
async function verifyCertificateWithAI(imageBufferOrBase64, filename = 'certificate.png', certificateText = '') {
  try {
    const groq = getGroqClient();

    let imageBuffer;
    let dataUrl;

    if (Buffer.isBuffer(imageBufferOrBase64)) {
      imageBuffer = imageBufferOrBase64;
      dataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    } else if (typeof imageBufferOrBase64 === 'string' && imageBufferOrBase64.startsWith('data:')) {
      dataUrl = imageBufferOrBase64;
      const base64Data = imageBufferOrBase64.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      const base64String = String(imageBufferOrBase64);
      dataUrl = `data:image/jpeg;base64,${base64String}`;
      imageBuffer = Buffer.from(base64String, 'base64');
    }

    // Step 1: Detect Verification URL (from certificate text, QR code, or raw PDF buffer)
    let detectedUrl = null;

    // 1A. Check if URL is present in extracted certificate text
    if (certificateText) {
      const textUrls = certificateText.match(/https?:\/\/[^\s"'<>\)]+/gi) || [];
      detectedUrl = textUrls.find(u => /springboard|infosys|wingspan|verify|cert/i.test(u)) || textUrls[0] || null;
    }

    // 1B. If not found in text, attempt direct QR Code Matrix decoding from image
    if (!detectedUrl && imageBuffer) {
      detectedUrl = await decodeQRCodeFromBuffer(imageBuffer);
    }

    // 1C. Check if buffer is a raw PDF containing a URL
    if (!detectedUrl && imageBuffer) {
      const isRawPdf = imageBuffer.slice(0, 5).toString().includes('%PDF');
      if (isRawPdf) {
        const pdfRawText = imageBuffer.toString('latin1');
        const foundUrls = pdfRawText.match(/https?:\/\/[^\s"'<>\)]+/gi) || [];
        detectedUrl = foundUrls.find(u => /springboard|infosys|wingspan|verify|cert/i.test(u)) || foundUrls[0] || null;
      }
    }

    console.log(`[Verification Pipeline] Detected Verification URL: "${detectedUrl}"`);

    // Step 2: Scrape the Verification Webpage
    let scrapedWebsiteText = null;
    if (detectedUrl) {
      scrapedWebsiteText = await scrapeVerificationPage(detectedUrl);
    }

    // Step 3: Extract Name on Certificate and Name on Official Website & Match
    let certStudentName = extractNameFromText(certificateText);
    let websiteStudentName = null;
    let courseTitle = 'Infosys Springboard Assignment';
    let isMatch = false;
    let matchReason = '';

    // If we have certificate text (from PDF or OCR), use Llama 3.3 to extract and cross-check
    if (certificateText && certificateText.length > 10) {
      const comparisonPrompt = `You are an automated academic certificate verification referee.

We have two sources of information:
SOURCE 1 - TEXT EXTRACTED DIRECTLY FROM THE CERTIFICATE FILE:
"""
${certificateText.slice(0, 3000)}
"""

SOURCE 2 - TEXT SCRAPED FROM THE OFFICIAL VERIFICATION WEBPAGE (${detectedUrl || 'No URL'}):
"""
${scrapedWebsiteText || 'No official verification webpage accessible'}
"""

YOUR INSTRUCTIONS:
1. Extract "extracted_name_on_cert": The exact recipient / student name printed on the certificate who earned the credential (look for the person's name, e.g., following "This is to certify that", "awarded to", "presented to", or prominently featured as the recipient). Do NOT use course titles (like "Programming Fundamentals using Python") or instructor names.
2. Extract "course_name": The course or credential title.
3. Extract "extracted_name_on_website": The recipient name registered on the official verification webpage (if available).
4. Compare "extracted_name_on_cert" with "extracted_name_on_website":
   - "is_match": true IF and only IF both names identify the same student (allow minor differences in casing, initials, or spacing, e.g. "RANJITH KUMAR M" matches "Ranjith Kumar M" or "Ranjith Kumar").
   - "is_match": false IF the certificate has one student's name, but the official verification page belongs to a different person (indicating a forged/photoshopped certificate), or if the official page shows no record.
5. Provide a clear "reason":
   - If match: "Genuine: Student name on certificate ('<name>') matches the official verification record."
   - If mismatch: "Fake / Suspicious: Certificate says '<name on cert>', but official verification record belongs to '<name on website>'."

Respond ONLY with valid JSON:
{
  "extracted_name_on_cert": "Student Name",
  "course_name": "Course Title",
  "extracted_name_on_website": "Name on Website or 'Not Found'",
  "is_match": true,
  "reason": "Clear explanation"
}`;

      try {
        const comparisonResponse = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You verify certificate authenticity by comparing certificate text against official verification webpage text. Return JSON only." },
            { role: "user", content: comparisonPrompt }
          ],
          response_format: { type: "json_object" }
        });

        const parsed = safeParseJSON(comparisonResponse.choices[0].message.content);
        if (parsed.extracted_name_on_cert && parsed.extracted_name_on_cert !== 'Student Name') {
          certStudentName = parsed.extracted_name_on_cert;
        }
        if (parsed.extracted_name_on_website) {
          websiteStudentName = parsed.extracted_name_on_website;
        }
        if (parsed.course_name) {
          courseTitle = parsed.course_name;
        }
        isMatch = Boolean(parsed.is_match);
        matchReason = parsed.reason || '';
      } catch (err) {
        console.warn('Llama 3.3 verification notice:', err.message);
      }
    } else {
      // Certificate text was not directly provided (image upload).
      // Attempt to extract via Vision or fallback
      try {
        const visionPrompt = `You are an automated academic certificate verification referee.
Examine this certificate image carefully.

OFFICIAL WEBPAGE TEXT (scraped from the verification QR code / URL ${detectedUrl || 'None'}):
"""
${scrapedWebsiteText || 'No verification webpage accessible'}
"""

YOUR INSTRUCTIONS:
1. Extract "extracted_name_on_cert": Read the student / recipient name printed on the certificate image.
2. Extract "course_name": The course or program title.
3. Extract "extracted_name_on_website": The recipient name registered on the official verification webpage.
4. "is_match": true if the name on the certificate matches the name registered on the official webpage. false if they are different people or if no official record exists.
5. "reason": Clear explanation of whether the student name on the certificate matches the official verification record.

Respond ONLY with valid JSON:
{
  "extracted_name_on_cert": "Student Name",
  "course_name": "Course Title",
  "extracted_name_on_website": "Name on Website or 'Not Found'",
  "is_match": true,
  "reason": "Clear explanation"
}`;

        // Ensure image is reasonably sized for Groq Vision
        let visionDataUrl = dataUrl;
        if (imageBuffer) {
          try {
            const jimpImg = await Jimp.read(imageBuffer);
            if (jimpImg.bitmap.width > 1200 || jimpImg.bitmap.height > 1200) {
              jimpImg.resize({ w: 1200, h: Jimp.AUTO });
              const resized = await jimpImg.getBuffer('image/jpeg', { quality: 80 });
              visionDataUrl = `data:image/jpeg;base64,${resized.toString('base64')}`;
            }
          } catch (resizeErr) {}
        }

        const visionResponse = await groq.chat.completions.create({
          model: "llama-3.2-90b-vision-preview",
          messages: [
            { role: "system", content: "You extract certificate data and compare with official verification webpage text. Return JSON only." },
            {
              role: "user",
              content: [
                { type: "text", text: visionPrompt },
                { type: "image_url", image_url: { url: visionDataUrl } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        });

        const parsedVision = safeParseJSON(visionResponse.choices[0].message.content);
        if (parsedVision.extracted_name_on_cert && parsedVision.extracted_name_on_cert !== 'Student Name') {
          certStudentName = parsedVision.extracted_name_on_cert;
        }
        if (parsedVision.extracted_name_on_website) {
          websiteStudentName = parsedVision.extracted_name_on_website;
        }
        if (parsedVision.course_name) {
          courseTitle = parsedVision.course_name;
        }
        isMatch = Boolean(parsedVision.is_match);
        matchReason = parsedVision.reason || '';
      } catch (visionErr) {
        console.warn('Vision extraction notice:', visionErr.message);
      }
    }

    // Programmatic verification safeguard:
    // If both names exist and match string normalization, enforce isMatch = true
    if (certStudentName && websiteStudentName && websiteStudentName !== 'Not Found') {
      if (checkNameMatch(certStudentName, websiteStudentName)) {
        isMatch = true;
        matchReason = `Genuine: Certificate student name ('${certStudentName}') matches the official verification record ('${websiteStudentName}').`;
      } else {
        isMatch = false;
        matchReason = `Fake / Suspicious: Certificate displays student name '${certStudentName}', but the official verification record belongs to '${websiteStudentName}'.`;
      }
    }

    // Final fallback defaults if names could not be found
    if (!certStudentName) {
      certStudentName = 'Student (Name not found)';
    }
    if (!websiteStudentName) {
      websiteStudentName = detectedUrl ? 'Verification record not accessible' : 'No QR / Link Detected';
    }

    if (!detectedUrl) {
      isMatch = false;
      matchReason = 'Suspicious: No valid QR code or verification link could be found on this certificate.';
    }

    const finalStatus = isMatch ? 'Verified' : 'Suspicious';

    console.log(`[Verification Pipeline Result] Name on Cert: "${certStudentName}", Website Name: "${websiteStudentName}", Status: ${finalStatus}`);

    return {
      studentName: certStudentName,
      courseName: courseTitle,
      extracted_name_on_cert: certStudentName,
      extracted_name_on_website: websiteStudentName,
      verification_url: detectedUrl || '',
      is_match: isMatch,
      status: finalStatus,
      aiMatchConfidence: isMatch ? '99%' : '40%',
      reason: matchReason || (isMatch ? 'Genuine: Student name matches official verification record.' : 'Fake: Student name does not match official verification record.')
    };

  } catch (error) {
    console.error('AI Verification Pipeline Error:', error);
    return {
      studentName: 'Student (Inspection Failed)',
      courseName: 'Course Assignment',
      extracted_name_on_cert: 'Unknown',
      extracted_name_on_website: 'Unknown',
      verification_url: '',
      is_match: false,
      status: 'Suspicious',
      aiMatchConfidence: '50%',
      reason: `Verification failed during inspection: ${error.message}`
    };
  }
}

module.exports = {
  decodeQRCodeFromBuffer,
  scrapeVerificationPage,
  verifyCertificateWithAI
};
