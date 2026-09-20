import type { Metadata } from "next";
import "@genlayer/transaction-kit-react/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Threadmark | Follow the evidence",
  description: "Trace every derived claim back to pinned source lines through a GenLayer-validated provenance graph.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
