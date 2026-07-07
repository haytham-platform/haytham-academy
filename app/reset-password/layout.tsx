import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "إعادة تعيين كلمة المرور",
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
