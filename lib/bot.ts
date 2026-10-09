import { Bot, InlineKeyboard } from "grammy";
import { env } from "./http";
import { displayName } from "./telegram";
import { adminId, ensureAdmin, getUser, registerUser, setUserStatus } from "./users";

/**
 * The Telegram bot. It only does three jobs:
 *  1. /start  -> open the Mini App (or ask the admin for access)
 *  2. the admin's Approve / Reject buttons
 *  3. point everyone else back to the Mini App
 * Everything else happens inside the Mini App.
 */
export function createBot(appUrl: string): Bot {
  const bot = new Bot(env("BOT_TOKEN"));

  const openAppKeyboard = () => new InlineKeyboard().webApp("🔗 Open Link Shortener", appUrl);

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from || ctx.chat.type !== "private") return;

    // The admin is always approved.
    if (String(from.id) === adminId()) {
      await ensureAdmin(from);
      await ctx.reply("Welcome back, admin! 👋\nTap the button below to open the app.", {
        reply_markup: openAppKeyboard(),
      });
      return;
    }

    const { user, inserted } = await registerUser(from);

    if (user.status === "approved") {
      await ctx.reply("You have access ✅\nTap the button below to open the app.", {
        reply_markup: openAppKeyboard(),
      });
      return;
    }

    if (user.status === "blocked") {
      await ctx.reply("Sorry, your access request was declined.");
      return;
    }

    // Pending
    await ctx.reply("Your access request has been sent to the admin ⏳\nYou'll get a message here as soon as it's approved.");

    if (inserted) {
      const lines = [
        "🆕 New access request",
        "",
        `Name: ${displayName(from)}`,
        from.username ? `Username: @${from.username}` : null,
        `ID: ${from.id}`,
      ].filter((l): l is string => l !== null);

      await ctx.api
        .sendMessage(adminId(), lines.join("\n"), {
          reply_markup: new InlineKeyboard()
            .text("✅ Approve", `approve:${from.id}`)
            .text("❌ Reject", `reject:${from.id}`),
        })
        .catch((e) => console.error("could not notify admin (has the admin pressed /start?)", e));
    }
  });

  // Approve / Reject buttons under the request message.
  bot.callbackQuery(/^(approve|reject):(\d+)$/, async (ctx) => {
    if (String(ctx.from.id) !== adminId()) {
      await ctx.answerCallbackQuery({ text: "Only the admin can do this.", show_alert: true });
      return;
    }
    const match = ctx.match as RegExpMatchArray;
    const action = match[1];
    const id = match[2];

    const target = await getUser(id);
    if (!target) {
      await ctx.answerCallbackQuery({ text: "User not found." });
      return;
    }

    const approve = action === "approve";
    await setUserStatus(id, approve ? "approved" : "blocked");
    await ctx.answerCallbackQuery({ text: approve ? "Approved ✅" : "Rejected ❌" });

    const original = ctx.callbackQuery.message && "text" in ctx.callbackQuery.message ? ctx.callbackQuery.message.text : "";
    await ctx
      .editMessageText(`${original ?? ""}\n\n${approve ? "✅ Approved" : "❌ Rejected"}`)
      .catch(() => {});

    if (approve) {
      await ctx.api
        .sendMessage(id, "✅ Your request was approved! Tap the button below to open the app.", {
          reply_markup: openAppKeyboard(),
        })
        .catch(() => {});
    } else {
      await ctx.api.sendMessage(id, "Sorry, your access request was declined.").catch(() => {});
    }
  });

  // Anything else typed in the chat.
  bot.on("message", async (ctx) => {
    if (ctx.chat.type !== "private" || !ctx.from) return;
    const user = String(ctx.from.id) === adminId() ? await ensureAdmin(ctx.from) : await getUser(ctx.from.id);
    if (user?.status === "approved") {
      await ctx.reply("Tap the button below to open the app 👇", { reply_markup: openAppKeyboard() });
    } else {
      await ctx.reply("Send /start to request access.");
    }
  });

  bot.catch((err) => console.error("bot error", err.error));

  return bot;
}
