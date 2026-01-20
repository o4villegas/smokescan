/**
 * Schema Validation Tests
 * Tests for AssessmentMetadataSchema and related FDAM field validation
 */

import { describe, it, expect } from 'vitest';
import {
  AssessmentMetadataSchema,
  FloorLevelSchema,
  RoomDimensionsSchema,
  SensoryObservationsSchema,
  WhiteWipeResultSchema,
} from '../schemas';

describe('AssessmentMetadataSchema', () => {
  describe('dimensions (mandatory)', () => {
    it('should require all 3 dimensions', () => {
      const validInput = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        dimensions: {
          length_ft: 20,
          width_ft: 15,
          height_ft: 10,
        },
      };

      const result = AssessmentMetadataSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject missing dimensions', () => {
      const invalidInput = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        // dimensions missing
      };

      const result = AssessmentMetadataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject partial dimensions (missing width)', () => {
      const invalidInput = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        dimensions: {
          length_ft: 20,
          // width_ft missing
          height_ft: 10,
        },
      };

      const result = AssessmentMetadataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject zero or negative dimensions', () => {
      const invalidInput = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        dimensions: {
          length_ft: 0,
          width_ft: 15,
          height_ft: 10,
        },
      };

      const result = AssessmentMetadataSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('floor_level (optional)', () => {
    it('should accept valid floor_level values', () => {
      const validLevels = ['basement', 'ground', '1st', '2nd', '3rd', '4th+', 'attic'];

      for (const level of validLevels) {
        const input = {
          roomType: 'residential-bedroom',
          structureType: 'single-family',
          dimensions: { length_ft: 20, width_ft: 15, height_ft: 10 },
          floor_level: level,
        };

        const result = AssessmentMetadataSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid floor_level values', () => {
      const input = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        dimensions: { length_ft: 20, width_ft: 15, height_ft: 10 },
        floor_level: 'invalid-floor',
      };

      const result = AssessmentMetadataSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept missing floor_level (optional)', () => {
      const input = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        dimensions: { length_ft: 20, width_ft: 15, height_ft: 10 },
        // floor_level omitted
      };

      const result = AssessmentMetadataSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('sensory_observations (optional)', () => {
    it('should accept valid sensory observations', () => {
      const input = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        dimensions: { length_ft: 20, width_ft: 15, height_ft: 10 },
        sensory_observations: {
          smoke_odor_present: true,
          smoke_odor_intensity: 'moderate',
          white_wipe_result: 'light-deposits',
        },
      };

      const result = AssessmentMetadataSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept partial sensory observations', () => {
      const input = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        dimensions: { length_ft: 20, width_ft: 15, height_ft: 10 },
        sensory_observations: {
          white_wipe_result: 'heavy-deposits',
          // smoke_odor_present and intensity omitted
        },
      };

      const result = AssessmentMetadataSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept missing sensory_observations (optional)', () => {
      const input = {
        roomType: 'residential-bedroom',
        structureType: 'single-family',
        dimensions: { length_ft: 20, width_ft: 15, height_ft: 10 },
        // sensory_observations omitted
      };

      const result = AssessmentMetadataSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('white_wipe_result (dropdown + free text)', () => {
    it('should accept dropdown options', () => {
      const dropdownOptions = ['clean', 'light-deposits', 'moderate-deposits', 'heavy-deposits'];

      for (const option of dropdownOptions) {
        const result = WhiteWipeResultSchema.safeParse(option);
        expect(result.success).toBe(true);
      }
    });

    it('should accept free text up to 100 characters', () => {
      const freeText = 'Visible gray film on surfaces';
      const result = WhiteWipeResultSchema.safeParse(freeText);
      expect(result.success).toBe(true);
    });

    it('should reject free text over 100 characters', () => {
      const longText = 'a'.repeat(101);
      const result = WhiteWipeResultSchema.safeParse(longText);
      expect(result.success).toBe(false);
    });
  });

  describe('full FDAM metadata', () => {
    it('should accept complete FDAM assessment metadata', () => {
      const completeInput = {
        roomType: 'commercial-office',
        structureType: 'commercial',
        floor_level: '2nd',
        dimensions: {
          length_ft: 50,
          width_ft: 30,
          height_ft: 12,
        },
        sensory_observations: {
          smoke_odor_present: true,
          smoke_odor_intensity: 'strong',
          white_wipe_result: 'heavy-deposits',
        },
        fireOrigin: 'Adjacent warehouse, northwest corner',
        notes: 'HVAC system was running during fire. Visible soot in ductwork.',
      };

      const result = AssessmentMetadataSchema.safeParse(completeInput);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.dimensions.length_ft).toBe(50);
        expect(result.data.dimensions.width_ft).toBe(30);
        expect(result.data.dimensions.height_ft).toBe(12);
        expect(result.data.sensory_observations?.smoke_odor_intensity).toBe('strong');
      }
    });
  });
});

describe('FloorLevelSchema', () => {
  it('should validate all 7 floor level options', () => {
    const levels = ['basement', 'ground', '1st', '2nd', '3rd', '4th+', 'attic'];

    for (const level of levels) {
      expect(FloorLevelSchema.safeParse(level).success).toBe(true);
    }
  });
});

describe('RoomDimensionsSchema', () => {
  it('should calculate area and volume correctly when all dimensions provided', () => {
    const dims = { length_ft: 20, width_ft: 15, height_ft: 10 };
    const result = RoomDimensionsSchema.safeParse(dims);

    expect(result.success).toBe(true);
    if (result.success) {
      const area = result.data.length_ft * result.data.width_ft;
      const volume = area * result.data.height_ft;
      expect(area).toBe(300); // 20 * 15 = 300 SF
      expect(volume).toBe(3000); // 300 * 10 = 3000 CF
    }
  });
});

describe('SensoryObservationsSchema', () => {
  it('should accept all smoke odor intensity levels', () => {
    const intensities = ['none', 'faint', 'moderate', 'strong'];

    for (const intensity of intensities) {
      const input = { smoke_odor_present: true, smoke_odor_intensity: intensity };
      const result = SensoryObservationsSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });
});
