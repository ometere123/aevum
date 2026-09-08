export default {
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/frontend/setup.ts"],
    exclude: ["**/node_modules/**", "**/.pytest_cache/**", "**/artifacts/**"],
  },
};
