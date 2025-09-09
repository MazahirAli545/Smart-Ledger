// src/utils/voiceParser.ts
import { wordsToNumbers } from 'words-to-numbers';

export interface InvoiceItemSetter {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceFieldSetters {
  setInvoiceNumber: (val: string) => void;
  setSelectedCustomer: (val: string) => void;
  setGstPct: (val: number) => void;
  setInvoiceDate: (val: string) => void;
  setNotes: (val: string) => void;
  setItems: (val: InvoiceItemSetter[]) => void;
  setDescription: (val: string) => void;
  currentItems?: InvoiceItemSetter[]; // Add current items for fallback
}

/**
 * Parses recognized voice text and fills sell document fields using the provided setters.
 * Supports sell document number, customer, GST, date, notes, items, and description.
 * Returns an array of { itemIndex, field } for each field updated by voice.
 */
export function parseInvoiceVoiceText(
  text: string,
  setters: InvoiceFieldSetters,
): Array<{ itemIndex: number; field: string }> {
  const {
    setInvoiceNumber,
    setSelectedCustomer,
    setGstPct,
    setInvoiceDate,
    setNotes,
    setItems,
    setDescription,
    currentItems = [],
  } = setters;
  // Convert number words to numbers for easier extraction
  let normalizedRaw = wordsToNumbers(text);
  let normalized =
    typeof normalizedRaw === 'string' ? normalizedRaw : String(normalizedRaw);
  const updatedFields: Array<{ itemIndex: number; field: string }> = [];

  // --- Sell Document Number: allow spoken digits and words ---
  // e.g., 'sell number nine eight seven six' or 'sell number 9876'
  let invoiceMatch = normalized.match(
    /(?:invoice|sell)\s*number\s*([\w\s-]+)/i,
  );
  if (invoiceMatch) {
    // Remove spaces and hyphens for spoken numbers
    let num = invoiceMatch[1].replace(/\s|-/g, '');
    setInvoiceNumber(num);
    updatedFields.push({ itemIndex: -1, field: 'invoiceNumber' });
  }

  // --- Customer ---
  let customerMatch = normalized.match(/customer\s*([\w\s]+)/i);
  if (customerMatch) {
    setSelectedCustomer(customerMatch[1].trim());
    updatedFields.push({ itemIndex: -1, field: 'customer' });
  }

  // --- GST: match 'gst', 'gst percent', 'gst is', 'five percent', etc. ---
  let gstMatch = normalized.match(
    /gst(?: percent| is|:)?\s*(\d+)(?:%| percent)?/i,
  );
  if (!gstMatch) {
    // Try to match 'five percent', 'eighteen percent', etc.
    let gstWordMatch = normalized.match(
      /gst(?: percent| is|:)?\s*([a-z\s]+)percent/i,
    );
    if (gstWordMatch) {
      let gstNum = wordsToNumbers(gstWordMatch[1]);
      if (typeof gstNum === 'number') gstMatch = ['', String(gstNum)];
    }
  }
  if (gstMatch && gstMatch[1]) {
    const allowedGst = [0, 5, 12, 18, 28];
    const gstValue = Number(gstMatch[1]);
    if (allowedGst.includes(gstValue)) {
      setGstPct(gstValue);
      updatedFields.push({ itemIndex: -1, field: 'gstPct' });
    }
  }

  // Enhanced date parser for better voice recognition
  function parseSimpleDate(dateStr: string): string | null {
    const months = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];

    let str = dateStr.trim().toLowerCase();

    // Try YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const [_, y, m, d] = isoMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Try 'July 15, 2025' or '15 July 2025'
    const monthRegex = months.join('|');

    // Pattern: "July 15, 2025" or "July 15 2025"
    let match = str.match(
      new RegExp(`(${monthRegex})[\s,]*(\d{1,2})[\s,]*(\d{4})`),
    );
    if (match) {
      const [, month, day, year] = match;
      const mIdx = months.indexOf(month);
      if (mIdx >= 0) {
        return `${year}-${String(mIdx + 1).padStart(2, '0')}-${day.padStart(
          2,
          '0',
        )}`;
      }
    }

    // Pattern: "15 July 2025" or "15th July 2025"
    match = str.match(
      new RegExp(`(\d{1,2})(?:st|nd|rd|th)?[\s,]*(${monthRegex})[\s,]*(\d{4})`),
    );
    if (match) {
      const [, day, month, year] = match;
      const mIdx = months.indexOf(month);
      if (mIdx >= 0) {
        return `${year}-${String(mIdx + 1).padStart(2, '0')}-${day.padStart(
          2,
          '0',
        )}`;
      }
    }

    // Pattern: "15th of July 2025"
    match = str.match(
      new RegExp(
        `(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(${monthRegex})[\s,]*(\d{4})`,
      ),
    );
    if (match) {
      const [, day, month, year] = match;
      const mIdx = months.indexOf(month);
      if (mIdx >= 0) {
        return `${year}-${String(mIdx + 1).padStart(2, '0')}-${day.padStart(
          2,
          '0',
        )}`;
      }
    }

    return null;
  }

