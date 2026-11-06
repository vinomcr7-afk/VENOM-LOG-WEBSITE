const $ = id => document.getElementById(id);

let selectedGuild = null;
let channelList = [];
let currentConfig = {};

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

/* DISCORD ACCOUNT */

async function loadMe() {
  const data = await api("/api/me");

  const user = data.user;

  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  const username = user.global_name || user.username;

  $("username").textContent = username;
  $("profile-username").textContent = username;
  $("menu-username").textContent = username;
  $("discord-id").textContent = user.id;

  $("avatar").src = avatar;
  $("profile-avatar").src = avatar;
  $("menu-avatar").src = avatar;
}

/* ACCOUNT DROPDOWN */

$("account-button").addEventListener("click", () => {
  const dropdown = $("account-dropdown");
  dropdown.hidden = !dropdown.hidden;
});

document.addEventListener("click", event => {
  if (!$("account-menu").contains(event.target)) {
    $("account-dropdown").hidden = true;
  }
});

/* DISCORD SERVERS */

async function loadGuilds() {
  $("guilds").innerHTML =
    '<div class="panel">Loading servers...</div>';

  try {
    const data = await api("/api/guilds");

    if (!data.guilds.length) {
      $("guilds").innerHTML =
        '<div class="panel">No manageable servers were found.</div>';
      return;
    }

    $("guilds").innerHTML = "";

    data.guilds.forEach(guild => {
      const card = document.createElement("article");
      card.className = "guild-card";

      const img = document.createElement("img");

      img.src = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
        : "https://cdn.discordapp.com/embed/avatars/0.png";

      img.alt = "";

      const info = document.createElement("div");

      const title = document.createElement("h3");
      title.textContent = guild.name;

      const status = document.createElement("p");

      status.textContent = guild.botAdded
        ? "VENOM LOG is in this server"
        : "Bot not added yet";

      const button = document.createElement("button");

      button.className = guild.botAdded
        ? "primary"
        : "secondary";

      button.textContent = guild.botAdded
        ? "MANAGE SERVER"
        : "ADD BOT";

      if (guild.botAdded) {
        button.addEventListener("click", () => selectGuild(guild));
      } else {
        button.addEventListener("click", () => {
          window.open(
            "https://discord.com/oauth2/authorize?client_id=1565783855846269169&permissions=84992&integration_type=0&scope=applications.commands%20bot",
            "_blank",
            "noopener"
          );
        });
      }

      info.append(title, status);
      card.append(img, info, button);

      $("guilds").append(card);
    });

  } catch (error) {
    $("guilds").textContent = error.message;
    notice(error.message, true);
  }
}

/* SELECT SERVER */

async function selectGuild(guild) {
  selectedGuild = guild;

  $("settings").hidden = false;
  $("selected-name").textContent = guild.name;

  $("event-settings").innerHTML =
    "<p>Loading channels and settings...</p>";

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

/* RENDER LOG SETTINGS */

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

      const span = document.createElement("span");
      span.textContent = label;

      const select = document.createElement("select");
      select.dataset.event = key;

      const none = document.createElement("option");
      none.value = "";
      none.textContent = "Disabled";

      select.append(none);

      channelList.forEach(channel => {
        const option = document.createElement("option");

        option.value = channel.id;
        option.textContent = "# " + channel.name;

        select.append(option);
      });

      const saved = currentConfig[key];

      select.value = Array.isArray(saved)
        ? saved[0]
        : (saved || "");

      row.append(span, select);
      section.append(row);
    });

    root.append(section);
  });
}

/* SAVE SETTINGS */

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

    notice("Settings saved. VENOM LOG will use them.");

  } catch (error) {
    $("save-status").textContent = "Save failed.";
    notice(error.message, true);

  } finally {
    $("save").disabled = false;
  }
}

/* BUTTONS */

$("refresh").addEventListener("click", loadGuilds);
$("save").addEventListener("click", save);

/* START */

loadMe()
  .then(loadGuilds)
  .catch(() => {
    location.href = "/auth/discord";
  });