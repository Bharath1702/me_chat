import { vi } from "vitest";

// Mock server-only in Vitest so server utility modules can be tested in NodeJS test environment
vi.mock("server-only", () => ({}));
