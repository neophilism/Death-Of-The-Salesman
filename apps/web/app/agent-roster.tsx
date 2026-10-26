"use client";

import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from "react";
import {AGENT_ROSTER_PAGE_SIZE,filterRosterAgents,paginateRosterAgents,verifiedRosterEvents,type RosterAgent,type RosterStatusFilter} from "./agent-roster-model";
export type {RosterAgent} from "./agent-roster-model";

const statusOptions: readonly {value:RosterStatusFilter;label:string}[]=[{value:"all",label:"All statuses"},{value:"running",label:"Running"},{value:"waiting",label:"Waiting"},{value:"inactive",label:"Inactive"}];
const initials=(name:string):string=>name.split(/\s+/).filter(Boolean).map((part)=>part[0]).join("").slice(0,2).toLocaleUpperCase("en-US");
const spend=(agent:RosterAgent):string=>new Intl.NumberFormat("en-US",{style:"currency",currency:agent.spend.currency}).format(agent.spend.amountMinor/100);
const timestamp=(value:string|null):string=>value?new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(value)):"No verified activity";

function AgentDrawer({agent,onClose}:{agent:RosterAgent|null;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(agent&&!dialog?.open)dialog?.showModal();else if(!agent&&dialog?.open)dialog.close();},[agent]);
 const events=agent?verifiedRosterEvents(agent.events):[];
 return <dialog ref={ref} className="agent-detail-dialog" aria-labelledby="agent-detail-title" onClose={onClose} onCancel={onClose}>
  {agent?<div className="agent-detail-drawer">
   <header><div><p className="eyebrow">Agent detail</p><h2 id="agent-detail-title">{agent.name}</h2><p>{agent.role}</p></div><button type="button" onClick={onClose}>Close</button></header>
   <dl className="agent-detail-facts">
    <div><dt>Current task</dt><dd>{agent.currentTask}</dd></div><div><dt>Strategy</dt><dd>{agent.strategy}</dd></div>
    <div><dt>Last verified activity</dt><dd><time dateTime={agent.lastActivityAt??undefined}>{timestamp(agent.lastActivityAt)}</time></dd></div>
    <div><dt>Result</dt><dd>{agent.resultSummary}</dd></div><div><dt>Spend</dt><dd>{spend(agent)}</dd></div>
   </dl>
   <section aria-labelledby="verified-events-heading"><h3 id="verified-events-heading">Verified events</h3>{events.length?<ol className="agent-event-list">{events.map((event)=><li key={event.id}><time dateTime={event.occurredAt}>{timestamp(event.occurredAt)}</time><strong>{event.label}</strong><span>{event.result}</span></li>)}</ol>:<p className="agent-event-empty">No authoritative verified events are available.</p>}</section>
  </div>:null}
 </dialog>;
}

export function AgentRoster({agents}:Readonly<{agents:readonly RosterAgent[]}>){
 const [query,setQuery]=useState(""),[status,setStatus]=useState<RosterStatusFilter>("all"),[requestedPage,setRequestedPage]=useState(1),[selected,setSelected]=useState<RosterAgent|null>(null);
 const itemRefs=useRef<Array<HTMLButtonElement|null>>([]),filtered=useMemo(()=>filterRosterAgents(agents,query,status),[agents,query,status]),rosterPage=useMemo(()=>paginateRosterAgents(filtered,requestedPage),[filtered,requestedPage]);
 useEffect(()=>{if(requestedPage!==rosterPage.page)setRequestedPage(rosterPage.page);},[requestedPage,rosterPage.page]);
 const moveFocus=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{const last=rosterPage.items.length-1;let next=index;if(event.key==="ArrowRight"||event.key==="ArrowDown")next=Math.min(last,index+1);else if(event.key==="ArrowLeft"||event.key==="ArrowUp")next=Math.max(0,index-1);else if(event.key==="Home")next=0;else if(event.key==="End")next=last;else return;event.preventDefault();itemRefs.current[next]?.focus();};
 const firstVisible=rosterPage.total===0?0:(rosterPage.page-1)*AGENT_ROSTER_PAGE_SIZE+1,lastVisible=Math.min(rosterPage.page*AGENT_ROSTER_PAGE_SIZE,rosterPage.total);
 return <div className="agent-roster">
  <div className="roster-controls"><label><span>Search agents</span><input type="search" value={query} placeholder="Name, role, model, task, or result" onChange={(event)=>{setQuery(event.target.value);setRequestedPage(1);}}/></label><label><span>Status</span><select value={status} onChange={(event)=>{setStatus(event.target.value as RosterStatusFilter);setRequestedPage(1);}}>{statusOptions.map((option)=><option value={option.value} key={option.value}>{option.label}</option>)}</select></label></div>
  <div className="roster-summary" aria-live="polite" aria-atomic="true">{rosterPage.total===0?"No agents match the current filters.":`Showing ${firstVisible}-${lastVisible} of ${rosterPage.total} agents.`}</div>
  {rosterPage.total>0?<div className="roster-grid" role="list" aria-label="Filtered agent roster">{rosterPage.items.map((agent,index)=>{const verified=verifiedRosterEvents(agent.events);return <article className="roster-tile" role="listitem" key={agent.id}>
   <button ref={(node)=>{itemRefs.current[index]=node;}} className="roster-tile-action" type="button" aria-haspopup="dialog" aria-expanded={selected?.id===agent.id} aria-labelledby={`${agent.id}-name`} aria-describedby={`${agent.id}-details`} onClick={()=>setSelected(agent)} onKeyDown={(event)=>moveFocus(event,index)}>
    <span className="roster-avatar" aria-hidden="true">{initials(agent.name)}</span><span className="roster-identity"><strong id={`${agent.id}-name`}>{agent.name}</strong><span>{agent.role}</span></span><span className="roster-status" data-state={agent.status}><span className="status-light" aria-hidden="true"/><span>{agent.statusLabel}</span></span><span className="roster-details" id={`${agent.id}-details`}><span><b>Model</b>{agent.assignedModel}</span><span><b>Availability</b>{agent.availability}</span></span>
   </button>
   <aside className="agent-quick-peek" aria-hidden="true"><strong>{agent.name}</strong><span>{agent.currentTask}</span><dl><div><dt>Last activity</dt><dd>{timestamp(agent.lastActivityAt)}</dd></div><div><dt>Verified events</dt><dd>{verified.length}</dd></div><div><dt>Spend</dt><dd>{spend(agent)}</dd></div></dl></aside>
  </article>;})}</div>:<p className="roster-empty">Try a broader search or another status.</p>}
  <nav className="roster-pagination" aria-label="Agent roster pages"><button type="button" disabled={rosterPage.page===1} onClick={()=>setRequestedPage((value)=>Math.max(1,value-1))}>Previous</button><span>Page {rosterPage.page} of {rosterPage.pageCount}</span><button type="button" disabled={rosterPage.page===rosterPage.pageCount} onClick={()=>setRequestedPage((value)=>Math.min(rosterPage.pageCount,value+1))}>Next</button></nav>
  <AgentDrawer agent={selected} onClose={()=>setSelected(null)}/>
 </div>;
}
