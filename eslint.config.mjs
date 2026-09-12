import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Disable the new overly aggressive react-hooks rules introduced with the
    // latest eslint-plugin-react-hooks. They flag legitimate pre-existing
    // patterns (initializing client state from localStorage / window in an
    // effect, and memoized component wrappers) that we do not want to rewrite.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
    },
  },
  {
    // next.config.js is a CommonJS config file and intentionally uses require().
    ignores: ["next.config.js", "postcss.config.mjs"],
  },
];

export default eslintConfig;