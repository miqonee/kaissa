// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, reactive, type App } from "vue";
import { Chess } from "chess.js";
import ChessBoard from "../src/components/ChessBoard.vue";
const captured = vi.hoisted(() => ({ api: null as any }));
vi.mock("@lichess-org/chessground", async (importOriginal) => {
  const real = await importOriginal<any>();
  return {
    ...real,
    Chessground: (el: HTMLElement, config: object) => {
      captured.api = real.Chessground(el, { ...config, trustAllEvents: true });
      return captured.api;
    },
  };
});
const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let top = 100;
let app: App;
let root: HTMLElement;
beforeEach(() => {
  top = 100;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(50, top, 400, 400),
  );
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
  captured.api = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount(premove = false) {
  const props = reactive({
    fen: premove ? fen.replace(" w ", " b ") : fen,
    movableColor: "white" as const,
    canPremove: premove,
    dests: { e2: ["e3", "e4"], d2: ["d3", "d4"] },
    lastMove: null as string[] | null,
  });
  const move = vi.fn();
  app = createApp({ render: () => h(ChessBoard, { ...props, onMove: move }) });
  app.mount(root);
  await nextTick();
  await new Promise((r) => requestAnimationFrame(r));
  return { props, move };
}
function click(key: string) {
  const file = key.charCodeAt(0) - 97,
    rank = 8 - Number(key[1]);
  const options = {
    bubbles: true,
    cancelable: true,
    clientX: 50 + (file + 0.5) * 50,
    clientY: top + (rank + 0.5) * 50,
    button: 0,
  };
  root
    .querySelector("cg-board")!
    .dispatchEvent(new MouseEvent("mousedown", { ...options, buttons: 1 }));
  document.dispatchEvent(new MouseEvent("mouseup", { ...options, buttons: 0 }));
}
describe("Chessboard selection across layout changes", () => {
  it("selects the correct piece on the first click after a banner above the board disappears", async () => {
    await mount();
    captured.api.state.dom.bounds(); // cache the original location
    top = 40; // same dimensions, so ResizeObserver does not run
    click("e2");
    expect(captured.api.state.selected).toBe("e2");
  });
  it("keeps click-to-move accurate when the board shifts between the two clicks", async () => {
    const { move } = await mount();
    click("e2");
    expect(captured.api.state.selected).toBe("e2");
    top = 40;
    click("e4");
    await new Promise((r) => setTimeout(r, 5));
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith({ from: "e2", to: "e4", premove: false });
  });
  it("refreshes the hit area before a touch starts after a layout shift", async () => {
    await mount();
    captured.api.state.dom.bounds();
    top = 40;
    const board = root.querySelector("cg-board")!;
    const touch = { clientX: 275, clientY: 365, target: board, identifier: 1 };
    const start = new Event("touchstart", { bubbles: true, cancelable: true });
    Object.defineProperties(start, {
      touches: { value: [touch] },
      targetTouches: { value: [touch] },
    });
    board.dispatchEvent(start);
    expect(captured.api.state.selected).toBe("e2");
    board.dispatchEvent(
      new Event("touchend", { bubbles: true, cancelable: true }),
    );
  });
  it("still plays a queued premove once when the opponent moves", async () => {
    const { props, move } = await mount(true);
    click("e2");
    click("e4");
    expect(captured.api.state.premovable.current).toEqual(["e2", "e4"]);
    top = 40;
    const chess = new Chess(props.fen);
    chess.move("e5");
    props.fen = chess.fen();
    props.canPremove = false;
    await nextTick();
    await new Promise((r) => setTimeout(r, 5));
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith({ from: "e2", to: "e4", premove: true });
  });
  it("supports dragging after the board position changes", async () => {
    const { move } = await mount();
    captured.api.state.dom.bounds();
    top = 40;
    const board = root.querySelector("cg-board")!;
    board.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 275,
        clientY: 365,
        button: 0,
        buttons: 1,
      }),
    );
    document.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: 275,
        clientY: 265,
        buttons: 1,
      }),
    );
    await new Promise((r) => requestAnimationFrame(r));
    document.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        clientX: 275,
        clientY: 265,
        button: 0,
        buttons: 0,
      }),
    );
    await new Promise((r) => setTimeout(r, 5));
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith({ from: "e2", to: "e4", premove: false });
  });
  it("preserves selection when the same legal destinations arrive in a new state object", async () => {
    const { props, move } = await mount();
    click("e2");
    props.dests = { e2: ["e3", "e4"], d2: ["d3", "d4"] };
    await nextTick();
    expect(captured.api.state.selected).toBe("e2");
    click("e4");
    await new Promise((r) => setTimeout(r, 5));
    expect(move).toHaveBeenCalledTimes(1);
  });
});
