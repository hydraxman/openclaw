import { z } from "zod";
import { ChannelHeartbeatVisibilitySchema } from "./zod-schema.channels.js";
import { GroupPolicySchema } from "./zod-schema.core.js";
import {
  DiscordConfigSchema,
  GoogleChatConfigSchema,
<<<<<<< HEAD
=======
  IMessageConfigSchema,
  IrcConfigSchema,
>>>>>>> 3bbd29bef942ac6b8c81432b9c5e2d968b6e1627
  MSTeamsConfigSchema,
  SignalConfigSchema,
  SlackConfigSchema,
  TelegramConfigSchema,
} from "./zod-schema.providers-core.js";

export * from "./zod-schema.providers-core.js";
export { ChannelHeartbeatVisibilitySchema } from "./zod-schema.channels.js";

export const ChannelsSchema = z
  .object({
    defaults: z
      .object({
        groupPolicy: GroupPolicySchema.optional(),
        heartbeat: ChannelHeartbeatVisibilitySchema,
      })
      .strict()
      .optional(),
    telegram: TelegramConfigSchema.optional(),
    discord: DiscordConfigSchema.optional(),
    irc: IrcConfigSchema.optional(),
    googlechat: GoogleChatConfigSchema.optional(),
    slack: SlackConfigSchema.optional(),
    signal: SignalConfigSchema.optional(),
    msteams: MSTeamsConfigSchema.optional(),
  })
  .passthrough() // Allow extension channel configs (nostr, matrix, zalo, etc.)
  .optional();
