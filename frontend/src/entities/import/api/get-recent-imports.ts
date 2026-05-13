import type { RecentImports } from "../model";
import type { RecentImportsDto } from "./dto/recent-imports.dto";
import { mapRecentImportsDto } from "./mappers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function getRecentImports(limit = 20): Promise<RecentImports> {
  const response = await fetch(`${API_BASE_URL}/api/imports?limit=${limit}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to fetch recent imports");
  }

  const dto = (await response.json()) as RecentImportsDto;
  return mapRecentImportsDto(dto);
}
