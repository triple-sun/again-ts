import type { Config } from "jest";

const config: Config = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["**/tests/**/*.spec.ts"],
	verbose: true,
	collectCoverage: true,
	coverageDirectory: "../coverage",
	collectCoverageFrom: ["src/**/*.ts"],
	coveragePathIgnorePatterns: ["index.ts"],
	coverageThreshold: {
		global: {
			lines: 90,
			statements: 90
		}
	}
};

export default config;
