"use client";

import { BHD_APPS, type BhdApp } from "@/lib/bhd/apps";
import { DEFAULT_IDENTITY_ISSUER } from "@/lib/bhd/issuer";
import { BhdAppIcon } from "@/components/bhd/BhdAppIcon";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export type BhdSwitcherUser = {
  name: string;
  email: string;
  picture: string | null;
};

type Panel = "apps" | "account" | null;

function stripSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isCurrentApp(app: BhdApp, pageOrigin: string) {
  const here = stripSlash(pageOrigin);
  if (app.id === "account") return here === "https://id.bhd-om.com";
  if (app.id === "hisaby") {
    return (
      here === "https://hisaby.bhd-om.com" ||
      here === "https://hisaby.pro" ||
      here === "https://www.hisaby.pro" ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(here)
    );
  }
  if (app.id === "portal") {
    return here === "https://www.bhd-om.com" || here === "https://bhd-om.com";
  }
  return Boolean(app.origin) && here === stripSlash(app.origin);
}

function accountPageUrl(pageOrigin: string) {
  if (!pageOrigin) return `${DEFAULT_IDENTITY_ISSUER}/account`;
  const accountApp = BHD_APPS.find((app) => app.id === "account");
  if (accountApp && isCurrentApp(accountApp, pageOrigin)) {
    return "/account";
  }
  return `${DEFAULT_IDENTITY_ISSUER}/account`;
}

function openApp(app: BhdApp, pageOrigin: string) {
  if (app.mode === "identity") {
    window.location.assign(accountPageUrl(pageOrigin));
    return;
  }
  if (app.mode === "sso" && app.startUrl) {
    window.location.assign(app.startUrl);
    return;
  }
  if (app.origin) {
    window.location.assign(`${stripSlash(app.origin)}/`);
  }
}

function clampCardStyle(anchor: DOMRect): CSSProperties {
  const margin = 12;
  const width = Math.min(320, window.innerWidth - margin * 2);
  let left = anchor.left;
  // Keep panel inside the viewport (RTL header puts switcher on the left edge)
  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - margin - width;
  }
  if (left < margin) left = margin;
  const top = Math.min(anchor.bottom + 10, window.innerHeight - 120);
  return {
    position: "fixed",
    top,
    left,
    right: "auto",
    width,
    maxHeight: Math.min(360, window.innerHeight - top - margin),
    zIndex: 200,
  };
}

export function BhdAppSwitcher({
  user,
  onSignOut,
  platformAdmin = false,
}: {
  user: BhdSwitcherUser;
  onSignOut: () => void | Promise<void>;
  platformAdmin?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [origin, setOrigin] = useState("");
  const [pictureFailed, setPictureFailed] = useState(false);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const appsId = useId();
  const accountId = useId();

  const picture =
    user.picture && !pictureFailed ? user.picture.trim() || null : null;
  const initial = user.name.trim().slice(0, 1) || "ح";

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setPictureFailed(false);
  }, [user.picture]);

  const close = useCallback(() => setPanel(null), []);

  const placeCard = useCallback(() => {
    if (!rootRef.current) return;
    setCardStyle(clampCardStyle(rootRef.current.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!panel) return;
    placeCard();
    window.addEventListener("resize", placeCard);
    window.addEventListener("scroll", placeCard, true);
    return () => {
      window.removeEventListener("resize", placeCard);
      window.removeEventListener("scroll", placeCard, true);
    };
  }, [panel, placeCard]);

  useEffect(() => {
    if (!panel) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [panel, close]);

  function onAppClick(app: BhdApp) {
    if (!app.enabled) return;
    if (app.id === "account") {
      window.location.assign(accountPageUrl(origin));
      return;
    }
    if (origin && isCurrentApp(app, origin)) {
      close();
      return;
    }
    openApp(app, origin);
  }

  return (
    <div className="bhd-switcher-slot" ref={rootRef}>
      <button
        type="button"
        className="bhd-switcher-grid"
        aria-label="تطبيقات BHD"
        aria-haspopup="dialog"
        aria-expanded={panel === "apps"}
        aria-controls={panel === "apps" ? appsId : undefined}
        onClick={() => setPanel((current) => (current === "apps" ? null : "apps"))}
      >
        <span aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <i key={index} />
          ))}
        </span>
      </button>

      <button
        type="button"
        className="bhd-switcher-avatar"
        aria-label="الحساب"
        aria-haspopup="dialog"
        aria-expanded={panel === "account"}
        aria-controls={panel === "account" ? accountId : undefined}
        onClick={() =>
          setPanel((current) => (current === "account" ? null : "account"))
        }
      >
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture}
            alt=""
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            onError={() => setPictureFailed(true)}
          />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {panel === "apps" ? (
        <div
          className="bhd-switcher-card"
          id={appsId}
          role="dialog"
          aria-label="تطبيقات BHD"
          style={cardStyle}
        >
          <div className="bhd-switcher-card-head">
            <p>تطبيقات BHD</p>
          </div>
          <div className="bhd-switcher-grid-apps">
            {BHD_APPS.map((app) => {
              const current = origin ? isCurrentApp(app, origin) : false;
              return (
                <button
                  key={app.id}
                  type="button"
                  className={
                    app.enabled
                      ? "bhd-switcher-app"
                      : "bhd-switcher-app is-disabled"
                  }
                  disabled={!app.enabled}
                  aria-disabled={!app.enabled}
                  aria-current={current ? "page" : undefined}
                  onClick={() => onAppClick(app)}
                >
                  <BhdAppIcon
                    id={app.id}
                    title={app.nameAr}
                    className={
                      current
                        ? "bhd-switcher-mark is-current"
                        : "bhd-switcher-mark"
                    }
                  />
                  <span>{app.nameAr}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {panel === "account" ? (
        <div
          className="bhd-switcher-card bhd-switcher-account"
          id={accountId}
          role="dialog"
          aria-label="الحساب"
          style={cardStyle}
        >
          <div className="bhd-switcher-account-row">
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={picture}
                alt=""
                width={44}
                height={44}
                referrerPolicy="no-referrer"
                onError={() => setPictureFailed(true)}
              />
            ) : (
              <span className="bhd-switcher-account-initial">{initial}</span>
            )}
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <a
            className="bhd-switcher-account-link"
            href={accountPageUrl(origin)}
          >
            الحساب
          </a>
          {platformAdmin ? (
            <a className="bhd-switcher-account-link" href="/admin">
              الإدارة
            </a>
          ) : null}
          <button
            type="button"
            className="bhd-switcher-signout"
            onClick={() => void onSignOut()}
          >
            خروج
          </button>
        </div>
      ) : null}
    </div>
  );
}
