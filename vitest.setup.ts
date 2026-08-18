/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";

// jsdom implements neither matchMedia nor ResizeObserver -- both are used by
// design-system/components/data-grid.tsx's responsive-height and edge-shadow
// effects. No test mounted anything that renders DataGrid before Task 3's
// style-column.test.tsx (which pulls it in transitively via SampleContent),
// so this gap was latent until now. Both mocks are minimal -- just enough
// surface area for the component to attach/detach listeners without
// throwing, not a real implementation of either API's behavior.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}
