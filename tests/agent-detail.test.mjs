import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {verifiedRosterEvents} from "../apps/web/app/agent-roster-model.ts";

test("detail history includes only authoritative verified events",()=>{
 const events=[{id:"1",occurredAt:"2026-10-26T08:00:00.000Z",label:"Verified",result:"Accepted",verified:true,source:"persisted-run"},{id:"2",occurredAt:"2026-10-26T08:01:00.000Z",label:"Synthetic",result:"Preview",verified:true,source:"synthetic-preview"},{id:"3",occurredAt:"2026-10-26T08:02:00.000Z",label:"Unverified",result:"Pending",verified:false,source:"persisted-run"}];
 assert.deepEqual(verifiedRosterEvents(events).map((event)=>event.id),["1"]);assert.equal(Object.isFrozen(verifiedRosterEvents(events)),true);
});

test("roster exposes hover, focus, tap and native-dialog detail paths",async()=>{
 const [source,styles]=await Promise.all([readFile(new URL("../apps/web/app/agent-roster.tsx",import.meta.url),"utf8"),readFile(new URL("../apps/web/app/styles.css",import.meta.url),"utf8")]);
 for(const contract of ['aria-haspopup="dialog"','<dialog','onClick={()=>setSelected(agent)}','onCancel={onClose}','Verified events','Current task','Strategy','Spend'])assert.ok(source.includes(contract),`missing detail contract: ${contract}`);
 for(const contract of [".roster-tile:focus-within .agent-quick-peek",".roster-tile:hover .agent-quick-peek","position: fixed","max-height: calc(100dvh - 32px)"])assert.ok(styles.includes(contract),`missing viewport contract: ${contract}`);
});
