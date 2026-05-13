import type { ImportDetails, ImportProgress, RecentImports } from "../model";
import type { ImportDetailsDto } from "./dto/import-details.dto";
import type { ImportProgressEventDto } from "./dto/import-progress-event.dto";
import type { RecentImportsDto } from "./dto/recent-imports.dto";

export function mapImportDetailsDto(dto: ImportDetailsDto): ImportDetails {
  return dto;
}

export function mapRecentImportsDto(dto: RecentImportsDto): RecentImports {
  return { items: dto.items };
}

export function mapImportProgressEventDto(dto: ImportProgressEventDto): ImportProgress {
  return dto;
}
