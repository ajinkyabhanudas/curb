import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// jsdom does not implement scrolling.
window.scrollTo = vi.fn();
