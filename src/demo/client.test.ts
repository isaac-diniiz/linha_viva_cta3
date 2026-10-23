import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEARTBEAT_MS, useLocalDemo } from "./client";

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  pings() {
    return this.sent.filter(
      (message) => (message as { type: string }).type === "ping",
    ).length;
  }
}

describe("conexão da demonstração", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("manda uma pulsação periódica enquanto conectado, para o servidor hospedado não dormir", () => {
    const { unmount } = renderHook(() => useLocalDemo("projection"));
    const socket = FakeSocket.instances[0];
    act(() => socket.open());
    expect(socket.pings()).toBe(0);
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS));
    expect(socket.pings()).toBe(1);
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS * 2));
    expect(socket.pings()).toBe(3);
    unmount();
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS * 2));
    expect(socket.pings()).toBe(3);
  });

  it("para a pulsação quando a conexão cai", () => {
    renderHook(() => useLocalDemo("projection"));
    const socket = FakeSocket.instances[0];
    act(() => socket.open());
    act(() => {
      socket.readyState = 3;
      socket.onclose?.();
    });
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS * 2));
    expect(socket.pings()).toBe(0);
  });

  it("pulsa a cada minuto, bem abaixo dos 15 minutos que fazem o Render dormir", () => {
    expect(HEARTBEAT_MS).toBeLessThanOrEqual(60_000);
  });
});
