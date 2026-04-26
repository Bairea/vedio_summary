import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentsToSrt, segmentsToVtt } from "../subtitleFormat.js";

test("subtitleFormat: segmentsToSrt produces expected timestamps and text", () => {
  const srt = segmentsToSrt([
    { startMs: 0, endMs: 1250, text: "hello" },
    { startMs: 1500, endMs: 3200, text: "world" },
  ]);

  assert.match(srt, /1\n00:00:00,000 --> 00:00:01,250\nhello/s);
  assert.match(srt, /2\n00:00:01,500 --> 00:00:03,200\nworld/s);
});

test("subtitleFormat: segmentsToVtt produces WEBVTT header and timestamps", () => {
  const vtt = segmentsToVtt([{ startMs: 0, endMs: 1000, text: "a" }]);
  assert.match(vtt, /^WEBVTT/m);
  assert.match(vtt, /00:00:00.000 --> 00:00:01.000/m);
});
