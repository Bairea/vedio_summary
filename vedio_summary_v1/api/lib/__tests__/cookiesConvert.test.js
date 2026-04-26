import { test } from "node:test";
import assert from "node:assert/strict";
import { cookieHeaderToNetscape, isProbablyNetscapeCookies } from "../cookiesConvert.js";

test("cookiesConvert: detects netscape format", () => {
  const netscape = "# Netscape HTTP Cookie File\n\n.example.com\tTRUE\t/\tFALSE\t0\tfoo\tbar\n";
  assert.equal(isProbablyNetscapeCookies(netscape), true);
  assert.equal(isProbablyNetscapeCookies("foo=bar; a=b"), false);
});

test("cookiesConvert: converts Cookie header string to netscape cookies", () => {
  const input =
    "buvid3=abc; b_nut=1; bili_ticket=xyz; buvid4=hello%3D%3D; rpdid=|(JYYRlYk|Rk0J'u~~YJkRYJ)";
  const out = cookieHeaderToNetscape(input, { domain: ".bilibili.com", secure: true });
  assert.match(out, /^# Netscape HTTP Cookie File/m);
  assert.match(out, /\.bilibili\.com\tTRUE\t\/\tTRUE\t\d+\tbuvid3\tabc/);
  assert.match(out, /bili_ticket\tx?yz/);
});

