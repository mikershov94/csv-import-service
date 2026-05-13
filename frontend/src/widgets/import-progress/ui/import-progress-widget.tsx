import { Panel, Progress } from "@/shared/ui";

export const ImportProgressWidget = () => {
  return (
    <Panel className="min-h-44 bg-amber-300" contentClassName="py-6">
      <Progress value={40} label="Progress" />
    </Panel>
  );
};
