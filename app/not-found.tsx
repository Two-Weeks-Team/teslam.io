import Link from "next/link";
import { fontVars } from "@/lib/fonts";
import "./globals.css";

/**
 * With two root layouts and no `app/layout.tsx`, the not-found page inherits
 * nothing — it has to render its own document shell.
 */
export default function NotFound() {
  return (
    <html lang="ko" className={fontVars}>
      <body>
        <main className="wrap" style={{ paddingBlock: "6rem" }}>
          <p className="eyebrow">404</p>
          <h1 className="sec__h2">여기에는 페이지가 없습니다.</h1>
          <p className="sec__lede">
            이 사이트는 한 장짜리입니다. <Link href="/">본문으로 가기</Link>,
            또는 <Link href="/en">English</Link>.
          </p>
        </main>
      </body>
    </html>
  );
}