  // --- Enhanced Date parsing: match various date formats ---
  let dateMatch =
    normalized.match(/(?:(?:invoice|sell) )?date(?: is|:)?\s*([\w\s,\/-]+)/i) ||
    normalized.match(/dated\s*([\w\s,\/-]+)/i) ||
    normalized.match(/date\s*([\w\s,\/-]+)/i);

  if (dateMatch && dateMatch[1]) {
    let iso = parseSimpleDate(dateMatch[1]);
    if (iso) {
      setInvoiceDate(iso);
      updatedFields.push({ itemIndex: -1, field: 'invoiceDate' });
    }
  }

  // --- Remove Item functionality ---
  const removeItemMatch = normalized.match(
    /remove\s+(?:item\s+)?(\d+|one|two|three|four|five|all|everything)/i,
  );
  if (removeItemMatch) {
    const itemToRemove = removeItemMatch[1].toLowerCase();

    if (itemToRemove === 'all' || itemToRemove === 'everything') {
      // Remove all items except the first one
      const newItems =
        currentItems.length > 1 ? [currentItems[0]] : currentItems;
      setItems(newItems);
      updatedFields.push({ itemIndex: -1, field: 'removeAll' });
    } else {
      // Remove specific item
      let itemIdx = 0;
      if (/^\d+$/.test(itemToRemove)) {
        itemIdx = parseInt(itemToRemove, 10) - 1;
      } else {
        const wordToNum: Record<string, number> = {
          one: 1,
          two: 2,
          three: 3,
          four: 4,
          five: 5,
        };
        itemIdx = wordToNum[itemToRemove] ? wordToNum[itemToRemove] - 1 : 0;
      }

      if (
        itemIdx >= 0 &&
        itemIdx < currentItems.length &&
        currentItems.length > 1
      ) {
        const newItems = currentItems.filter((_, index) => index !== itemIdx);
        setItems(newItems);
        updatedFields.push({ itemIndex: itemIdx, field: 'removeItem' });
      }
    }
  }

  // --- Notes ---
  let notesMatch = normalized.match(
    /(?:additional )?notes?\s*[:\-]?\s*([\w\s]+)/i,
  );
  if (notesMatch) {
    setNotes(notesMatch[1].trim());
    updatedFields.push({ itemIndex: -1, field: 'notes' });
  }

  // --- Enhanced Items parsing: better extraction of description, quantity, rate ---
  // Pattern 1: "item one description laptop charger quantity 10 rate 50"
  const itemRegex1 =
    /item\s*(\d+|one|two|three|four|five)\s*(?:description\s*([^,;]+?)(?:\s+quantity\s*(\d+))?(?:\s+rate\s*(\d+))?)/gi;

  // Pattern 2: "item one quantity 10 rate 50 description laptop charger"
  const itemRegex2 =
    /item\s*(\d+|one|two|three|four|five)\s*(?:quantity\s*(\d+))?(?:\s+rate\s*(\d+))?(?:\s+description\s*([^,;]+?))?/gi;

  // Pattern 3: "item one description laptop charger rate 50 quantity 10"
  const itemRegex3 =
    /item\s*(\d+|one|two|three|four|five)\s*(?:description\s*([^,;]+?)(?:\s+rate\s*(\d+))?(?:\s+quantity\s*(\d+))?)/gi;

