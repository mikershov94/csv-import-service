import { PropsWithChildren } from "react";

import { Card, CardContent } from "@/shared/shadcn/ui/card";

type PanelProps = PropsWithChildren<{
  className?: string;
  contentClassName?: string;
}>;

export const Panel = ({ children, className, contentClassName }: PanelProps) => {
  return (
    <Card className={className}>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
};

