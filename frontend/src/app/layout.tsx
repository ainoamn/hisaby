import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./light-theme.css";
import { Providers } from "@/components/providers";
import { ClientErrorBeacon } from "@/components/system/client-error-beacon";
import { BhdSilentSso } from "@/components/bhd/BhdSilentSso";
import { IDENTITY_SCRIPT_URL } from "@/lib/bhd/runtime";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://hisaby.pro",
  ),
  title: "حسابي Hisaby — محاسبة سحابية لأعمال الخليج والمنطقة",
  description:
    "حسابي (Hisaby) منصة محاسبة سحابية للشركات في الخليج والمنطقة: فواتير، مخزون، ضريبة، وتقارير. مطوّر ومشغّل بواسطة شركة بن حمود للتطوير.",
  keywords: [
    "محاسبة",
    "فواتير",
    "الخليج",
    "حسابي",
    "Hisaby",
    "ضريبة القيمة المضافة",
    "بن حمود للتطوير",
  ],
  authors: [{ name: "Bin Hamood Development" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "حسابي",
    statusBarStyle: "black-translucent",
  },
  other: {
    "theme-color": "#065f46",
  },
  openGraph: {
    title: "حسابي Hisaby",
    description: "محاسبة سحابية لأعمال الخليج والمنطقة — شركة بن حمود للتطوير",
    type: "website",
    images: [{ url: "/brand/hisaby-mark.png" }],
  },
  icons: {
    icon: "/brand/hisaby-mark.png",
    apple: "/brand/hisaby-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script src={IDENTITY_SCRIPT_URL} strategy="afterInteractive" />
        <Providers>
          <BhdSilentSso />
          <ClientErrorBeacon />
          {children}
        </Providers>
        <Script id="hisaby-css-recover" strategy="beforeInteractive">
          {`(function(){window.addEventListener("load",function(){var links=document.querySelectorAll('link[rel="stylesheet"]');var broken=!links.length;for(var i=0;i<links.length;i++){if(!links[i].sheet){broken=true;break}}if(!broken)return;var key="hisaby-css-reload";var used=false;try{used=sessionStorage.getItem(key)==="1"}catch(e){}if(used)return;try{sessionStorage.setItem(key,"1")}catch(e){}var jobs=[];if(navigator.serviceWorker){jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}).catch(function(){}))}if(window.caches){jobs.push(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k)}))}).catch(function(){}))}Promise.all(jobs).then(function(){location.reload()},function(){location.reload()})})})();`}
        </Script>
        <Script id="hisaby-boot-escape" strategy="beforeInteractive">
          {`(function(){setTimeout(function(){var root=document.getElementById("hisaby-boot");if(!root)return;var key="hisaby-boot-escape";var used=false;try{used=sessionStorage.getItem(key)==="1"}catch(e){}if(used){var pending=document.getElementById("hisaby-boot-pending");var fallback=document.getElementById("hisaby-boot-fallback");if(pending)pending.hidden=true;if(fallback)fallback.hidden=false;return}try{sessionStorage.setItem(key,"1")}catch(e){}var path=location.pathname+location.search;location.replace("/api/auth/bhd/start?returnTo="+encodeURIComponent(path||"/dashboard"))},12000)})();`}
        </Script>
      </body>
    </html>
  );
}
