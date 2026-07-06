/**
 * Unit tests for CoachChat component
 *
 * Tests:
 * - Bar link parsing and rendering
 * - Clickable bar links vs plain text for out-of-range
 * - Enter vs Shift+Enter keyboard handling
 * - Empty input validation
 * - Disabled state handling
 * - Thread rendering with streaming
 * - Error display inline
 * - Auto-scroll behavior
 */

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CoachChat from "@/src/components/CoachChat";

describe("CoachChat", () => {
  const defaultProps = {
    thread: [],
    isAsking: false,
    disabled: false,
    onAsk: jest.fn(),
    onBarClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render suggestion chips when thread is empty", () => {
    render(<CoachChat {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: "Why does bar 4 work?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What scale fits here?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "How would you play this?" }),
    ).toBeInTheDocument();
  });

  it("should call onAsk with chip text when a suggestion chip is clicked", async () => {
    const user = userEvent.setup();
    render(<CoachChat {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: "What scale fits here?" }),
    );

    expect(defaultProps.onAsk).toHaveBeenCalledWith("What scale fits here?");
  });

  it("should render thread entries without You/Coach labels", () => {
    const thread = [
      { question: "Why does bar 1 work?", answer: "It establishes the key." },
      { question: "What about bar 2?", answer: "It creates tension." },
    ];

    render(<CoachChat {...defaultProps} thread={thread} />);

    const question1 = screen.getByText("Why does bar 1 work?");
    const question2 = screen.getByText("What about bar 2?");
    expect(question1).toBeInTheDocument();
    expect(question2).toBeInTheDocument();
    expect(screen.getByText("It establishes the key.")).toBeInTheDocument();
    expect(screen.getByText("It creates tension.")).toBeInTheDocument();

    // No conversational labels — bubbles carry the meaning.
    expect(screen.queryByText("You")).not.toBeInTheDocument();
    expect(screen.queryByText("Coach")).not.toBeInTheDocument();

    // Questions render as right-aligned tinted bubbles.
    expect(question1).toHaveClass("bg-[var(--accent)]/10");
    expect(question1.parentElement).toHaveClass("items-end");

    // Suggestion chips disappear once the thread has entries.
    expect(
      screen.queryByRole("button", { name: "Why does bar 4 work?" }),
    ).not.toBeInTheDocument();
  });

  it("should render bar links as clickable buttons", () => {
    const thread = [
      {
        question: "Tell me about the progression",
        answer: "Check out [bar 4] and [bar 12] for the key changes.",
      },
    ];

    render(<CoachChat {...defaultProps} thread={thread} />);

    // Should NOT show the brackets in the rendered output
    expect(screen.queryByText("[bar 4]")).not.toBeInTheDocument();
    expect(screen.queryByText("[bar 12]")).not.toBeInTheDocument();

    // Should show clickable buttons with text "bar 4" and "bar 12"
    const bar4Button = screen.getByRole("button", { name: "bar 4" });
    const bar12Button = screen.getByRole("button", { name: "bar 12" });

    expect(bar4Button).toBeInTheDocument();
    expect(bar12Button).toBeInTheDocument();

    // Verify buttons have correct styling
    expect(bar4Button).toHaveClass("text-[var(--accent-strong)]");
    expect(bar12Button).toHaveClass("text-[var(--accent-strong)]");
  });

  it("should call onBarClick when bar link is clicked", () => {
    const thread = [
      {
        question: "Tell me",
        answer: "See [bar 5] for details.",
      },
    ];

    render(<CoachChat {...defaultProps} thread={thread} />);

    const bar5Button = screen.getByRole("button", { name: "bar 5" });
    fireEvent.click(bar5Button);

    expect(defaultProps.onBarClick).toHaveBeenCalledWith(5);
  });

  it("should handle multiple bar links in one answer", () => {
    const thread = [
      {
        question: "Complex question",
        answer:
          "Compare [bar 1], [bar 2], and [bar 3] to see the progression.",
      },
    ];

    render(<CoachChat {...defaultProps} thread={thread} />);

    expect(screen.getByRole("button", { name: "bar 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bar 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bar 3" })).toBeInTheDocument();
  });

  it("should render text around bar links correctly", () => {
    const thread = [
      {
        question: "Q",
        answer: "Start here [bar 1] then go to [bar 2] and finish.",
      },
    ];

    const { container } = render(
      <CoachChat {...defaultProps} thread={thread} />,
    );

    // Check that text fragments are present
    expect(container.textContent).toContain("Start here");
    expect(container.textContent).toContain("bar 1");
    expect(container.textContent).toContain("then go to");
    expect(container.textContent).toContain("bar 2");
    expect(container.textContent).toContain("and finish.");
  });

  it("should show error message inline", () => {
    const thread = [
      {
        question: "Test question",
        answer: "",
        error: "API key is invalid.",
      },
    ];

    render(<CoachChat {...defaultProps} thread={thread} />);

    const errorElement = screen.getByRole("alert");
    expect(errorElement).toHaveTextContent("API key is invalid.");
    expect(errorElement).toHaveClass("text-[var(--danger)]");
  });

  it("should show streaming indicator when isAsking is true", () => {
    const thread = [
      {
        question: "Streaming question",
        answer: "Partial answer",
      },
    ];

    render(<CoachChat {...defaultProps} thread={thread} isAsking={true} />);

    // Should show the streaming cursor/indicator
    const streamingIndicator = screen
      .getByText("Partial answer")
      .parentElement?.querySelector('[aria-hidden="true"]');
    expect(streamingIndicator).toBeInTheDocument();
    expect(streamingIndicator).toHaveClass("animate-pulse");
  });

  it("should show loading indicator when answer is empty and streaming", () => {
    const thread = [
      {
        question: "Loading question",
        answer: "",
      },
    ];

    render(<CoachChat {...defaultProps} thread={thread} isAsking={true} />);

    const loadingIndicator = screen.getByLabelText("Coach is typing");
    expect(loadingIndicator).toBeInTheDocument();
    expect(loadingIndicator).toHaveClass("animate-pulse");
  });

  it("should disable textarea when disabled prop is true", () => {
    render(<CoachChat {...defaultProps} disabled={true} />);

    const textarea = screen.getByLabelText(/ask the coach/i);
    expect(textarea).toBeDisabled();
  });

  it("should disable textarea when isAsking is true", () => {
    render(<CoachChat {...defaultProps} isAsking={true} />);

    const textarea = screen.getByLabelText(/ask the coach/i);
    expect(textarea).toBeDisabled();
  });

  it("should disable Send button when input is empty", () => {
    render(<CoachChat {...defaultProps} />);

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it("should enable Send button when input has text", async () => {
    const user = userEvent.setup();
    render(<CoachChat {...defaultProps} />);

    const textarea = screen.getByLabelText(/ask the coach/i);
    const sendButton = screen.getByRole("button", { name: /send/i });

    await user.type(textarea, "Test question");

    expect(sendButton).not.toBeDisabled();
  });

  it("should call onAsk when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(<CoachChat {...defaultProps} />);

    const textarea = screen.getByLabelText(/ask the coach/i);

    await user.type(textarea, "Test question{Enter}");

    expect(defaultProps.onAsk).toHaveBeenCalledWith("Test question");
  });

  it("should NOT call onAsk when Shift+Enter is pressed", async () => {
    const user = userEvent.setup();
    render(<CoachChat {...defaultProps} />);

    const textarea = screen.getByLabelText(/ask the coach/i);

    await user.type(textarea, "Test question{Shift>}{Enter}");

    expect(defaultProps.onAsk).not.toHaveBeenCalled();
  });

  it("should NOT call onAsk when input is empty", async () => {
    const user = userEvent.setup();
    render(<CoachChat {...defaultProps} />);

    const sendButton = screen.getByRole("button", { name: /send/i });

    await user.click(sendButton);

    expect(defaultProps.onAsk).not.toHaveBeenCalled();
  });

  it("should trim whitespace from question before calling onAsk", async () => {
    const user = userEvent.setup();
    render(<CoachChat {...defaultProps} />);

    const textarea = screen.getByLabelText(/ask the coach/i);
    const sendButton = screen.getByRole("button", { name: /send/i });

    await user.type(textarea, "  Test question  ");
    await user.click(sendButton);

    expect(defaultProps.onAsk).toHaveBeenCalledWith("Test question");
  });

  it("should clear input after sending question", async () => {
    const user = userEvent.setup();
    render(<CoachChat {...defaultProps} />);

    const textarea = screen.getByLabelText(/ask the coach/i);
    const sendButton = screen.getByRole("button", { name: /send/i });

    await user.type(textarea, "Test question");
    await user.click(sendButton);

    expect(textarea).toHaveValue("");
  });

  it("should limit input to MAX_QUESTION_LENGTH (500 chars)", async () => {
    const user = userEvent.setup();
    render(<CoachChat {...defaultProps} />);

    const textarea = screen.getByLabelText(/ask the coach/i) as HTMLTextAreaElement;

    const longText = "a".repeat(600);
    await user.type(textarea, longText);

    // Should be truncated to 500 characters
    expect(textarea.value.length).toBe(500);
  });

  it("should change Send button text to '…' when isAsking is true", () => {
    render(<CoachChat {...defaultProps} isAsking={true} />);

    const sendButton = screen.getByRole("button", { name: "…" });
    expect(sendButton).toBeInTheDocument();
  });

  it("should parse bar numbers correctly and ignore invalid patterns", () => {
    const thread = [
      {
        question: "Q",
        answer:
          "See [bar 4] but not [bar] or [bar abc] or [bar 4.5] or bar 10 without brackets.",
      },
    ];

    render(<CoachChat {...defaultProps} thread={thread} />);

    // Should only render button for valid [bar N] pattern
    expect(screen.getByRole("button", { name: "bar 4" })).toBeInTheDocument();

    // Invalid patterns should not be buttons
    expect(screen.queryByRole("button", { name: "bar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bar abc" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bar 4.5" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bar 10" })).not.toBeInTheDocument();
  });
});
