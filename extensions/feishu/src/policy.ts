import type {
  AllowlistMatch,
  ChannelGroupContext,
  GroupToolPolicyConfig,
} from "openclaw/plugin-sdk";
// Backward compatibility: some OpenClaw builds don't expose resolveAllowlistMatchSimple.
import * as pluginSdk from "openclaw/plugin-sdk";
import type { FeishuConfig, FeishuGroupConfig } from "./types.js";

export type FeishuAllowlistMatch = AllowlistMatch<"wildcard" | "id" | "name">;

export function resolveFeishuAllowlistMatch(params: {
  allowFrom: Array<string | number>;
  senderId: string;
  senderName?: string | null;
}): FeishuAllowlistMatch {
  const fn = (pluginSdk as any).resolveAllowlistMatchSimple as
    | ((p: { allowFrom: Array<string | number>; senderId: string; senderName?: string | null }) => FeishuAllowlistMatch)
    | undefined;

  if (typeof fn === "function") {
    return fn(params);
  }

  // Fallback for older plugin-sdk versions: exact id/name match only.
  const allow = (params.allowFrom ?? []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const senderId = params.senderId?.trim().toLowerCase();
  const senderName = params.senderName?.trim().toLowerCase();
  const allowed = allow.includes(senderId) || (senderName ? allow.includes(senderName) : false);
  return {
    allowed,
    mode: allowed ? "id" : "id",
    matchedBy: allowed ? (allow.includes(senderId) ? senderId : senderName ?? null) : null,
  } as FeishuAllowlistMatch;
}

export function resolveFeishuGroupConfig(params: {
  cfg?: FeishuConfig;
  groupId?: string | null;
}): FeishuGroupConfig | undefined {
  const groups = params.cfg?.groups ?? {};
  const groupId = params.groupId?.trim();
  if (!groupId) {
    return undefined;
  }

  const direct = groups[groupId];
  if (direct) {
    return direct;
  }

  const lowered = groupId.toLowerCase();
  const matchKey = Object.keys(groups).find((key) => key.toLowerCase() === lowered);
  return matchKey ? groups[matchKey] : undefined;
}

export function resolveFeishuGroupToolPolicy(
  params: ChannelGroupContext,
): GroupToolPolicyConfig | undefined {
  const cfg = params.cfg.channels?.feishu as FeishuConfig | undefined;
  if (!cfg) {
    return undefined;
  }

  const groupConfig = resolveFeishuGroupConfig({
    cfg,
    groupId: params.groupId,
  });

  return groupConfig?.tools;
}

export function isFeishuGroupAllowed(params: {
  groupPolicy: "open" | "allowlist" | "disabled";
  allowFrom: Array<string | number>;
  senderId: string;
  senderName?: string | null;
}): boolean {
  const { groupPolicy } = params;
  if (groupPolicy === "disabled") {
    return false;
  }
  if (groupPolicy === "open") {
    return true;
  }
  return resolveFeishuAllowlistMatch(params).allowed;
}

export function resolveFeishuReplyPolicy(params: {
  isDirectMessage: boolean;
  globalConfig?: FeishuConfig;
  groupConfig?: FeishuGroupConfig;
}): { requireMention: boolean } {
  if (params.isDirectMessage) {
    return { requireMention: false };
  }

  const requireMention =
    params.groupConfig?.requireMention ?? params.globalConfig?.requireMention ?? true;

  return { requireMention };
}
