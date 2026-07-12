const uidKey = "vvebo_uid";

function getUid(url) {
  const match = url.match(/[?&]uid=(\d+)/);
  return match ? match[1] : undefined;
}

function buildProfileUrl(url, uid) {
  let target = url
    .replace("/2/statuses/user_timeline", "/2/profile/statuses/tab")
    .replace(/([?&])max_id=/, "$1since_id=");

  if (!/[?&]containerid=/.test(target)) {
    target += (target.includes("?") ? "&" : "?") +
      "containerid=230413" + uid + "_-_WEIBO_SECOND_PROFILE_WEIBO";
  }

  return target;
}

function cleanHeaders(headers) {
  const next = {};
  headers = headers || {};

  Object.keys(headers).forEach((key) => {
    if (!/^(content-length|content-type|host)$/i.test(key)) {
      next[key] = headers[key];
    }
  });

  next["Accept-Encoding"] = "identity";
  return next;
}

function timelineBodyFromProfile(body) {
  const data = JSON.parse(body);
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const statuses = cards
    .map((card) => (card.card_group ? card.card_group : card))
    .flat()
    .filter((card) => card && card.card_type === 9 && card.mblog)
    .map((card) => card.mblog)
    .map((status) => (status.isTop ? Object.assign({}, status, { label: "置顶" }) : status));

  const cardlistInfo = data.cardlistInfo || {};
  return JSON.stringify({
    statuses,
    since_id: cardlistInfo.since_id || "0",
    total_number: 100,
  });
}

function finish(value) {
  $done(value || {});
}

const url = $request.url;

if (typeof $response === "undefined") {
  if (url.includes("/2/remind/unread_count")) {
    const uid = getUid(url);
    if (uid) {
      $persistentStore.write(uid, uidKey);
    }
  }
  finish({});
} else if (url.includes("/2/statuses/user_timeline")) {
  const uid = getUid(url) || $persistentStore.read(uidKey);

  if (!uid) {
    finish({});
  } else {
    const profileUrl = buildProfileUrl(url, uid);
    const request = {
      url: profileUrl,
      headers: cleanHeaders($request.headers),
    };

    $httpClient.get(request, function (error, response, body) {
      if (error || !body) {
        finish({});
        return;
      }

      try {
        finish({ body: timelineBodyFromProfile(body) });
      } catch (err) {
        finish({});
      }
    });
  }
} else if (url.includes("/2/cardlist") && url.includes("selffans")) {
  try {
    const data = JSON.parse($response.body);
    const cards = Array.isArray(data.cards)
      ? data.cards.filter((card) => card.itemid !== "INTEREST_PEOPLE2")
      : data.cards;

    finish({ body: JSON.stringify(Object.assign({}, data, { cards })) });
  } catch (err) {
    finish({});
  }
} else {
  finish({});
}
