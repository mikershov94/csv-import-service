import type { ImportProgressEventDto } from "./dto/import-progress-event.dto";
import { mapImportProgressEventDto } from "./mappers";
import type { StreamImportEventsParams } from "./types/stream-import-events-params.type";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function streamImportEvents({
  jobId,
  onProgress,
  onError,
}: StreamImportEventsParams): () => void {
  const source = new EventSource(`${API_BASE_URL}/api/imports/${jobId}/events`);

  source.addEventListener("progress", (event) => {
    const message = event as MessageEvent<string>;
    const parsed = JSON.parse(message.data) as ImportProgressEventDto;
    onProgress(mapImportProgressEventDto(parsed));
  });

  source.onerror = (error) => {
    onError?.(error);
  };

  return () => {
    source.close();
  };
}
