/** The option shapes every rule shares, as JSON Schema for ESLint to check. */

export const entriesSchema = {
  type: 'array' as const,
  items: { type: 'string' as const, maxLength: 200 },
};

export const recognitionSchema = {
  componentImports: entriesSchema,
  ignoreImports: entriesSchema,
  mergeFunctions: entriesSchema,
  variantFunctions: entriesSchema,
  ui: {
    anyOf: [{ type: 'string' as const }, entriesSchema],
  },
};

export const messageSchema = {
  anyOf: [
    { type: 'string' as const, maxLength: 500 },
    {
      type: 'object' as const,
      additionalProperties: { type: 'string' as const, maxLength: 500 },
    },
  ],
};

export const contractsSchema = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    properties: {
      pattern: { type: 'string' as const },
      allow: entriesSchema,
      deny: entriesSchema,
      message: messageSchema,
    },
    required: ['pattern'],
    additionalProperties: false,
  },
};
