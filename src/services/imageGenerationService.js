
/**
 * Cloudflare Workers AI - FLUX.1 Schnell
 * Generates campaign illustrations.
 */

const config = require('../config/env');

class ImageGenerationService {
  static async generateCampaignImage({ title, category, description }) {
    const { accountId, apiToken } = config.cloudflare;

    if (!accountId || !apiToken) {
      throw new Error('Cloudflare credentials are not configured.');
    }

    

const prompt = `
  Create a premium, photorealistic visual for an education
  crowdfunding campaign website.

  Campaign: ${title}
  Category: ${category}
  Details: ${description}

  Show a realistic, welcoming classroom environment with
  underprivileged school children learning together, reading
  books and studying with notebooks.

  VISUAL REQUIREMENTS:
  - Authentic documentary photography.
  - Natural daylight and warm, hopeful atmosphere.
  - Professional nonprofit campaign photography.
  - Wide horizontal landscape composition.
  - Children and educational environment clearly visible.
  - Natural colors, realistic details and textures.

  STRICTLY AVOID:
  - Any text, typography, letters, numbers or symbols.
  - Fake writing, gibberish or random characters.
  - Logos, watermarks, signs, labels or branded clothing.
  - Cartoon, anime, illustration or 3D styles.
  - Artificial-looking faces or exaggerated expressions.

  The image must be a clean photographic visual only,
  with absolutely no graphic overlays or text.
`;



    const endpoint =
      `https://api.cloudflare.com/client/v4/accounts/${accountId}` +
      `/ai/run/@cf/black-forest-labs/flux-1-schnell`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
      prompt,
      steps: 4,
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudflare AI error:', response.status, errorText);

      throw new Error('Image generation failed. Please try again.');
    }

    const result = await response.json();

    if (!result.success || !result.result?.image) {
      throw new Error('Cloudflare did not return a valid image.');
    }

    return result.result.image;
  }
}

module.exports = ImageGenerationService;
