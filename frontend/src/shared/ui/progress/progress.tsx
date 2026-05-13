import {
  Progress as BaseProgress,
  ProgressLabel,
  ProgressValue,
} from "@/shared/shadcn/ui/progress";

type ProgressProps = {
  value: number;
  label?: string;
  className?: string;
};

export const Progress = ({ value, label, className }: ProgressProps) => {
  return (
    <BaseProgress value={value} className={className}>
      {label ? <ProgressLabel>{label}</ProgressLabel> : null}
      <ProgressValue />
    </BaseProgress>
  );
};

