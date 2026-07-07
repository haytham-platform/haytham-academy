import Link from "next/link";
import { Phone, MapPin, Share2, Globe, Mail } from "lucide-react";
import { ACADEMY } from "@/lib/constants";
import Container from "@/components/ui/Container";
import AcademyLogo from "@/components/ui/AcademyLogo";

const footerLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/courses", label: "الدورات" },
  { href: "/teachers", label: "الأساتذة" },
  { href: "/about", label: "من نحن" },
  { href: "/news", label: "الأخبار" },
  { href: "/contact", label: "تواصل معنا" },
];

const socialLinks = [
  { href: "#", label: "Facebook", icon: Share2 },
  { href: "#", label: "Instagram", icon: Globe },
  { href: "#", label: "Youtube", icon: Mail },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-primary text-white">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <AcademyLogo variant="dark" size="lg" href="/" />
            <p className="text-sm leading-7 text-gray-400">
              منصة تعليمية متخصصة في تقديم دورات عالية الجودة لمساعدة الطلاب
              على تحقيق أهدافهم الأكاديمية والمهنية.
            </p>
            <div className="mt-5 flex gap-3">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-secondary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">روابط سريعة</h4>
            <ul className="space-y-2.5">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">معلومات التواصل</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                <a href={`tel:${ACADEMY.phone}`} className="hover:text-white">
                  {ACADEMY.phone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                <span>{ACADEMY.address}</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">ساعات العمل</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>السبت - الخميس: 8:00 - 20:00</li>
              <li>الجمعة: مغلق</li>
            </ul>
            <Link
              href="/contact"
              className="mt-5 inline-flex rounded-2xl bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary"
            >
              تواصل معنا
            </Link>
          </div>
        </div>
      </Container>

      <div className="border-t border-white/10 py-5 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} {ACADEMY.name}. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
