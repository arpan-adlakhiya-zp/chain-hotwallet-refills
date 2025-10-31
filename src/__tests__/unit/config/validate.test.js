const validate = require('../../../config/validate');

describe('Config Validator', () => {
  describe('Object type validation', () => {
    it('should validate required properties', () => {
      const schema = {
        type: 'object',
        properties: { 
          name: { type: 'string' } 
        },
        required: ['name']
      };
      
      const result = validate({}, schema);
      
      expect(result.status).toBe(false);
      expect(result.errors).toContain('.name: Required property missing');
    });

    it('should pass when all required properties are present', () => {
      const schema = {
        type: 'object',
        properties: { 
          name: { type: 'string' } 
        },
        required: ['name']
      };
      
      const result = validate({ name: 'test' }, schema);
      
      expect(result.status).toBe(true);
      expect(result.parsed.name).toBe('test');
    });

    it('should apply default values for missing optional properties', () => {
      const schema = {
        type: 'object',
        properties: { 
          port: { type: 'number', default: 3000 },
          name: { type: 'string' }
        }
      };
      
      const result = validate({ name: 'test' }, schema);
      
      expect(result.status).toBe(true);
      expect(result.parsed.port).toBe(3000);
      expect(result.parsed.name).toBe('test');
    });

    it('should reject non-object values', () => {
      const schema = { type: 'object', properties: {} };
      
      const result = validate('not an object', schema);
      
      expect(result.status).toBe(false);
      expect(result.errors).toContain(': Expected object');
    });

    it('should reject arrays when expecting object', () => {
      const schema = { type: 'object', properties: {} };
      
      const result = validate([1, 2, 3], schema);
      
      expect(result.status).toBe(false);
    });

    it('should reject null when expecting object', () => {
      const schema = { type: 'object', properties: {} };
      
      const result = validate(null, schema);
      
      expect(result.status).toBe(false);
    });
  });

  describe('String type validation', () => {
    it('should validate string values', () => {
      const schema = { type: 'string' };
      
      const result = validate('hello', schema);
      
      expect(result.status).toBe(true);
      expect(result.parsed).toBe('hello');
    });

    it('should reject non-string values', () => {
      const schema = { type: 'string' };
      
      const result = validate(123, schema);
      
      expect(result.status).toBe(false);
      expect(result.errors).toContain(': Expected string');
    });
  });

  describe('Number type validation', () => {
    it('should validate number values', () => {
      const schema = { type: 'number' };
      
      const result = validate(42, schema);
      
      expect(result.status).toBe(true);
      expect(result.parsed).toBe(42);
    });

    it('should reject non-number values', () => {
      const schema = { type: 'number' };
      
      const result = validate('42', schema);
      
      expect(result.status).toBe(false);
      expect(result.errors).toContain(': Expected number');
    });
  });

  describe('Boolean type validation', () => {
    it('should validate boolean values', () => {
      const schema = { type: 'boolean' };
      
      const result = validate(true, schema);
      
      expect(result.status).toBe(true);
      expect(result.parsed).toBe(true);
    });

    it('should reject non-boolean values', () => {
      const schema = { type: 'boolean' };
      
      const result = validate(1, schema);
      
      expect(result.status).toBe(false);
      expect(result.errors).toContain(': Expected boolean');
    });
  });

  describe('Enum validation', () => {
    it('should validate enum values', () => {
      const schema = { enum: ['dev', 'prod', 'staging'] };
      
      const result = validate('prod', schema);
      
      expect(result.status).toBe(true);
      expect(result.parsed).toBe('prod');
    });

    it('should reject values not in enum', () => {
      const schema = { enum: ['dev', 'prod'] };
      
      const result = validate('staging', schema);
      
      expect(result.status).toBe(false);
      expect(result.errors[0]).toContain('Expected one of [dev, prod]');
    });
  });

  describe('Nested object validation', () => {
    it('should validate nested objects with required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          server: {
            type: 'object',
            properties: {
              port: { type: 'number' },
              host: { type: 'string' }
            },
            required: ['port', 'host']
          }
        },
        required: ['server']
      };
      
      const result = validate({
        server: {
          port: 3000,
          host: 'localhost'
        }
      }, schema);
      
      expect(result.status).toBe(true);
      expect(result.parsed.server.port).toBe(3000);
      expect(result.parsed.server.host).toBe('localhost');
    });

    it('should fail when nested required fields are missing', () => {
      const schema = {
        type: 'object',
        properties: {
          server: {
            type: 'object',
            properties: {
              port: { type: 'number' }
            },
            required: ['port']
          }
        }
      };
      
      const result = validate({ server: {} }, schema);
      
      expect(result.status).toBe(false);
      expect(result.errors).toContain('server.port: Required property missing');
    });
  });
});

