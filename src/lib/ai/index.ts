import type { Layer3Report } from "@/types/scan";
import { runLayer3 as _runLayer3 } from "./integrity/runLayer3";

export async function runLayer3(
  cleanText: string,
  opts: { enabled: boolean },
): Promise<Layer3Report> {
  return _runLayer3(cleanText, opts);
}
