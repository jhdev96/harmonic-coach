/**
 * Unit tests for askCoach.ts streaming client library
 *
 * Tests:
 * - Successful streaming with progress callbacks
 * - Error handling for non-OK responses
 * - Abort signal handling
 * - Empty response body handling
 * - Proper text decoding (streaming and final flush)
 */

import { streamCoachAnswer } from "@/src/lib/askCoach";
import type { AskCoachRequest } from "@/src/lib/types";

describe("askCoach", () => {
  describe("streamCoachAnswer", () => {
    const mockRequest: AskCoachRequest = {
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

    beforeEach(() => {
      // Mock fetch
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should stream answer text and call onProgress with accumulated text", async () => {
      const chunks = ["Hello ", "from ", "the ", "coach!"];
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunks[0]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunks[1]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunks[2]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(chunks[3]),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const progressCalls: string[] = [];
      const onProgress = jest.fn((text: string) => progressCalls.push(text));

      const result = await streamCoachAnswer(mockRequest, onProgress);

      expect(result).toBe("Hello from the coach!");
      expect(progressCalls).toEqual([
        "Hello ",
        "Hello from ",
        "Hello from the ",
        "Hello from the coach!",
        "Hello from the coach!", // Final flush call
      ]);
      expect(onProgress).toHaveBeenCalledTimes(5);
    });

    it("should throw error for non-OK HTTP response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest
          .fn()
          .mockResolvedValueOnce({ error: "API key is invalid." }),
      });

      const onProgress = jest.fn();

      await expect(
        streamCoachAnswer(mockRequest, onProgress),
      ).rejects.toThrow("API key is invalid.");
    });

    it("should throw generic error when response has no error field", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({}),
      });

      const onProgress = jest.fn();

      await expect(
        streamCoachAnswer(mockRequest, onProgress),
      ).rejects.toThrow("Coach request failed (HTTP 500).");
    });

    it("should throw error when response has no body", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const onProgress = jest.fn();

      await expect(
        streamCoachAnswer(mockRequest, onProgress),
      ).rejects.toThrow("The coach response had no body.");
    });

    it("should pass abort signal to fetch", async () => {
      const mockReader = {
        read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const controller = new AbortController();
      const onProgress = jest.fn();

      await streamCoachAnswer(mockRequest, onProgress, controller.signal);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ask",
        expect.objectContaining({
          signal: controller.signal,
        }),
      );
    });

    it("should throw AbortError when signal is aborted mid-stream", async () => {
      const controller = new AbortController();

      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode("Partial "),
          })
          .mockImplementationOnce(() => {
            controller.abort();
            return Promise.reject(new DOMException("Aborted", "AbortError"));
          }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const onProgress = jest.fn();

      await expect(
        streamCoachAnswer(mockRequest, onProgress, controller.signal),
      ).rejects.toThrow();

      // Verify partial progress was reported before abort
      expect(onProgress).toHaveBeenCalledWith("Partial ");
    });

    it("should handle text decoding correctly with final flush", async () => {
      // Test that decoder.decode() is called without {stream: true} for final flush
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode("Test"),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const progressCalls: string[] = [];
      const onProgress = jest.fn((text: string) => progressCalls.push(text));

      const result = await streamCoachAnswer(mockRequest, onProgress);

      expect(result).toBe("Test");
      // Should call onProgress twice: once during stream, once for final flush
      expect(progressCalls).toEqual(["Test", "Test"]);
    });
  });
});
