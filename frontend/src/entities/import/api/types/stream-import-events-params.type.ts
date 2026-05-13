import type { ImportProgress } from "../../model";

export type StreamImportEventsParams = {
  jobId: string;
  onProgress: (event: ImportProgress) => void;
  onError?: (error: Event) => void;
};