  let foundItems = false;
  let updatedItems = [...currentItems];

  // Try all patterns
  const patterns = [itemRegex1, itemRegex2, itemRegex3];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      foundItems = true;

      let itemNumRaw = match[1].toString().toLowerCase();
      let itemIdx = 0;

      if (/^\d+$/.test(itemNumRaw)) {
        itemIdx = Math.max(0, parseInt(itemNumRaw, 10) - 1);
      } else {
        const wordToNum: Record<string, number> = {
          one: 1,
          two: 2,
          three: 3,
          four: 4,
          five: 5,
        };
        itemIdx = wordToNum[itemNumRaw] ? wordToNum[itemNumRaw] - 1 : 0;
      }

      // Extract values based on pattern
      let desc = '',
        qty = '',
        rate = '';

      if (pattern === itemRegex1) {
        // Pattern 1: description first, then quantity, then rate
        desc = match[2] || '';
        qty = match[3] || '';
        rate = match[4] || '';
      } else if (pattern === itemRegex2) {
        // Pattern 2: quantity first, then rate, then description
        qty = match[2] || '';
        rate = match[3] || '';
        desc = match[4] || '';
      } else if (pattern === itemRegex3) {
        // Pattern 3: description first, then rate, then quantity
        desc = match[2] || '';
        rate = match[3] || '';
        qty = match[4] || '';
      }

      // Create or update item
      let baseItem: InvoiceItemSetter = updatedItems[itemIdx] || {
        id: (itemIdx + 1).toString(),
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
      };

      // Track which fields were updated
      if (desc)
        updatedFields.push({ itemIndex: itemIdx, field: 'description' });
      if (qty) updatedFields.push({ itemIndex: itemIdx, field: 'quantity' });
      if (rate) updatedFields.push({ itemIndex: itemIdx, field: 'rate' });

      // Calculate amount if both quantity and rate are provided
      let newAmount = baseItem.amount;
      let newQty = qty ? Number(qty) : baseItem.quantity;
      let newRate = rate ? Number(rate) : baseItem.rate;

      if (newQty > 0 && newRate > 0) {
        newAmount = newQty * newRate;
      }

      updatedItems[itemIdx] = {
        ...baseItem,
        description: desc ? desc.trim() : baseItem.description,
        quantity: newQty,
        rate: newRate,
        amount: newAmount,
      };
    }
  }

  // If no items found with patterns, try fallback parsing
  if (!foundItems) {
    // Fallback: try to extract individual item fields
    const desc =
      (normalized.match(/description\s*([^,;]+?)(?=\s+(?:quantity|rate|$))/i) ||
        [])[1] || '';
    const qty = (normalized.match(/quantity\s*(\d+)/i) || [])[1] || '';
    const rate = (normalized.match(/rate\s*(\d+)/i) || [])[1] || '';

    if (desc || qty || rate) {
      if (desc) updatedFields.push({ itemIndex: 0, field: 'description' });
      if (qty) updatedFields.push({ itemIndex: 0, field: 'quantity' });
      if (rate) updatedFields.push({ itemIndex: 0, field: 'rate' });

      let newAmount = 0;
      let newQty = qty ? Number(qty) : currentItems[0]?.quantity || 1;
      let newRate = rate ? Number(rate) : currentItems[0]?.rate || 0;

      if (newQty > 0 && newRate > 0) {
        newAmount = newQty * newRate;
      }

      setItems(
        currentItems.map((it, idx) =>
          idx === 0
            ? {
                ...it,
                description: desc ? desc.trim() : it.description,
                quantity: newQty,
                rate: newRate,
                amount: newAmount,
              }
            : it,
        ),
      );
    }
  } else {
    // Update items if we found matches
    updatedItems = updatedItems.filter(Boolean);
    setItems(updatedItems);
  }

  // --- Description (not part of items) ---
  const descMatch = normalized.match(
    /(?:^|,|;)?\s*description\s*([\w\s]+?)(?=,|;|$)/i,
  );
  if (descMatch && updatedItems.length === 0) {
    setDescription(descMatch[1].trim());
    updatedFields.push({ itemIndex: -1, field: 'description' });
  }

  return updatedFields;
}
