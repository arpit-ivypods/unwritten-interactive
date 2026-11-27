// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Subtitles } from "./Stage";

describe("Subtitles", () => {
  it("draws a word with breakBefore on a new line and keeps the highlight on whole words", () => {
    const words = [
      { text: "मेरा" },
      { text: "भाई," },
      { text: "मोहित।" },
      { text: "मौसी", breakBefore: true },
      { text: "ने" },
    ];
    const { container } = render(<Subtitles words={words} activeWord={3} lang="hi" />);
    const line = container.querySelector(".uw-sub-line")!;
    expect(line.querySelectorAll("br")).toHaveLength(1);
    // The break sits right before the fourth word, and replaces the space there.
    const spans = line.querySelectorAll(":scope > span");
    expect(spans[3].firstChild?.nodeName).toBe("BR");
    expect(line.textContent).toBe("मेरा भाई, मोहित।मौसी ने");
    expect(line.querySelector("b")?.textContent).toBe("मौसी");
  });

  it("joins words with spaces when there is no break", () => {
    const { container } = render(<Subtitles words={[{ text: "Stop!" }, { text: "Who" }, { text: "opened" }]} activeWord={-1} lang="en" />);
    expect(container.querySelector(".uw-sub-line")?.textContent).toBe("Stop! Who opened");
    expect(container.querySelector("br")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("marks only the spoken words as phone dialogue", () => {
    const { container } = render(<Subtitles speaker="Neighbour" heardAs="phone" words={[{ text: "Hello" }]} activeWord={0} lang="en" />);
    expect(container.querySelector('.uw-sub-line[data-heard-as="phone"] b')?.textContent).toBe("Hello");
    expect(container.querySelector(".uw-sub-speaker")?.getAttribute("data-heard-as")).toBeNull();
  });
});
