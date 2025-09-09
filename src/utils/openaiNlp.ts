// src/utils/openaiNlp.ts

/**
 * Sends a transcript to OpenAI GPT for sell document data extraction.
 * Returns parsed JSON with keys: invoiceNumber, invoiceDate, customer, gstPct, items (array of {description, quantity, rate, amount}).
 *
 * Note: This function requires a valid OpenAI API key to be configured.
 * If no API key is available, it will throw an error that should be caught by the caller.
 */
export async function extractInvoiceDataWithNLP(
  transcript: string,
): Promise<any> {
  // Check if we have a valid API key configured
  const apiKey = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY';

  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY') {
    throw new Error(
      'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.',
    );
  }

  const prompt = `
Extract the following fields from this sell document text. 
Return ONLY valid JSON with these keys: 
- invoiceNumber (string)
- invoiceDate (YYYY-MM-DD format)
- customer (string)
- gstPct (number)
- items (array of objects: {description, quantity, rate, amount})

If a field is missing, omit it from the JSON. 
Do not include any explanation or extra text, only the JSON.

Text: """${transcript}"""
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a sell document data extraction assistant. Extract structured data from voice transcripts and return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${
          errorData.error?.message || 'Unknown error'
        }`,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response content from OpenAI API');
    }

    // Extract first JSON object from the response
    const match = content.match(/{[\s\S]*}/);
    if (!match) {
      throw new Error('No valid JSON found in model response');
    }

    try {
      const parsedData = JSON.parse(match[0]);

      // Validate the parsed data structure
      if (typeof parsedData !== 'object' || parsedData === null) {
        throw new Error('Invalid JSON structure returned');
      }

      // Ensure items array is properly formatted
      if (parsedData.items && Array.isArray(parsedData.items)) {
        parsedData.items = parsedData.items.map((item: any, index: number) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 1,
          rate: Number(item.rate) || 0,
          amount:
            Number(item.amount) ||
            (Number(item.quantity) || 1) * (Number(item.rate) || 0),
          id: String(index + 1),
        }));
      }

      return parsedData;
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse extracted invoice data: ${parseError.message}`,
      );
    }
  } catch (error: any) {
    // Re-throw with more context
    if (error.message.includes('API key not configured')) {
      throw error; // Re-throw as-is for configuration issues
    }
    throw new Error(`NLP extraction failed: ${error.message}`);
  }
}

/**
 * Check if NLP extraction is available (has valid API key)
 */
export function isNLPAvailable(): boolean {
  const apiKey = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY';
  return Boolean(apiKey && apiKey !== 'YOUR_OPENAI_API_KEY');
}
