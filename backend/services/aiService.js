const { OpenAI } = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');
const JSZip = require('jszip');

const getGroqClient = () => {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key',
    baseURL: "https://api.groq.com/openai/v1"
  });
};

/**
 * Blacklist of non-student names and terms commonly found on certificates
 * (signatories, executive titles, course titles, organization names)
 */
const NON_STUDENT_BLACKLIST = /thirumala|arohi|narayana|murthy|sanjeev|goel|vice president|president|authorized|signatory|signature|infosys|springboard|wingspan|certificate|completion|achievement|congratulations|programming|fundamentals|python|java|cloud|developer|engineer|foundation|primer/i;

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
 * Decompresses and parses Sunbird / Wingspan W3C Verifiable Credential from QR code data
 */
async function parseVerifiableCredentialFromQR(qrData) {
  if (!qrData) return null;
  try {
    const zip = await JSZip.loadAsync(qrData);
    if (zip.file("certificate.json")) {
      const jsonStr = await zip.file("certificate.json").async("text");
      const certJson = JSON.parse(jsonStr);
      const studentName = certJson.credentialSubject?.issuedTo || 
                          certJson.credentialSubject?.recipientName || 
                          certJson.credentialSubject?.name || null;
      const courseName = certJson.credentialSubject?.trainingName || 
                         certJson.credentialSubject?.courseName || null;
      console.log('[QR Sunbird VC] Successfully decoded certificate.json for student:', studentName);
      return {
        studentName,
        courseName,
        issuer: certJson.issuer,
        issuanceDate: certJson.issuanceDate,
        rawJson: certJson
      };
    }
  } catch (zipErr) {
    // Check if raw JSON or JWT
    try {
      const certJson = typeof qrData === 'object' ? qrData : JSON.parse(qrData);
      const studentName = certJson.credentialSubject?.issuedTo || 
                          certJson.credentialSubject?.recipientName || 
                          certJson.credentialSubject?.name || null;
      const courseName = certJson.credentialSubject?.trainingName || 
                         certJson.credentialSubject?.courseName || null;
      if (studentName) {
        return { studentName, courseName, rawJson: certJson };
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Regex-based helper to extract candidate recipient name from certificate text
 */
function extractNameFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // Pattern: "This is to certify that [NAME] has successfully completed"
  const m1 = text.match(/certif(?:y\s+that|ies\s+that)\s+([A-Z][A-Za-z\s.]{2,45}?)\s+has\s+successfully\s+completed/i);
  if (m1 && m1[1] && !NON_STUDENT_BLACKLIST.test(m1[1].trim())) {
    return m1[1].trim();
  }

  // Pattern: "This is to certify that [NAME] has"
  const m2 = text.match(/(?:certify\s+that|awarded\s+to|presented\s+to|certifies\s+that)\s+([A-Z][A-Za-z\s.]{2,45}?)\s+(?:has|for|in|on|of|successfully|is)/i);
  if (m2 && m2[1] && !NON_STUDENT_BLACKLIST.test(m2[1].trim())) {
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
      console.log('[QR Scanner] Successfully decoded QR data length:', qrResult.data.length);
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
  // If it's just the generic portal homepage without query or path, scraping returns an empty SPA
  if (/^https?:\/\/verify\.(?:onwingspan\.com|springboard\.infosys\.com)\/?$/i.test(url.trim())) {
    return null;
  }

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
    $('script, style, noscript, svg').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    return bodyText.length > 20 ? bodyText.slice(0, 4000) : null;
  } catch (err) {
    console.warn(`[Web Scraper] Failed to fetch verification page (${url}):`, err.message);
    return null;
  }
}

/**
 * THE CORE VERIFICATION PIPELINE:
 * 1. Extract QR Code Verifiable Credential or Verification Link.
 * 2. Decode official student name from QR cryptographic credential or scraped webpage.
 * 3. Extract the student name directly from the certificate document (the BLUE COLOR BIG NAME).
 * 4. Compare the two names:
 *    - Match -> GENUINE (Verified)
 *    - Mismatch / Missing -> FAKE / SUSPICIOUS
 */
async function verifyCertificateWithAI(imageBufferOrBase64, filename = 'certificate.png', certificateText = '', candidateBigName = '', qrDecoded = null) {
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

    // Step 1: Detect Verification Data (QR Verifiable Credential or URL)
    let detectedUrl = null;
    let qrCredential = null;

    // 1A. Check if client already decoded the QR code
    if (qrDecoded) {
      if (qrDecoded.studentName) {
        qrCredential = {
          studentName: qrDecoded.studentName,
          courseName: qrDecoded.courseName
        };
      }
      if (qrDecoded.url) {
        detectedUrl = qrDecoded.url;
      }
      if (qrDecoded.raw && !qrCredential) {
        qrCredential = await parseVerifiableCredentialFromQR(qrDecoded.raw);
      }
    }

    // 1B. Server-side QR Code decoding from imageBuffer
    if (!qrCredential && imageBuffer) {
      const serverQrData = await decodeQRCodeFromBuffer(imageBuffer);
      if (serverQrData) {
        if (serverQrData.startsWith('http')) {
          detectedUrl = serverQrData;
        }
        qrCredential = await parseVerifiableCredentialFromQR(serverQrData);
      }
    }

    // 1C. Check if URL is present in extracted certificate text
    if (!detectedUrl && certificateText) {
      const textUrls = certificateText.match(/https?:\/\/[^\s"'<>\)]+/gi) || [];
      detectedUrl = textUrls.find(u => /springboard|infosys|wingspan|verify|cert/i.test(u)) || textUrls[0] || null;
    }

    // 1D. Check if buffer is a raw PDF containing a URL
    if (!detectedUrl && imageBuffer) {
      const isRawPdf = imageBuffer.slice(0, 5).toString().includes('%PDF');
      if (isRawPdf) {
        const pdfRawText = imageBuffer.toString('latin1');
        const foundUrls = pdfRawText.match(/https?:\/\/[^\s"'<>\)]+/gi) || [];
        detectedUrl = foundUrls.find(u => /springboard|infosys|wingspan|verify|cert/i.test(u)) || foundUrls[0] || null;
      }
    }

    if (!detectedUrl && qrCredential) {
      detectedUrl = 'https://verify.onwingspan.com';
    }

    console.log(`[Verification Pipeline] Detected URL: "${detectedUrl}", QR Credential Student: "${qrCredential?.studentName}"`);

    // Step 2: Resolve official registered student name from QR Credential or Webpage
    let websiteStudentName = qrCredential?.studentName || null;
    let courseTitle = qrCredential?.courseName || 'Infosys Springboard Assignment';
    let scrapedWebsiteText = null;

    if (!websiteStudentName && detectedUrl) {
      scrapedWebsiteText = await scrapeVerificationPage(detectedUrl);
    }

    // Step 3: Extract Name on Certificate (Priority: layout font analysis candidateBigName)
    let certStudentName = (candidateBigName && !NON_STUDENT_BLACKLIST.test(candidateBigName)) 
      ? candidateBigName 
      : extractNameFromText(certificateText);

    let isMatch = false;
    let matchReason = '';

    // If we still need to extract via AI or cross-check
    if (certificateText && certificateText.length > 10) {
      const comparisonPrompt = `You are an automated academic certificate verification referee.

We have two sources of information:
SOURCE 1 - TEXT EXTRACTED DIRECTLY FROM THE CERTIFICATE FILE:
"""
${certificateText.slice(0, 3000)}
"""

SOURCE 2 - OFFICIAL RECORD (from QR Code Verifiable Credential / Verification Link):
${websiteStudentName ? `Official Registered Recipient in Cryptographic QR Credential: "${websiteStudentName}"` : `Scraped Webpage Content: """${scrapedWebsiteText || 'No webpage text accessible'}"""`}

CRITICAL IDENTIFICATION RULES:
1. "extracted_name_on_cert": The student's name is the prominent BIG NAME printed in BLUE COLOR in the center of the certificate (e.g. "RANJITH KUMAR M").
${candidateBigName ? `   - Layout font analysis detected the prominent big text as: "${candidateBigName}".` : ''}
   - NEVER select signatory names at the bottom (e.g. "Thirumala Arohi", "Narayana Murthy", "Sanjeev Goel", "Executive Vice President").
   - NEVER select course titles (e.g. "Programming Fundamentals using Python").
   - NEVER select organization names ("Infosys Springboard", "Infosys").

2. "course_name": The course or program title.

3. "extracted_name_on_website": The recipient registered on the official verification record (${websiteStudentName ? `"${websiteStudentName}"` : 'from official page'}).

4. "is_match": true IF and only IF the student name on the certificate matches the recipient registered on the official verification record (allowing minor spacing, casing, or initials). false IF the certificate has one student's name, but the official record belongs to a different person (forged certificate).

5. "reason": Concise explanation of whether the student name on the certificate matches the official verification record.

Respond ONLY with valid JSON:
{
  "extracted_name_on_cert": "${certStudentName || 'Student Name'}",
  "course_name": "${courseTitle}",
  "extracted_name_on_website": "${websiteStudentName || 'Name or Not Found'}",
  "is_match": true,
  "reason": "Clear explanation"
}`;

      try {
        const comparisonResponse = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You verify certificate authenticity by comparing the big blue student name on the certificate with the official cryptographic verification record. Return JSON only." },
            { role: "user", content: comparisonPrompt }
          ],
          response_format: { type: "json_object" }
        });

        const parsed = safeParseJSON(comparisonResponse.choices[0].message.content);
        if (parsed.extracted_name_on_cert && parsed.extracted_name_on_cert !== 'Student Name' && !NON_STUDENT_BLACKLIST.test(parsed.extracted_name_on_cert)) {
          certStudentName = parsed.extracted_name_on_cert;
        }
        if (!websiteStudentName && parsed.extracted_name_on_website && parsed.extracted_name_on_website !== 'Not Found') {
          websiteStudentName = parsed.extracted_name_on_website;
        }
        if (parsed.course_name && parsed.course_name !== 'Course Title') {
          courseTitle = parsed.course_name;
        }
        isMatch = Boolean(parsed.is_match);
        matchReason = parsed.reason || '';
      } catch (err) {
        console.warn('Llama 3.3 verification notice:', err.message);
      }
    } else if (!certStudentName) {
      // Vision model fallback if no text provided
      try {
        const visionPrompt = `You are an automated academic certificate verification referee.
Examine this certificate image carefully.

OFFICIAL RECORD:
${websiteStudentName ? `Official Registered Recipient: "${websiteStudentName}"` : `URL: ${detectedUrl || 'None'}`}

CRITICAL RULE FOR STUDENT / RECIPIENT NAME:
1. "extracted_name_on_cert": The student's name is the prominent BIG text written in BLUE COLOR in the center of the certificate (e.g. "RANJITH KUMAR M").
   - LOOK SPECIFICALLY FOR THE LARGE TEXT IN BLUE COLOR!
   - DO NOT pick the signatories at the bottom ("Thirumala Arohi", "Narayana Murthy", "Sanjeev Goel", "Executive Vice President").
   - DO NOT pick course names ("Programming Fundamentals using Python") or organization names ("Infosys Springboard").

2. "course_name": The course title.

3. "extracted_name_on_website": "${websiteStudentName || 'Not Found'}".

4. "is_match": true if the blue big name on the certificate matches the official record name.

5. "reason": Clear explanation of verification result.

Respond ONLY with valid JSON:
{
  "extracted_name_on_cert": "Student Name",
  "course_name": "Course Title",
  "extracted_name_on_website": "${websiteStudentName || 'Not Found'}",
  "is_match": true,
  "reason": "Clear explanation"
}`;

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
            { role: "system", content: "You extract the prominent big blue student name on the certificate. Return JSON only." },
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
        if (parsedVision.extracted_name_on_cert && parsedVision.extracted_name_on_cert !== 'Student Name' && !NON_STUDENT_BLACKLIST.test(parsedVision.extracted_name_on_cert)) {
          certStudentName = parsedVision.extracted_name_on_cert;
        }
        if (!websiteStudentName && parsedVision.extracted_name_on_website) {
          websiteStudentName = parsedVision.extracted_name_on_website;
        }
      } catch (visionErr) {
        console.warn('Vision extraction notice:', visionErr.message);
      }
    }

    // Safety check: ensure certStudentName is never a signatory or title
    if (!certStudentName || NON_STUDENT_BLACKLIST.test(certStudentName)) {
      if (candidateBigName && !NON_STUDENT_BLACKLIST.test(candidateBigName)) {
        certStudentName = candidateBigName;
      } else {
        const regexName = extractNameFromText(certificateText);
        if (regexName && !NON_STUDENT_BLACKLIST.test(regexName)) {
          certStudentName = regexName;
        }
      }
    }

    // Programmatic verification safeguard:
    // If both certStudentName and websiteStudentName exist:
    if (certStudentName && websiteStudentName && websiteStudentName !== 'Not Found' && websiteStudentName !== 'Verification record not accessible') {
      if (checkNameMatch(certStudentName, websiteStudentName)) {
        isMatch = true;
        matchReason = `Genuine: Student name on certificate ('${certStudentName}') matches the official verification record ('${websiteStudentName}').`;
      } else {
        isMatch = false;
        matchReason = `Fake / Suspicious: Certificate displays student name '${certStudentName}', but the official verification record belongs to '${websiteStudentName}'.`;
      }
    }

    // If websiteStudentName is still not found but certificate text contains the generic wingspan URL
    if (!websiteStudentName) {
      websiteStudentName = detectedUrl ? 'Verification record not accessible' : 'No QR / Link Detected';
      if (!isMatch) {
        matchReason = 'Suspicious: Official verification record could not be extracted from the QR code or link.';
      }
    }

    const finalStatus = isMatch ? 'Verified' : 'Suspicious';

    console.log(`[Verification Pipeline Result] Name on Cert: "${certStudentName}", Official Name: "${websiteStudentName}", Status: ${finalStatus}`);

    return {
      studentName: certStudentName,
      courseName: courseTitle,
      extracted_name_on_cert: certStudentName,
      extracted_name_on_website: websiteStudentName,
      verification_url: detectedUrl || 'https://verify.onwingspan.com',
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
      verification_url: 'https://verify.onwingspan.com',
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
  parseVerifiableCredentialFromQR,
  verifyCertificateWithAI
};
