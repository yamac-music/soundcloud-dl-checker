import { IntakeRequest, IntakeSource } from "@/types/history";
import { normalizeUrlCandidate } from "@/services/url";

export function buildIntakeRequest(url: string, source: IntakeSource = "manual"): IntakeRequest {
  return {
    source,
    url: normalizeUrlCandidate(url)
  };
}

