import { bgRedBright, whiteBright } from "chalk";

export const coloredError = (...text: unknown[]) =>
  bgRedBright(whiteBright(...text));