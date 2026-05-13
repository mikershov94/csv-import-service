import { PropsWithChildren } from "react";

export const PageContainer = ({ children }: PropsWithChildren) => {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {children}
    </main>
  );
};
