import type { CreateImportResponseDto } from "./dto/create-import-response.dto";
import type { CreateImportResult } from "./types/create-import-result.type";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function createImport(file: File): Promise<CreateImportResult> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/imports`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Не удалось создать задачу импорта");
  }

  const dto = (await response.json()) as CreateImportResponseDto;
  return dto;
}
