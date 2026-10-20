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

export type AuthProviderMark = "password" | "google" | "facebook" | "whatsapp";

export type BhdSwitcherUser = {
  id?: string;
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  picture: string | null;
  providers?: AuthProviderMark[];
  googleLinked?: boolean;
  facebookLinked?: boolean;
  hasPassword?: boolean;
};

type Panel = "apps" | "account" | null;

const COPY = {
  ar: {
    appsAria: "تطبيقات BHD",
    accountAria: "الحساب",
    appsTitle: "تطبيقات BHD",
    account: "الحساب",
    admin: "الإدارة",
    signOut: "خروج من هذا الحساب",
    signOutAll: "خروج من كل الحسابات",
    addAccount: "إضافة حساب آخر",
    switchTo: "تبديل إلى",
    manage: "إدارة الحساب",
    providerPassword: "تسجيل عادي",
    providerGoogle: "جوجل",
    providerFacebook: "فيسبوك",
    providerWhatsapp: "واتساب",
  },
  en: {
    appsAria: "BHD apps",
    accountAria: "Account",
    appsTitle: "BHD apps",
    account: "Account",
    admin: "Admin",
    signOut: "Sign out of this account",
    signOutAll: "Sign out of all accounts",
    addAccount: "Add another account",
    switchTo: "Switch to",
    manage: "Manage account",
    providerPassword: "Password",
    providerGoogle: "Google",
    providerFacebook: "Facebook",
    providerWhatsapp: "WhatsApp",
  },
} as const;

const PROVIDER_ORDER = ["password", "google", "facebook", "whatsapp"] as const;

function accountProviders(user: BhdSwitcherUser): AuthProviderMark[] {
  const found = new Set<AuthProviderMark>(user.providers || []);
  if (user.googleLinked) found.add("google");
  if (user.facebookLinked) found.add("facebook");
  if (user.hasPassword) found.add("password");
  const picture = user.picture || "";
  if (picture.includes("googleusercontent.com")) found.add("google");
  if (picture.includes("fbcdn.net") || picture.includes("facebook.com")) found.add("facebook");
  return PROVIDER_ORDER.filter((item) => found.has(item));
}

function accountHandle(user: BhdSwitcherUser) {
  return user.email || user.username || user.phone || user.name;
}

function accountMeta(user: BhdSwitcherUser) {
  return [user.username, user.phone].filter(
    (item, index, list) => item && list.indexOf(item) === index && item !== user.email,
  );
}

type SwitcherCopy = (typeof COPY)["ar"] | (typeof COPY)["en"];

function ProviderMarks({
  providers,
  t,
}: {
  providers: AuthProviderMark[];
  t: SwitcherCopy;
}) {
  const labels: Record<AuthProviderMark, { mark: string; label: string }> = {
    password: { mark: "●", label: t.providerPassword },
    google: { mark: "G", label: t.providerGoogle },
    facebook: { mark: "f", label: t.providerFacebook },
    whatsapp: { mark: "WA", label: t.providerWhatsapp },
  };
  if (!providers.length) return null;
  return (
    <span className="bhd-switcher-providers">
      {providers.map((id) => (
        <abbr
          key={id}
          className={`bhd-switcher-provider is-${id}`}
          title={labels[id].label}
          aria-label={labels[id].label}
        >
          {labels[id].mark}
        </abbr>
      ))}
    </span>
  );
}

function Face({
  user,
  t,
  large = false,
}: {
  user: BhdSwitcherUser;
  t: SwitcherCopy;
  large?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const show = Boolean(user.picture) && !broken;
  const initial = (user.name || user.email || "B").trim().slice(0, 1).toUpperCase();
  return (
    <span className={large ? "bhd-switcher-face is-large" : "bhd-switcher-face"}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.picture || undefined}
          alt=""
          width={large ? 56 : 40}
          height={large ? 56 : 40}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
      <ProviderMarks providers={accountProviders(user).slice(0, 1)} t={t} />
    </span>
  );
}

