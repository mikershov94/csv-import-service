"use client";

import { useEffect, useState } from "react";

import {
  getImportById,
  getRecentImports,
  ImportDetails,
  ImportProgress,
  ImportStatus,
  isFinalImportStatus,
  RecentImports,
  streamImportEvents,
} from "@/entities/import";
import { PageContainer } from "@/shared/ui";
import { ImportHistoryWidget } from "@/widgets/import-history/ui/import-history-widget";
import { ImportProgressWidget } from "@/widgets/import-progress/ui/import-progress-widget";
import { ImportSummaryWidget } from "@/widgets/import-summary/ui/import-summary-widget";
import { UploadZoneWidget } from "@/widgets/upload-zone/ui/upload-zone-widget";

export const ImportsDashboardClient = () => {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [details, setDetails] = useState<ImportDetails | null>(null);
  const [history, setHistory] = useState<RecentImports>({ items: [] });

  const refreshHistory = async () => {
    try {
      const next = await getRecentImports(20);
      setHistory(next);
    } catch {
      setHistory((prev) => prev);
    }
  };

  const handleImportCreated = (jobId: string) => {
    setCurrentJobId(jobId);
    setProgress({
      jobId,
      status: ImportStatus.QUEUED,
      processedBytes: 0,
      validRows: 0,
      invalidRows: 0,
    });
    setDetails(null);
    void refreshHistory();
  };

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      try {
        const next = await getRecentImports(20);
        if (isMounted) {
          setHistory(next);
        }
      } catch {
        // no-op
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentJobId) {
      return;
    }

    const unsubscribe = streamImportEvents({
      jobId: currentJobId,
      onProgress: (event) => {
        setProgress(event);
      },
    });

    const interval = setInterval(async () => {
      try {
        const nextDetails = await getImportById(currentJobId);
        setDetails(nextDetails);
        setProgress((previous) => ({
          jobId: currentJobId,
          status: nextDetails.status,
          processedBytes: previous?.processedBytes ?? 0,
          validRows: nextDetails.successRows,
          invalidRows: nextDetails.failedRows,
        }));

        if (isFinalImportStatus(nextDetails.status)) {
          clearInterval(interval);
          void refreshHistory();
        }
      } catch {
        // no-op: keep polling fallback
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [currentJobId]);

  return (
    <div className="min-h-screen bg-slate-100">
      <PageContainer>
        <UploadZoneWidget onImportCreated={handleImportCreated} />
        <ImportProgressWidget progress={progress} details={details} />
        <ImportSummaryWidget details={details} />
        <ImportHistoryWidget history={history} />
      </PageContainer>
    </div>
  );
};
