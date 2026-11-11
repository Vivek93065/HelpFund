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

    

const SCENES = {
      Education: 'a welcoming classroom or learning space with students reading books and studying together',
      Medical: 'a calm, caring healthcare setting such as a clinic with a supportive atmosphere (no patients\' faces in focus)',
      Emergency: 'a community coming together to help after a crisis, volunteers handing out supplies',
      'Non-Profit': 'volunteers working together on a community service project',
      Creative: 'a bright creative workspace with art, music or craft materials',
      Community: 'neighbours working together on a local improvement project in a shared public space'
    };
    const scene = SCENES[category] || 'people working together to help their community';

    const prompt = `
  Create a clean, hopeful illustration-style visual for a crowdfunding campaign website.

  Campaign: ${title}
  Category: ${category}
  Details: ${description}

  Scene: ${scene}.

  VISUAL REQUIREMENTS:
  - Natural daylight and warm, hopeful atmosphere.
  - Wide horizontal landscape composition.
  - Do not depict any identifiable real person.

  STRICTLY AVOID:
  - Any text, typography, letters, numbers or symbols.
  - Logos, watermarks, signs, labels or branded clothing.
  - Distressing, graphic or exploitative imagery.
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