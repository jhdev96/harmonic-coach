/**
 * Unit tests for /api/ask route validation (parseAskRequest)
 *
 * Tests:
 * - Valid request parsing
 * - Question validation (empty, too long)
 * - History validation (array, entry structure, length)
 * - Measures validation (count, structure)
 * - History capping to last 6 entries
 * - Optional fields (overview, breakdowns, selectedMeasureIndex)
 * - Required field validation
 * - Type validation for all fields
 */

import type { AskCoachRequest } from "@/src/lib/types";
import { parseAskRequest } from "@/src/lib/parseAskRequest";


describe("API /api/ask - parseAskRequest validation", () => {
  const validRequest: AskCoachRequest = {
    title: "Test Song",
    songKey: "C major",
    timeSignature: "4/4",
    measures: [
      { index: 0, chords: "Cmaj7" },
      { index: 1, chords: "Am7" },
    ],
    history: [],
    question: "Why does this work?",
  };

  describe("Valid requests", () => {
    it("should accept a minimal valid request", () => {
      const result = parseAskRequest(validRequest, 500, 64, 6);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.question).toBe("Why does this work?");
    });

    it("should accept request with optional fields", () => {
      const requestWithOptionals = {
        ...validRequest,
        overview: "This is a great progression.",
        breakdowns: [
          {
            measureIndex: 0,
            chords: "Cmaj7",
            title: "Tonic",
            romanNumeral: "I",
            explanation: "Establishes the key.",
          },
        ],
        selectedMeasureIndex: 0,
      };

      const result = parseAskRequest(requestWithOptionals, 500, 64, 6);

      expect(result.error).toBeUndefined();
      expect(result.data?.overview).toBe("This is a great progression.");
      expect(result.data?.breakdowns).toHaveLength(1);
      expect(result.data?.selectedMeasureIndex).toBe(0);
    });

    it("should trim question whitespace", () => {
      const request = {
        ...validRequest,
        question: "  Why does this work?  ",
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.data?.question).toBe("Why does this work?");
    });

    it("should accept up to 64 measures", () => {
      const measures = Array.from({ length: 64 }, (_, i) => ({
        index: i,
        chords: `Chord${i}`,
      }));

      const request = {
        ...validRequest,
        measures,
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBeUndefined();
      expect(result.data?.measures).toHaveLength(64);
    });
  });

  describe("Question validation", () => {
    it("should reject empty question", () => {
      const request = {
        ...validRequest,
        question: "",
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("question is required.");
      expect(result.data).toBeUndefined();
    });

    it("should reject whitespace-only question", () => {
      const request = {
        ...validRequest,
        question: "   ",
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("question is required.");
    });

    it("should reject question longer than 500 characters", () => {
      const request = {
        ...validRequest,
        question: "a".repeat(501),
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("question must be 500 characters or fewer.");
    });

    it("should accept question exactly 500 characters", () => {
      const request = {
        ...validRequest,
        question: "a".repeat(500),
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBeUndefined();
    });

    it("should reject non-string question", () => {
      const request = {
        ...validRequest,
        question: 123 as unknown,
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("question is required.");
    });
  });

  describe("History validation", () => {
    it("should accept empty history array", () => {
      const request = {
        ...validRequest,
        history: [],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBeUndefined();
      expect(result.data?.history).toEqual([]);
    });

    it("should accept valid history entries", () => {
      const request = {
        ...validRequest,
        history: [
          { question: "Q1", answer: "A1" },
          { question: "Q2", answer: "A2" },
        ],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBeUndefined();
      expect(result.data?.history).toHaveLength(2);
    });

    it("should reject non-array history", () => {
      const request = {
        ...validRequest,
        history: "not an array" as unknown,
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("history must be an array.");
    });

    it("should reject history entry with missing question", () => {
      const request = {
        ...validRequest,
        history: [{ answer: "A1" } as unknown],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toContain("Each history entry must have");
    });

    it("should reject history entry with missing answer", () => {
      const request = {
        ...validRequest,
        history: [{ question: "Q1" } as unknown],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toContain("Each history entry must have");
    });

    it("should reject history entry with question exceeding 2000 chars", () => {
      const request = {
        ...validRequest,
        history: [{ question: "a".repeat(2001), answer: "A1" }],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toContain("≤ 2000 chars");
    });

    it("should reject history entry with answer exceeding 2000 chars", () => {
      const request = {
        ...validRequest,
        history: [{ question: "Q1", answer: "a".repeat(2001) }],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toContain("≤ 2000 chars");
    });

    it("should cap history to last 6 entries", () => {
      const request = {
        ...validRequest,
        history: Array.from({ length: 10 }, (_, i) => ({
          question: `Q${i}`,
          answer: `A${i}`,
        })),
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBeUndefined();
      expect(result.data?.history).toHaveLength(6);
      // Should keep the last 6 (indices 4-9)
      expect(result.data?.history[0].question).toBe("Q4");
      expect(result.data?.history[5].question).toBe("Q9");
    });
  });

  describe("Measures validation", () => {
    it("should reject empty measures array", () => {
      const requestWithEmptyMeasures = {
        ...validRequest,
        measures: [],
      };

      const result = parseAskRequest(requestWithEmptyMeasures, 500, 64, 6);

      expect(result.error).toBe("Expected 1–64 measures.");
    });

    it("should reject more than 64 measures", () => {
      const request = {
        ...validRequest,
        measures: Array.from({ length: 65 }, (_, i) => ({
          index: i,
          chords: `Chord${i}`,
        })),
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("Expected 1–64 measures.");
    });

    it("should reject non-array measures", () => {
      const request = {
        ...validRequest,
        measures: "not an array" as unknown,
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("Expected 1–64 measures.");
    });

    it("should reject measure with missing index", () => {
      const request = {
        ...validRequest,
        measures: [{ chords: "Cmaj7" } as unknown],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe(
        "Each measure must have a numeric index and string chords.",
      );
    });

    it("should reject measure with missing chords", () => {
      const request = {
        ...validRequest,
        measures: [{ index: 0 } as unknown],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe(
        "Each measure must have a numeric index and string chords.",
      );
    });

    it("should reject measure with non-numeric index", () => {
      const request = {
        ...validRequest,
        measures: [{ index: "0", chords: "Cmaj7" } as unknown],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe(
        "Each measure must have a numeric index and string chords.",
      );
    });

    it("should reject measure with non-string chords", () => {
      const request = {
        ...validRequest,
        measures: [{ index: 0, chords: 123 } as unknown],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe(
        "Each measure must have a numeric index and string chords.",
      );
    });
  });

  describe("Required fields validation", () => {
    it("should reject missing title", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { title, ...request } = validRequest;

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe(
        "title, songKey, and timeSignature must be strings.",
      );
    });

    it("should reject missing songKey", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { songKey, ...request } = validRequest;

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe(
        "title, songKey, and timeSignature must be strings.",
      );
    });

    it("should reject missing timeSignature", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timeSignature, ...request } = validRequest;

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe(
        "title, songKey, and timeSignature must be strings.",
      );
    });

    it("should reject null body", () => {
      const result = parseAskRequest(null, 500, 64, 6);

      expect(result.error).toBe("Request body must be a JSON object.");
    });

    it("should reject non-object body", () => {
      const result = parseAskRequest("not an object", 500, 64, 6);

      expect(result.error).toBe("Request body must be a JSON object.");
    });
  });

  describe("Optional fields validation", () => {
    it("should reject non-string overview", () => {
      const request = {
        ...validRequest,
        overview: 123 as unknown,
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("overview must be a string when present.");
    });

    it("should reject non-array breakdowns", () => {
      const request = {
        ...validRequest,
        breakdowns: "not an array" as unknown,
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("breakdowns must be an array when present.");
    });

    it("should reject breakdown with invalid structure", () => {
      const request = {
        ...validRequest,
        breakdowns: [
          {
            measureIndex: 0,
            chords: "Cmaj7",
            title: "Tonic",
            // missing romanNumeral and explanation
          } as unknown,
        ],
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe("breakdowns entries have the wrong shape.");
    });

    it("should reject non-number selectedMeasureIndex", () => {
      const request = {
        ...validRequest,
        selectedMeasureIndex: "0" as unknown,
      };

      const result = parseAskRequest(request, 500, 64, 6);

      expect(result.error).toBe(
        "selectedMeasureIndex must be a number when present.",
      );
    });
  });
});