function AccountRow({
  user,
  t,
  large = false,
}: {
  user: BhdSwitcherUser;
  t: SwitcherCopy;
  large?: boolean;
}) {
  const meta = accountMeta(user);
  return (
    <span className="bhd-switcher-person">
      <Face user={user} t={t} large={large} />
      <span className="bhd-switcher-who">
        <strong dir="ltr">{accountHandle(user)}</strong>
        {meta.length ? <small dir="ltr">{meta.join(" · ")}</small> : null}
      </span>
    </span>
  );
}

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

function clampCardStyle(anchor: DOMRect, widthPx: number, maxHeightPx: number): CSSProperties {
  const margin = 12;
  const width = Math.min(widthPx, window.innerWidth - margin * 2);
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
    maxHeight: Math.min(maxHeightPx, window.innerHeight - top - margin),
    zIndex: 200,
  };
}

export function BhdAppSwitcher({
  user,
  accounts = [],
  onSignOut,
  onSignOutAll,
  onSwitchAccount,
  onAddAccount,
  platformAdmin = false,
  locale = "ar",
}: {
  user: BhdSwitcherUser;
  accounts?: BhdSwitcherUser[];
  onSignOut: () => void | Promise<void>;
  onSignOutAll?: () => void | Promise<void>;
  onSwitchAccount?: (sub: string) => void | Promise<void>;
  onAddAccount?: () => void;
  platformAdmin?: boolean;
  locale?: "ar" | "en";
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [origin, setOrigin] = useState("");
  const [pictureFailed, setPictureFailed] = useState(false);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const appsId = useId();
  const accountId = useId();
  const t = COPY[locale];

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
    const account = panel === "account";
    setCardStyle(
      clampCardStyle(
        rootRef.current.getBoundingClientRect(),
        account ? 360 : 320,
        account ? 480 : 360,
      ),
    );
  }, [panel]);

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
        aria-label={t.appsAria}
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
        aria-label={t.accountAria}
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
          aria-label={t.appsAria}
          style={cardStyle}
        >
          <div className="bhd-switcher-card-head">
            <p>{t.appsTitle}</p>
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
          aria-label={t.accountAria}
          style={cardStyle}
        >
          <div className="bhd-switcher-account-now">
            <AccountRow user={user} t={t} large />
            <a className="bhd-switcher-manage" href={accountPageUrl(origin)}>
              {t.manage}
            </a>
            {platformAdmin ? (
              <a className="bhd-switcher-manage" href="/admin">
                {t.admin}
              </a>
            ) : null}
          </div>
          <div className="bhd-switcher-account-list">
            {accounts
              .filter((item) => {
                if (user.id && item.id && item.id === user.id) return false;
                if (
                  user.email &&
                  item.email &&
                  item.email.toLowerCase() === user.email.toLowerCase()
                ) {
                  return false;
                }
                return Boolean(item.id);
              })
              .map((item) => (
                <button
                  key={item.id || item.email || item.username || item.phone}
                  type="button"
                  className="bhd-switcher-account-choice"
                  aria-label={`${t.switchTo} ${accountHandle(item)}`}
                  onClick={() => item.id && void onSwitchAccount?.(item.id)}
                >
                  <AccountRow user={item} t={t} />
                </button>
              ))}
            {onAddAccount ? (
              <button
                type="button"
                className="bhd-switcher-account-choice"
                onClick={onAddAccount}
              >
                <span className="bhd-switcher-person">
                  <span className="bhd-switcher-face is-action" aria-hidden="true">
                    <span>+</span>
                  </span>
                  <span className="bhd-switcher-who">
                    <strong>{t.addAccount}</strong>
                  </span>
                </span>
              </button>
            ) : null}
          </div>
          <div className="bhd-switcher-account-foot">
            <button
              type="button"
              className="bhd-switcher-account-choice"
              onClick={() => void onSignOut()}
            >
              {t.signOut}
            </button>
            {onSignOutAll ? (
              <button
                type="button"
                className="bhd-switcher-account-choice"
                onClick={() => void onSignOutAll()}
              >
                {t.signOutAll}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
