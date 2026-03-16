const TAG = '[Valoria]';

export const log = {
  info: (label: string, ...args: unknown[]) => {
    console.log(`${TAG} [INFO] ${label}`, ...args);
  },
  warn: (label: string, ...args: unknown[]) => {
    console.warn(`${TAG} [WARN] ${label}`, ...args);
  },
  error: (label: string, ...args: unknown[]) => {
    console.error(`${TAG} [ERROR] ${label}`, ...args);
  },
};
