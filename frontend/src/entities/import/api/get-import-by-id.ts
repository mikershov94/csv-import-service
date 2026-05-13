import type { ImportDetails } from "../model";
import type { ImportDetailsDto } from "./dto/import-details.dto";
import { mapImportDetailsDto } from "./mappers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function getImportById(jobId: string): Promise<ImportDetails> {
  const response = await fetch(`${API_BASE_URL}/api/imports/${jobId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to fetch import ${jobId}`);
  }

  const dto = (await response.json()) as ImportDetailsDto;
  return mapImportDetailsDto(dto);
}
