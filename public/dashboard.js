"use strict";

const $ = id => document.getElementById(id);

let selectedGuild = null;
let channelList = [];
let currentConfig = {};

const DEFAULT_ICON = "https://cdn.discordapp.com/embed/avatars/0.png";

const events = [
  ["Members", [
    ["memberJoin", "Member Join"],
    ["memberLeave", "Member Leave"],
    ["memberKick", "Member Kick"],
    ["nicknameUpdate", "Nickname Update"],
    ["memberRoles", "Member Roles Updated"]
  ]],
  ["Messages", [
    ["messageDelete", "Message Delete"],
    ["messageEdit", "Message Edit"],
    ["messagePin", "Message Pinned"],
    ["messageUnpin", "Message Unpinned"],
    ["reactionAdd", "Reaction Added"],
    ["reactionRemove", "Reaction Removed"]
  ]],
  ["Voice", [
    ["voiceJoin", "Voice Join"],
    ["voiceLeave", "Voice Leave"],
    ["voiceMove", "Voice Move"],
    ["voiceMute", "Voice Mute"],
    ["voiceDeafen", "Voice Deafen"]
  ]],
  ["Server Actions", [
    ["inviteCreate", "Invite Created"],
    ["inviteDelete", "Invite Deleted"],
    ["emojiUpdate", "Emoji Updated"],
    ["webhookUpdate", "Webhook Updated"]
  ]],
  ["Channels", [
    ["channelCreate", "Channel Created"],
    ["channelDelete", "Channel Deleted"],
    ["channelUpdate", "Channel Updated"],
    ["channelPerms", "Channel Permissions Updated"]
  ]],
  ["Server Events", [
    ["serverUpdate", "Server Updated"]
  ]],
  ["Roles", [
    ["roleCreate", "Role Created"],
    ["roleDelete", "Role Deleted"],
    ["roleUpdate", "Role Updated"]
  ]],
  ["Moderation", [
    ["ban", "Member Banned"],
    ["unban", "Member Unbanned"],
    ["timeout", "Member Timed Out"],
    ["timeoutRemoved", "Timeout Removed"]
  ]]
];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function notice(message, bad = false) {
  $("notice").textContent = message;
  $("notice").className = "notice " + (bad ? "error" : "");
}

/*
 * Discord server icon:
 * - GIF for animated icons.
 * - WebP for static icons.
 * - Default Discord icon if no icon exists.
 */
function guildIconURL(guild) {
  if (!guild.icon) return DEFAULT_ICON;

  const extension = guild.icon.startsWith("a_") ? "gif" : "webp";

  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}?size=128`;
}

function setImageFallback(img) {
  img.onerror = function () {
    this.onerror = null;
    this.src = DEFAULT_ICON;
  };
}

async function loadMe() {
  const data = await api("/api/me");

  $("username").textContent = data.user.username;

  $("avatar").src = data.user.avatar || DEFAULT_ICON;
  setImageFallback($("avatar"));
}

async function loadGuilds() {
  $("guilds").innerHTML =
    '<div class="panel">Loading servers...</div>';

  try {
    const data = await api("/api/guilds");

    if (!data.guilds || data.guilds.length === 0) {
      $("guilds").innerHTML =
        '<div class="panel">No manageable servers were found.</div>';
      return;
    }

    $("guilds").innerHTML = "";

    data.guilds.forEach(guild => {
      const card = document.createElement("article");
      card.className = "guild-card";

      const img = document.createElement("img");
      img.className = "guild-icon";
      img.alt = guild.name + " icon";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = guild.icon || DEFAULT_ICON;

      setImageFallback(img);

      const info = document.createElement("div");

      const title = document.createElement("h3");
      title.textContent = guild.name;

      const status = document.createElement("p");
      status.textContent = guild.botAdded
        ? "VENOM LOG is in this server"
        : "Bot not added yet";

      const button = document.createElement("button");

      button.className = guild.botAdded ? "primary" : "secondary";

      button.textContent = guild.botAdded
        ? "إدارة الخادم"
        : "إضافة بوت";

      if (guild.botAdded) {
        button.addEventListener("click", () => selectGuild(guild));
      } else {
        button.addEventListener("click", () => {
          const invite =
            "https://discord.com/oauth2/authorize" +
            "?client_id=1565783855846269169" +
            "&permissions=84992" +
            "&integration_type=0" +
            "&scope=applications.commands%20bot";

          window.open(invite, "_blank", "noopener");
        });
      }

      info.append(title, status);
      card.append(img, info, button);

      $("guilds").append(card);
    });

  } catch (error) {
    $("guilds").innerHTML = "";

    const box = document.createElement("div");
    box.className = "panel";
    box.textContent = error.message;

    $("guilds").append(box);

    notice(error.message, true);
  }
}

async function selectGuild(guild) {
  selectedGuild = guild;

  $("settings").hidden = false;
  $("selected-name").textContent = guild.name;

  $("event-settings").textContent =
    "Loading channels and settings...";

  try {
    const [channels, settings] = await Promise.all([
      api(`/api/guilds/${guild.id}/channels`),
      api(`/api/guilds/${guild.id}/config`)
    ]);

    channelList = channels.channels || [];
    currentConfig = settings.config || {};

    renderEvents();

    $("settings").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    notice(`Managing ${guild.name}.`);

  } catch (error) {
    $("event-settings").textContent = error.message;
    notice(error.message, true);
  }
}

function renderEvents() {
  const root = $("event-settings");

  root.innerHTML = "";

  events.forEach(([group, items]) => {
    const section = document.createElement("section");
    section.className = "event-group";

    const heading = document.createElement("h3");
    heading.textContent = group;

    section.append(heading);

    items.forEach(([key, label]) => {
      const row = document.createElement("label");
      row.className = "event-row";

      const name = document.createElement("span");
      name.textContent = label;

      const select = document.createElement("select");
      select.dataset.event = key;

      const disabled = document.createElement("option");
      disabled.value = "";
      disabled.textContent = "Disabled";

      select.append(disabled);

      channelList.forEach(channel => {
        const option = document.createElement("option");

        option.value = channel.id;
        option.textContent = "# " + channel.name;

        select.append(option);
      });

      const saved = currentConfig[key];

      select.value = Array.isArray(saved)
        ? saved[0] || ""
        : saved || "";

      row.append(name, select);
      section.append(row);
    });

    root.append(section);
  });
}

async function save() {
  if (!selectedGuild) return;

  const config = {};

  document.querySelectorAll("select[data-event]").forEach(select => {
    if (select.value) {
      config[select.dataset.event] = select.value;
    }
  });

  $("save").disabled = true;
  $("save-status").textContent = "Saving...";

  try {
    await api(`/api/guilds/${selectedGuild.id}/config`, {
      method: "PUT",
      body: JSON.stringify({ config })
    });

    currentConfig = config;

    $("save-status").textContent = "Saved successfully.";

    notice("Settings saved.");

  } catch (error) {
    $("save-status").textContent = "Save failed.";
    notice(error.message, true);

  } finally {
    $("save").disabled = false;
  }
}

$("refresh").addEventListener("click", loadGuilds);
$("save").addEventListener("click", save);

loadMe()
  .then(loadGuilds)
  .catch(() => {
    location.href = "/auth/discord";
  });