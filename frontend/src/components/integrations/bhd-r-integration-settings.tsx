"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Ban,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { formatDate, apiErrorMessage } from "@/lib/utils";
import { GlassCard } from "@/components/ui/page-shell";

type BhdRStatus = {
  inbound: {
    configured: boolean;
    prefix: string | null;
    createdAt: string | null;
    lastUsedAt: string | null;
  };
  readKey: { configured: boolean };
  organizationExternalId: string | null;
  sync?: {
    automatic: boolean;
    intervalMinutes: number;
    lastSyncAt: string | null;
    lastError: string | null;
    lastSummary: {
      properties?: number;
      parties?: number;
      invoices?: number;
      payments?: number;
      expenses?: number;
      skipped?: number;
    } | null;
  };
  eventsPath: string;
  eventsUrl?: string;
  propertiesUrl: string;
  propertiesApiKeysUrl: string;
  ssoUrl: string;
};

type BhdRReadme = {
  titleAr: string;
  titleEn: string;
  sections: { id: string; titleAr: string; stepsAr: string[] }[];
};

export function BhdRIntegrationSettings({ className }: { className?: string }) {
  const t = useTranslations("bhdR");
  const tCommon = useTranslations("common");
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [readKey, setReadKey] = useState("");
  const [orgId, setOrgId] = useState("");
  const [guideOpen, setGuideOpen] = useState(true);

  const { data: status, isLoading, isError, refetch } = useQuery({
    queryKey: ["bhd-r-status"],
    queryFn: async () => {
      const res = await api.getBhdRStatus();
      return res.data as BhdRStatus;
    },
  });

  useEffect(() => {
    if (status?.organizationExternalId && !orgId) {
      setOrgId(status.organizationExternalId);
    }
  }, [status?.organizationExternalId, orgId]);

  const { data: readme } = useQuery({
    queryKey: ["bhd-r-readme"],
    queryFn: async () => {
      const res = await api.getBhdRReadme();
      return res.data as BhdRReadme;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bhd-r-status"] });

  const createMutation = useMutation({
    mutationFn: () => api.createBhdRInboundToken(),
    onSuccess: (res) => {
      const data = res.data as { secret: string };
      setRevealedSecret(data.secret);
      invalidate();
      toast.success(t("created"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, tCommon("error")));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.revokeBhdRInboundToken(),
    onSuccess: () => {
      setRevealedSecret(null);
      invalidate();
      toast.success(t("revoked"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, tCommon("error")));
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateBhdRSettings({
        organizationExternalId: orgId.trim(),
        ...(readKey.trim() ? { readApiKey: readKey.trim() } : {}),
      }),
    onSuccess: () => {
      setReadKey("");
      invalidate();
      toast.success(t("saved"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, tCommon("error")));
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => api.syncBhdR(),
    onSuccess: () => {
      invalidate();
      toast.success(t("syncOk"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, tCommon("error")));
    },
  });

  const copySecret = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    toast.success(t("copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <p className="text-sm text-slate-400 py-4 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {tCommon("loading")}
      </p>
    );
  }

  if (isError || !status) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center space-y-2">
        <p className="text-sm text-rose-300">{t("loadFailed")}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950"
        >
          {tCommon("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <Building2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
            <p className="text-sm text-slate-400 mt-1">{t("subtitle")}</p>
          </div>
        </div>
        <a
          href={status.ssoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-emerald-400 hover:bg-slate-700 shrink-0 inline-flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          {t("openProperties")}
        </a>
      </div>

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-2 text-sm text-slate-300">
        <p>
          <span className="text-slate-400">{t("whoInbound")}: </span>
          {t("whoInboundAnswer")}
        </p>
        <p>
          <span className="text-slate-400">{t("whoRead")}: </span>
          {t("whoReadAnswer")}
        </p>
        <p>
          <span className="text-slate-400">{t("whoSso")}: </span>
          {t("whoSsoAnswer")}
        </p>
      </div>

      <GlassCard className="mt-4 p-4 space-y-4">
        <div className="flex items-center gap-2 text-white font-medium">
          <KeyRound className="w-4 h-4 text-emerald-400" />
          {t("inboundTitle")}
        </div>
        <p className="text-sm text-slate-400">{t("inboundHint")}</p>
        <p className="text-xs font-mono text-emerald-400/90 bg-slate-950/60 rounded px-2 py-1.5 overflow-x-auto">
          POST {status.eventsUrl || `https://hisaby.bhd-om.com${status.eventsPath}`}
        </p>
        {status.inbound.configured ? (
          <p className="text-sm text-slate-300">
            {t("statusActive")} · {status.inbound.prefix}…
            {status.inbound.createdAt
              ? ` · ${t("createdAt")}: ${formatDate(status.inbound.createdAt)}`
              : ""}
            {status.inbound.lastUsedAt
              ? ` · ${t("lastUsed")}: ${formatDate(status.inbound.lastUsedAt)}`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-amber-300">{t("statusMissing")}</p>
        )}

        {revealedSecret ? (
          <div className="space-y-2">
            <p className="text-sm text-amber-400">{t("secretWarning")}</p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs break-all bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400">
                {revealedSecret}
              </code>
              <button
                type="button"
                onClick={() => void copySecret()}
                className="shrink-0 p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => {
                if (
                  status.inbound.configured &&
                  !confirm(t("rotateConfirm"))
                ) {
                  return;
                }
                createMutation.mutate();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {status.inbound.configured ? t("rotate") : t("create")}
            </button>
            {status.inbound.configured ? (
              <button
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => {
                  if (!confirm(t("revokeConfirm"))) return;
                  revokeMutation.mutate();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-400 hover:bg-amber-500/10"
              >
                <Ban className="w-4 h-4" />
                {t("revoke")}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-500">{t("adminOnly")}</p>
        )}
      </GlassCard>

      <GlassCard className="mt-4 p-4 space-y-3">
        <h3 className="text-white font-medium">{t("readKeyTitle")}</h3>
        <p className="text-sm text-slate-400">{t("readKeyHint")}</p>
        <p className="text-sm text-emerald-300/90">{t("autoSync")}</p>
        <p className="text-sm text-slate-300">
          {status.readKey.configured ? t("readKeyOn") : t("readKeyOff")}
        </p>
        {status.sync ? (
          <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-300 space-y-1">
            <p>
              {t("lastSync")}:{" "}
              {status.sync.lastSyncAt
                ? formatDate(status.sync.lastSyncAt)
                : t("neverSynced")}
            </p>
            {status.sync.lastSummary ? (
              <p className="text-xs text-slate-400">
                {t("syncSummary")}: {status.sync.lastSummary.properties || 0}{" "}
                / {status.sync.lastSummary.parties || 0} /{" "}
                {status.sync.lastSummary.invoices || 0} /{" "}
                {status.sync.lastSummary.payments || 0} /{" "}
                {status.sync.lastSummary.expenses || 0}
              </p>
            ) : null}
            {status.sync.lastError ? (
              <p className="text-xs text-amber-300 whitespace-pre-wrap">
                {t("syncError")}: {status.sync.lastError}
              </p>
            ) : null}
          </div>
        ) : null}
        <a
          href={status.propertiesApiKeysUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-emerald-400 hover:underline inline-flex items-center gap-1"
        >
          {t("openApiKeys")}
          <ExternalLink className="w-3 h-3" />
        </a>
        {canManage ? (
          <>
            <label className="block text-xs text-slate-400">
              {t("orgId")}
              <input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder={t("orgIdPlaceholder")}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              {t("readKeyPaste")}
              <input
                type="password"
                autoComplete="off"
                value={readKey}
                onChange={(e) => setReadKey(e.target.value)}
                placeholder={t("readKeyPlaceholder")}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {tCommon("save")}
            </button>
            {status.readKey.configured ? (
              <button
                type="button"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {t("syncNow")}
              </button>
            ) : null}
            </div>
          </>
        ) : null}
      </GlassCard>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="text-sm text-emerald-400 hover:underline"
        >
          {guideOpen ? t("hideGuide") : t("showGuide")}
        </button>
        {guideOpen && readme ? (
          <div className="mt-3 space-y-4 text-sm text-slate-300">
            {readme.sections.map((section) => (
              <div key={section.id}>
                <h4 className="font-medium text-white mb-1">{section.titleAr}</h4>
                <ol className="list-decimal ps-5 space-y-1 text-slate-400">
                  {section.stepsAr.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
