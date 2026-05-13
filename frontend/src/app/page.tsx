import { PageContainer } from "@/shared/ui/page-container/page-container";
import { ImportHistoryWidget } from "@/widgets/import-history/ui/import-history-widget";
import { ImportProgressWidget } from "@/widgets/import-progress/ui/import-progress-widget";
import { ImportSummaryWidget } from "@/widgets/import-summary/ui/import-summary-widget";
import { UploadZoneWidget } from "@/widgets/upload-zone/ui/upload-zone-widget";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100">
      <PageContainer>
        <UploadZoneWidget />
        <ImportProgressWidget />
        <ImportSummaryWidget />
        <ImportHistoryWidget />
      </PageContainer>
    </div>
  );
}
