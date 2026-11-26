// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crossfadeRoom, GHOST_ATTR, watchRoomCrossfades } from "./roomCrossfade";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function screen(src: string, { layers = false }: { layers?: boolean } = {}): HTMLElement {
  const root = document.createElement("main");
  root.className = "uw-ambient uw-ambient--screen";
  if (layers) {
    for (const [i, layer] of ["front", "back"].entries()) {
      const img = document.createElement("img");
      img.className = "uw-ambient-img";
      img.setAttribute("src", i === 0 ? src : "/media/other.webp");
      img.setAttribute("data-room-layer", layer);
      root.append(img);
    }
  } else {
    const img = document.createElement("img");
    img.className = "uw-ambient-img";
    img.setAttribute("src", src);
    root.append(img);
  }
  const panel = document.createElement("div");
  panel.className = "uw-glass";
  root.append(panel);
  return root;
}

const ghosts = () => [...document.querySelectorAll<HTMLImageElement>(`[${GHOST_ATTR}]`)];

describe("room cross-fade", () => {
  let finish: (() => void)[] = [];
  let stop: () => void = () => {};
  const options = { whenLoaded: () => Promise.resolve(), durationMs: () => 900, easing: () => "ease-in-out" };

  beforeEach(() => {
    finish = [];
    // jsdom has no Web Animations: record the fade and let the test end it.
    HTMLElement.prototype.animate = vi.fn(function (this: HTMLElement) {
      let resolve: () => void = () => {};
      const finished = new Promise<void>((r) => (resolve = r));
      finish.push(resolve);
      return { finished } as unknown as Animation;
    });
  });
  afterEach(() => {
    stop();
    document.body.innerHTML = "";
  });

  it("lays the old still over the new screen and removes it after the fade", async () => {
    document.body.append(screen("/media/a.webp"));
    stop = watchRoomCrossfades(document.body, options);
    document.body.querySelector("main")!.replaceWith(screen("/media/b.webp"));
    await flush();

    const [ghost] = ghosts();
    expect(ghost).toBeDefined();
    expect(ghost.getAttribute("src")).toBe(new URL("/media/a.webp", document.baseURI).href);
    expect(ghost.className).toBe("uw-ambient-img");
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    // Above the new still, below the content.
    expect(ghost.previousElementSibling?.getAttribute("src")).toBe("/media/b.webp");
    expect(ghost.nextElementSibling?.className).toBe("uw-glass");
    expect(HTMLElement.prototype.animate).toHaveBeenCalledWith([{ opacity: 1 }, { opacity: 0 }], expect.objectContaining({ duration: 900 }));

    finish.forEach((done) => done());
    await flush();
    expect(ghosts()).toHaveLength(0);
  });

  it("does nothing when the next screen shows the same still", async () => {
    document.body.append(screen("/media/a.webp"));
    stop = watchRoomCrossfades(document.body, options);
    document.body.querySelector("main")!.replaceWith(screen("/media/a.webp"));
    await flush();
    expect(ghosts()).toHaveLength(0);
  });

  it("cross-fades a still that changes in place (Home's series dock)", async () => {
    document.body.append(screen("/media/a.webp"));
    stop = watchRoomCrossfades(document.body, options);
    document.querySelector("img")!.setAttribute("src", "/media/b.webp");
    await flush();
    expect(ghosts().map((g) => g.getAttribute("src"))).toEqual([new URL("/media/a.webp", document.baseURI).href]);
  });

  it("leaves the player's own two-layer room alone", async () => {
    document.body.append(screen("/media/a.webp", { layers: true }));
    stop = watchRoomCrossfades(document.body, options);
    document.querySelector('[data-room-layer="back"]')!.setAttribute("src", "/media/c.webp");
    await flush();
    expect(ghosts()).toHaveLength(0);
  });

  it("uses the player's front layer when the player arrives", async () => {
    document.body.append(screen("/media/a.webp"));
    stop = watchRoomCrossfades(document.body, options);
    document.body.querySelector("main")!.replaceWith(screen("/media/shot1.webp", { layers: true }));
    await flush();
    const [ghost] = ghosts();
    expect(ghost.getAttribute("src")).toBe(new URL("/media/a.webp", document.baseURI).href);
    expect(ghost.hasAttribute("data-room-layer")).toBe(false);
    // After both layers.
    expect(ghost.previousElementSibling?.getAttribute("data-room-layer")).toBe("back");
  });

  it("ignores roots that are not screens", async () => {
    const card = document.createElement("div");
    card.className = "uw-ambient";
    card.innerHTML = '<img class="uw-ambient-img" src="/media/a.webp">';
    document.body.append(card);
    stop = watchRoomCrossfades(document.body, options);
    card.querySelector("img")!.setAttribute("src", "/media/b.webp");
    await flush();
    expect(ghosts()).toHaveLength(0);
  });

  it("crossfadeRoom refuses a root without a still", () => {
    const root = document.createElement("main");
    root.className = "uw-ambient uw-ambient--screen";
    expect(crossfadeRoom(root, "/media/a.webp", options)).toBeNull();
  });
});
