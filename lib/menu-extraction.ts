import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ExtractedMenuItem {
  name: string;
  price: number | null;
  description: string | null;
  allergens: string[];
  calories: number | null;
  category: string;
}

export interface ExtractedMenu {
  categories: Array<{
    name: string;
    items: ExtractedMenuItem[];
  }>;
  currency: string;
  confidence: "high" | "medium" | "low";
  notes: string;
}

export async function extractMenuFromImage(
  base64Image: string,
  mimeType: string
): Promise<ExtractedMenu> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as any,
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `You are a restaurant menu extraction expert.

Analyze this menu image and extract ALL menu items.

Return ONLY a valid JSON object with NO extra text, NO markdown, NO backticks.

Required format:
{
  "categories": [
    {
      "name": "Category Name",
      "items": [
        {
          "name": "Item Name",
          "price": 12.99,
          "description": "Description if visible or null",
          "allergens": ["gluten", "dairy"],
          "calories": 450,
          "category": "Category Name"
        }
      ]
    }
  ],
  "currency": "USD",
  "confidence": "high",
  "notes": "Any issues or observations"
}

Rules:
- price: number in dollars, null if not visible
- description: string or null
- allergens: array of strings, empty array if none mentioned
- calories: number or null
- confidence: "high" if clear, "medium" if some items unclear, "low" if very hard to read
- Group items into logical categories if none are explicit
- Include ALL visible items even if price is missing
- Handle handwritten, printed, digital screenshots, multiple languages
- If foreign language, translate to English`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function extractMenuFromPDF(base64PDF: string): Promise<ExtractedMenu> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64PDF,
            },
          },
          {
            type: "text",
            text: `Extract all menu items from this PDF menu.

Return ONLY valid JSON with NO extra text:
{
  "categories": [
    {
      "name": "Category Name",
      "items": [
        {
          "name": "Item Name",
          "price": 12.99,
          "description": "Description or null",
          "allergens": [],
          "calories": null,
          "category": "Category Name"
        }
      ]
    }
  ],
  "currency": "USD",
  "confidence": "high",
  "notes": ""
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateVoiceDescription(
  itemName: string,
  description: string | null,
  price: number
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Create a brief, appetizing voice description for a menu item that a restaurant AI assistant would say over the phone.

Item: ${itemName}
Description: ${description || "No description"}
Price: $${price}

Write ONE sentence, under 20 words, that sounds natural when spoken. No quotes needed.`,
      },
    ],
  });

  return response.content[0].type === "text"
    ? response.content[0].text.trim()
    : description || itemName;
}

export function validateExtractedMenu(menu: ExtractedMenu): {
  valid: boolean;
  warnings: string[];
  itemCount: number;
} {
  const warnings: string[] = [];
  let itemCount = 0;

  if (!menu.categories || menu.categories.length === 0) {
    return { valid: false, warnings: ["No categories found"], itemCount: 0 };
  }

  for (const category of menu.categories) {
    if (!category.items || category.items.length === 0) {
      warnings.push(`Category "${category.name}" has no items`);
      continue;
    }
    for (const item of category.items) {
      itemCount++;
      if (!item.price) warnings.push(`"${item.name}" has no price — please add manually`);
      if (!item.name) warnings.push("Found item with no name — skipping");
    }
  }

  return { valid: itemCount > 0, warnings, itemCount };
}
