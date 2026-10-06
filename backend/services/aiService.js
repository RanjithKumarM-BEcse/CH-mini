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
    return bodyText.slice(0, 4000); // Take first 4000 chars for AI cross-check
  } catch (err) {
    console.warn(`[Web Scraper] Failed to fetch verification page (${url}):`, err.message);
    return null;
  }
}

/**
 * THE CORE VERIFICATION PIPELINE:
 * 1. Extract Name & QR Code / Verification Link from the certificate.
 * 2. Scrape the verification webpage.
 * 3. AI Cross-Checks the name on certificate vs the name found on the website.
 * 4. Outputs: extracted_name_on_cert, extracted_name_on_website, is_match, reason, status.
 */
async function verifyCertificateWithAI(imageBufferOrBase64, filename = 'certificate.png') {
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

    // Step 1A: Attempt direct QR Code Matrix decoding
    let detectedUrl = await decodeQRCodeFromBuffer(imageBuffer);

    // Step 1B: Use Vision AI to extract student name, course, and any printed verification URL or QR link
    const initialVisionPrompt = `You are an automated certificate data extraction engine.
Examine this certificate image carefully.
Extract:
1. "extracted_name_on_cert": The exact student name awarded this certificate.
2. "course_name": The course or program title (e.g. Infosys Springboard course name).
3. "verification_url": Any verification URL, link, or QR code destination URL visible anywhere on the certificate (e.g., https://infyspringboard.onwingspan.com/..., https://verify.springboard.infosys.com/..., or similar verification link). If none found, return null.

Respond ONLY with valid JSON:
{
  "extracted_name_on_cert": "Student Name",
  "course_name": "Course Name",
  "verification_url": "https://..." or null
}`;

    let visionExtracted = {
      extracted_name_on_cert: 'Student',
      course_name: 'Course Assignment',
      verification_url: null
    };

    try {
      const visionResponse = await groq.chat.completions.create({
        model: "llama-3.2-90b-vision-preview",
        messages: [
          { role: "system", content: "You extract certificate data. Respond only in JSON." },
          {
            role: "user",
            content: [
              { type: "text", text: initialVisionPrompt },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });
      visionExtracted = JSON.parse(visionResponse.choices[0].message.content);
    } catch (e) {
      console.warn('Vision extraction notice:', e.message);
    }

    const finalVerificationUrl = detectedUrl || visionExtracted.verification_url;
    const certStudentName = visionExtracted.extracted_name_on_cert || 'Student';
    const courseTitle = visionExtracted.course_name || 'Infosys Springboard Assignment';

    console.log(`[Verification Pipeline] Extracted Name on Cert: "${certStudentName}", URL: "${finalVerificationUrl}"`);

    // Step 2: Scrape the Verification Webpage
    let scrapedWebsiteText = null;
    if (finalVerificationUrl) {
      scrapedWebsiteText = await scrapeVerificationPage(finalVerificationUrl);
    }

    // Step 3: AI Cross-Check (Compare name on certificate vs name on website)
    if (finalVerificationUrl && scrapedWebsiteText) {
      const comparisonPrompt = `You are an automated academic certificate verification referee.
We extracted the student name from the certificate image: "${certStudentName}".
We scraped the official verification webpage from the QR code / verification link (${finalVerificationUrl}).

Official Webpage Scraped Text:
"""
${scrapedWebsiteText}
"""

Task:
1. Find the student name registered on the official verification website ("extracted_name_on_website").
2. Compare "extracted_name_on_cert" with "extracted_name_on_website".
3. Check "is_match": true if both names identify the same student (allowing for minor spacing, middle names, or capitalization differences). false if the certificate has one student's name, but the official link registers a DIFFERENT person (indicating a forged/photoshopped certificate), or if the website states invalid/no record.
4. Provide a clear reason explaining whether the names match or differ.

Respond ONLY with valid JSON:
{
  "extracted_name_on_cert": "${certStudentName}",
  "extracted_name_on_website": "Name found on official website or 'Not Found'",
  "is_match": true | false,
  "reason": "Brief explanation of whether the student name on the certificate matches the student registered on the verification URL."
}`;

      const comparisonResponse = await groq.chat.completions.create({
        model: "llama-3.2-90b-vision-preview",
        messages: [
          { role: "system", content: "You verify certificate authenticity by comparing certificate text against official verification webpage text. Return JSON only." },
          { role: "user", content: comparisonPrompt }
        ],
        response_format: { type: "json_object" }
      });

      const comparisonResult = JSON.parse(comparisonResponse.choices[0].message.content);

      return {
        studentName: certStudentName,
        courseName: courseTitle,
        extracted_name_on_cert: comparisonResult.extracted_name_on_cert || certStudentName,
        extracted_name_on_website: comparisonResult.extracted_name_on_website || 'Not Found',
        verification_url: finalVerificationUrl,
        is_match: Boolean(comparisonResult.is_match),
        status: comparisonResult.is_match ? 'Verified' : 'Suspicious',
        aiMatchConfidence: comparisonResult.is_match ? '99%' : '40%',
        reason: comparisonResult.reason || (comparisonResult.is_match ? 'Genuine: Student name matches the official verification record.' : 'Fake: Student name on certificate does not match the official verification record.')
      };
    } else {
      // If no QR URL was found on certificate, or URL could not be scraped
      const reason = !finalVerificationUrl
        ? 'Suspicious: No valid QR code or verification link could be extracted from this certificate.'
        : `Suspicious: Verification link (${finalVerificationUrl}) could not be reached or returned no student data.`;

      return {
        studentName: certStudentName,
        courseName: courseTitle,
        extracted_name_on_cert: certStudentName,
        extracted_name_on_website: 'No verification record accessible',
        verification_url: finalVerificationUrl || 'None detected',
        is_match: false,
        status: 'Suspicious',
        aiMatchConfidence: '35%',
        reason: reason
      };
    }

  } catch (error) {
    console.error('AI Verification Pipeline Error:', error);
    return {
      studentName: 'Student (Manual Review Needed)',
      courseName: 'Course Assignment',
      extracted_name_on_cert: 'Unknown',
      extracted_name_on_website: 'Unknown',
      verification_url: 'None',
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
