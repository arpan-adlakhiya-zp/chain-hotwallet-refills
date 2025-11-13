const validate = (data, schema) => {
  const errors = [];
  const parsed = {};

  function validateValue(value, schema, path = '') {
    if (schema.type === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`${path}: Expected object`);
        return null;
      }

      const result = {};

      // Handle required properties
      if (schema.required) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in value)) {
            errors.push(`${path}.${requiredProp}: Required property missing`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          const propPath = path ? `${path}.${prop}` : prop;

          if (prop in value) {
            const validatedValue = validateValue(value[prop], propSchema, propPath);
            if (validatedValue !== null) {
              result[prop] = validatedValue;
            }
          } else if (propSchema.default !== undefined) {
            result[prop] = propSchema.default;
          }
        }
      }

      return result;
    }

    if (schema.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${path}: Expected string`);
        return null;
      }
      return value;
    }

    if (schema.type === 'number') {
      if (typeof value !== 'number') {
        errors.push(`${path}: Expected number`);
        return null;
      }
      return value;
    }

    if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${path}: Expected boolean`);
        return null;
      }
      return value;
    }

    if (schema.enum) {
      if (!schema.enum.includes(value)) {
        errors.push(`${path}: Expected one of [${schema.enum.join(', ')}]`);
        return null;
      }
      return value;
    }

    return value;
  }

  const result = validateValue(data, schema);

  return {
    status: errors.length === 0,
    errors,
    parsed: result
  };
};

module.exports = validate;
