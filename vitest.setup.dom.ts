import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only cleans up on its own when `globals` is enabled; imports are explicit here.
afterEach(() => {
  cleanup();
});
