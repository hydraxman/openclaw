import type { sendMessageWhatsApp } from "../channels/web/index.js";
import type { sendMessageDiscord } from "../discord/send.js";
import type { sendMessageIMessage } from "../imessage/send.js";
import type { OutboundSendDeps } from "../infra/outbound/deliver.js";
<<<<<<< HEAD
import { sendMessageDiscord } from "../discord/send.js";
import { sendMessageSignal } from "../signal/send.js";
import { sendMessageSlack } from "../slack/send.js";
import { sendMessageTelegram } from "../telegram/send.js";
=======
import type { sendMessageSignal } from "../signal/send.js";
import type { sendMessageSlack } from "../slack/send.js";
import type { sendMessageTelegram } from "../telegram/send.js";
>>>>>>> 3bbd29bef942ac6b8c81432b9c5e2d968b6e1627

export type CliDeps = {
  sendMessageTelegram: typeof sendMessageTelegram;
  sendMessageDiscord: typeof sendMessageDiscord;
  sendMessageSlack: typeof sendMessageSlack;
  sendMessageSignal: typeof sendMessageSignal;
};

export function createDefaultDeps(): CliDeps {
  return {
<<<<<<< HEAD
    sendMessageTelegram,
    sendMessageDiscord,
    sendMessageSlack,
    sendMessageSignal,
=======
    sendMessageWhatsApp: async (...args) => {
      const { sendMessageWhatsApp } = await import("../channels/web/index.js");
      return await sendMessageWhatsApp(...args);
    },
    sendMessageTelegram: async (...args) => {
      const { sendMessageTelegram } = await import("../telegram/send.js");
      return await sendMessageTelegram(...args);
    },
    sendMessageDiscord: async (...args) => {
      const { sendMessageDiscord } = await import("../discord/send.js");
      return await sendMessageDiscord(...args);
    },
    sendMessageSlack: async (...args) => {
      const { sendMessageSlack } = await import("../slack/send.js");
      return await sendMessageSlack(...args);
    },
    sendMessageSignal: async (...args) => {
      const { sendMessageSignal } = await import("../signal/send.js");
      return await sendMessageSignal(...args);
    },
    sendMessageIMessage: async (...args) => {
      const { sendMessageIMessage } = await import("../imessage/send.js");
      return await sendMessageIMessage(...args);
    },
>>>>>>> 3bbd29bef942ac6b8c81432b9c5e2d968b6e1627
  };
}

// Provider docking: extend this mapping when adding new outbound send deps.
export function createOutboundSendDeps(deps: CliDeps): OutboundSendDeps {
  return {
    sendTelegram: deps.sendMessageTelegram,
    sendDiscord: deps.sendMessageDiscord,
    sendSlack: deps.sendMessageSlack,
    sendSignal: deps.sendMessageSignal,
  };
}
<<<<<<< HEAD
=======

export { logWebSelfId } from "../web/auth-store.js";
>>>>>>> 3bbd29bef942ac6b8c81432b9c5e2d968b6e1627
